'use client';

/* AI Studio — a free chat with the assistant. When the AI "makes" something
   (Word, PowerPoint or a Canva-style design) the reply carries a creation
   payload; this page renders it as a card with a real download button.
   Generation runs in /api/studio/generate, chat in /api/studio/chat. */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/components/settings';
import { Button, Card, Spinner } from '@/components/ui';
import { toast } from 'sonner';
import { FileText, Presentation, Palette, Sparkles, Send, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCreation, type Creation } from '@/lib/studio';
import type { Dict } from '@/lib/i18n';

const STORAGE_KEY = 'easier-studio-chat';
const MAX_HISTORY = 24;

type Message = { role: 'user' | 'assistant'; content: string; creation?: Creation | null };

const KIND_META: Record<Creation['kind'], { icon: typeof FileText; label: { en: string; ar: string }; ext: string }> = {
  docx: { icon: FileText, label: { en: 'Word document', ar: 'مستند Word' }, ext: 'docx' },
  pptx: { icon: Presentation, label: { en: 'PowerPoint', ar: 'عرض PowerPoint' }, ext: 'pptx' },
  design: { icon: Palette, label: { en: 'Canva-style design', ar: 'تصميم بأسلوب Canva' }, ext: 'svg' },
};

const QUICK_PROMPTS: Record<'en' | 'ar', string[]> = {
  en: [
    'Make me a Word document summarizing photosynthesis for a 10th grader 📄',
    'Create a 6-slide PowerPoint about the water cycle 🎞️',
    'Design a study-motivation poster I can share 🎨',
    'Write a revision document: 5 key sections on World War II 📚',
  ],
  ar: [
    'اعمل لي مستند Word يلخص عملية التمثيل الضوئي 📄',
    'أنشئ عرض PowerPoint من ٦ شرائح عن دورة الماء 🎞️',
    'صمّم ملصق تحفيزي للمذاكرة أستطيع مشاركته 🎨',
    'اكتب مستند مراجعة بخمسة أقسام عن الحرب العالمية الثانية 📚',
  ],
};

export default function StudioPage() {
  const { t, lang } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Restore the last conversation locally. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed.filter((m): m is Message => !!m && typeof m === 'object' && typeof m.content === 'string'));
        }
      }
    } catch { /* ignore corrupted storage */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch { /* storage full — chat still works in memory */ }
  }, [messages, hydrated]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    const nextMessages: Message[] = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t.studioSignIn);
        return;
      }
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          lang,
          messages: nextMessages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(mapError(res.status, json, t));
        /* Keep the user's message visible; drop nothing else. */
        return;
      }
      const answer: string = typeof json?.answer === 'string' ? json.answer : '…';
      /* The chat endpoint already strips create blocks, but parse again to be
         safe if an older path ever returns them inline. */
      const { text: clean, creation } = parseCreation(answer);
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: clean, creation: creation ?? (json?.creation as Creation | null | undefined) ?? null },
      ]);
    } catch {
      toast.error(t.studioError);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMessages([]);
    setInput('');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  if (!hydrated) return null;

  return (
    <div className="animate-fade-up mx-auto flex max-w-3xl flex-col">
      <Card className="flex h-[calc(100dvh-230px)] min-h-[480px] flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-edge px-5 py-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-[var(--primary-2)] text-white shadow-[0_4px_12px_rgba(99,102,241,.4)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-extrabold">{t.studio}</h1>
            <p className="truncate text-[12px] text-muted-fg">{t.studioTag}</p>
          </div>
          <button
            onClick={clear}
            title={t.studioClear}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-edge bg-background text-muted-fg transition hover:border-primary hover:text-primary"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {!messages.length && !busy && <EmptyState />}
          <div className="flex flex-col gap-3">
            {messages.map((message, i) =>
              message.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-[14px] font-medium leading-relaxed text-white shadow-sm">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] space-y-2.5">
                    <div className="rounded-2xl rounded-es-md border border-edge bg-background px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-text">
                      {message.content}
                    </div>
                    {message.creation && <CreationCard creation={message.creation} />}
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 rounded-2xl rounded-es-md border border-edge bg-background px-4 py-3">
                  <Spinner className="h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-primary" />
                  <span className="text-[13px] font-semibold text-muted-fg">{t.studioThinking}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
          className="flex items-end gap-2 border-t border-edge bg-background/60 px-3 py-3 sm:px-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            dir="auto"
            placeholder={t.studioPh}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-edge bg-surface px-4 py-2.5 text-[14px] leading-relaxed placeholder:text-muted-fg/60 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
          <Button type="submit" size="md" loading={busy} disabled={!input.trim()} className="h-11 w-11 rounded-2xl px-0 sm:w-24">
            {busy ? '' : (
              <>
                <Send className="h-4 w-4 rtl:-scale-x-100" />
                <span className="hidden sm:inline">{t.studioSend}</span>
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Quick actions (only while empty) */}
      {!messages.length && (
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_PROMPTS[lang === 'ar' ? 'ar' : 'en'].map((prompt) => (
            <button
              key={prompt}
              onClick={() => void send(prompt)}
              className="rounded-full border border-edge bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-muted-fg transition hover:border-primary hover:text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Creation card with download ---------- */

function CreationCard({ creation }: { creation: Creation }) {
  const { t, lang } = useSettings();
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[creation.kind] ?? KIND_META.docx;
  const Icon = meta.icon;
  const isDesign = creation.kind === 'design';

  const download = async (wantPng: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t.studioSignIn);
        return;
      }
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ creation }),
      });
      if (!res.ok) {
        toast.error(t.studioGenFailed);
        return;
      }
      if (isDesign && wantPng) {
        const svgText = await res.text();
        const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('svg'));
          img.src = src;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 2160;
        canvas.height = 2700;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
        if (!blob) throw new Error('png');
        triggerDownload(blob, fileName(creation.title, 'png'));
        toast.success(t.studioSaved);
        return;
      }
      const blob = await res.blob();
      triggerDownload(blob, fileName(creation.title, meta.ext));
      toast.success(t.studioSaved);
    } catch {
      toast.error(t.studioGenFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-[var(--primary-2)] text-white shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{creation.title}</div>
        <div className={cn('truncate text-[11.5px] font-semibold', 'text-primary')}>{meta.label[lang]}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {isDesign && (
          <Button size="sm" variant="outline" loading={busy} onClick={() => void download(true)}>
            <Download className="h-3.5 w-3.5" />
            PNG
          </Button>
        )}
        <Button size="sm" loading={busy} onClick={() => void download(false)}>
          <Download className="h-3.5 w-3.5" />
          {meta.ext.toUpperCase()}
        </Button>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function fileName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|#%&{}$!'`]+/g, '').replace(/\s+/g, '-').slice(0, 60).replace(/^-+|-+$/g, '') || 'easier';
  return `${base}.${ext}`;
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

function mapError(status: number, json: unknown, t: Dict): string {
  const code = (json as { code?: string } | null)?.code;
  switch (code) {
    case 'not_configured': return t.studioNotConfigured;
    case 'no_credits': return t.studioNoCredits;
    case 'rate_limited': return t.studioRateLimited;
    case 'timeout': return t.studioTimeout;
    case 'invalid_key': return t.studioInvalidKey;
    case 'too_large': return t.studioTooLarge;
    default: return status === 401 ? t.studioSignIn : t.studioError;
  }
}

function EmptyState() {
  const { t, lang } = useSettings();
  const rtl = lang === 'ar';
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-extrabold">{t.studioEmpty}</h2>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted-fg">{t.studioEmptyDesc}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {[
          { icon: FileText, label: t.studioChipDoc },
          { icon: Presentation, label: t.studioChipSlides },
          { icon: Palette, label: t.studioChipDesign },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className={cn('flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3 py-1.5 text-[12px] font-bold text-muted-fg', rtl && 'flex-row-reverse')}>
            <Icon className="h-3.5 w-3.5 text-primary" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
