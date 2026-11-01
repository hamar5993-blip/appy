'use client';

/* Homework solver: text and/or photo in, a step-by-step solution out. The
   actual AI call lives in /api/homework so the OpenRouter key stays server-side. */

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/components/settings';
import { Button, Card } from '@/components/ui';
import { toast } from 'sonner';
import { ImagePlus, X, Sparkles, Copy, Check, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED_IMAGE = /^image\/(png|jpe?g|webp|gif)$/i;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/* Downscale phone photos so the request stays small and fast. */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  /* White background keeps transparent PNGs readable once converted to JPEG. */
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return canvas.toDataURL('image/jpeg', 0.85);
}

function renderInline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${key}-${i}`}>{part}</span>
    )
  );
}

/* Lightweight Markdown renderer: headings, bold, bullet/numbered lists and
   code blocks — enough for AI answers without pulling in a dependency. */
function AnswerBody({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    list = null;
    const listClasses = cn('space-y-1.5 ps-5', ordered ? 'list-decimal' : 'list-disc');
    const listItems = items.map((item, i) => (
      <li key={`${i}`} className="leading-relaxed marker:text-primary">
        {renderInline(item, `li-${i}`)}
      </li>
    ));
    blocks.push(
      ordered
        ? <ol key={`l-${key++}`} className={listClasses}>{listItems}</ol>
        : <ul key={`l-${key++}`} className={listClasses}>{listItems}</ul>
    );
  };

  const flushCode = () => {
    if (!code) return;
    const body = code.join('\n');
    code = null;
    blocks.push(
      <pre
        key={`c-${key++}`}
        dir="ltr"
        className="overflow-x-auto rounded-xl border border-edge bg-background p-3 text-[13px] leading-relaxed"
      >
        <code>{body}</code>
      </pre>
    );
  };

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');

    if (code) {
      if (line.trim().startsWith('```')) flushCode();
      else code.push(raw);
      continue;
    }
    if (line.trim().startsWith('```')) {
      flushList();
      code = [];
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push(
        <h3 key={`h-${key++}`} className="mt-1 text-[15px] font-extrabold">
          {renderInline(heading[2], `h-${key}`)}
        </h3>
      );
      continue;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      (list as { ordered: boolean; items: string[] }).items.push(bullet[1]);
      continue;
    }

    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      (list as { ordered: boolean; items: string[] }).items.push(numbered[2]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${key++}`} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(trimmed, `p-${key}`)}
      </p>
    );
  }

  flushList();
  flushCode();

  return <div className="space-y-3 text-[15px]">{blocks}</div>;
}

export default function HomeworkPage() {
  const { t, lang } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);

  const pickImage = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE.test(file.type)) {
      toast.error(t.homeworkImageType);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t.homeworkImageTooLarge);
      return;
    }
    try {
      setImage(await fileToDataUrl(file));
    } catch {
      toast.error(t.homeworkImageFailed);
    }
  };

  const solve = async () => {
    if (busy) return;
    if (!question.trim() && !image) {
      toast.error(t.homeworkNeedInput);
      return;
    }
    setBusy(true);
    setAnswer('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(t.homeworkSignIn);

      const res = await fetch('/api/homework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: question.trim(),
          image: image ?? undefined,
          lang,
        }),
      });

      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? t.homeworkSignIn
            : res.status === 503
              ? t.homeworkNotConfigured
              : t.homeworkError
        );
      }

      const json = await res.json().catch(() => ({}));
      if (!json?.answer) throw new Error(t.homeworkError);
      setAnswer(json.answer);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t.homeworkError);
    } finally {
      setBusy(false);
    }
  };

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked — no toast needed */
    }
  };

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <div className="flex items-start gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-primary/15 to-[var(--primary-2)]/20 text-primary">
          <Lightbulb className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[27px]">{t.homework}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-fg">{t.homeworkDesc}</p>
        </div>
      </div>

      <Card className="mt-7 p-5 sm:p-6">
        <label
          htmlFor="homework-question"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-fg"
        >
          {t.homeworkQuestion}
        </label>
        <textarea
          id="homework-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.homeworkQuestionPh}
          rows={5}
          dir="auto"
          className="w-full resize-y rounded-xl border border-edge bg-background px-4 py-3 text-[15px] leading-relaxed transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pickImage(file);
              e.target.value = '';
            }}
          />

          {image ? (
            <div className="flex w-full items-center gap-3 rounded-xl border border-edge bg-background p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <span className="flex-1 text-xs font-semibold text-muted-fg">{t.homeworkAttachHint}</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                title={t.homeworkRemove}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-fg transition hover:bg-red-500/10 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface px-4 py-2.5 text-[13px] font-bold text-muted-fg transition hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-4 w-4" />
                {t.homeworkAttach}
              </button>
              <span className="text-[12px] text-muted-fg">{t.homeworkAttachHint}</span>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={solve} loading={busy} size="lg">
            {!busy && <Sparkles className="h-4 w-4" />}
            {busy ? t.homeworkSolving : t.homeworkSolve}
          </Button>
        </div>
      </Card>

      {busy && (
        <Card className="mt-5 p-6">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-fg">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-edge border-t-primary" />
            {t.homeworkSolving}
          </div>
          <div className="mt-4 space-y-2.5">
            {[100, 92, 96, 70].map((width, i) => (
              <div key={i} className="h-3 animate-shimmer rounded-full" style={{ width: `${width}%` }} />
            ))}
          </div>
        </Card>
      )}

      {!busy && answer && (
        <Card className="mt-5 p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-edge pb-3">
            <h2 className="inline-flex items-center gap-2 text-[15px] font-extrabold">
              <Lightbulb className="h-4 w-4 text-primary" />
              {t.homeworkAnswer}
            </h2>
            <Button variant="ghost" size="sm" onClick={copyAnswer}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t.homeworkCopied : t.homeworkCopy}
            </Button>
          </div>
          <AnswerBody text={answer} />
        </Card>
      )}

      {!busy && !answer && (
        <Card className="mt-5 border-dashed p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-fg">{t.homeworkEmpty}</p>
        </Card>
      )}
    </div>
  );
}
