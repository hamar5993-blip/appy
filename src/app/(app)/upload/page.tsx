'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/components/settings';
import { Button, Card } from '@/components/ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Upload, FileText, Sparkles, BookOpen, AudioLines, BrainCircuit, SquarePen, ArrowLeft } from 'lucide-react';

const FEATURES = [
  { icon: SquarePen, key: 'f1' },
  { icon: AudioLines, key: 'f2' },
  { icon: BrainCircuit, key: 'f3' },
  { icon: BookOpen, key: 'f4' },
] as const;

export default function UploadPage() {
  const router = useRouter();
  const { t, lang } = useSettings();
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractPdf = async (file: File) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const max = Math.min(pdf.numPages, 70);
    let text = '';
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      text += (tc.items as any[]).map((it) => it.str).join(' ') + '\n\n';
      setProgress(Math.round((i / max) * 100));
    }
    return { text: text.trim(), pages: pdf.numPages };
  };

  const extractDocx = async (file: File) => {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  };

  const saveDocument = async (title: string, text: string, pages: number) => {
    setStep(2);
    setProgress(100);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title: title.slice(0, 80),
        text,
        pages,
        word_count: text.trim().split(/\s+/).length,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const processFile = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setStep(1);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let text = '';
      let pages = 1;

      if (ext === 'pdf') {
        const r = await extractPdf(file);
        text = r.text;
        pages = r.pages;
      } else if (ext === 'docx' || ext === 'doc') {
        text = await extractDocx(file);
        pages = Math.max(1, Math.round(text.split(/\s+/).length / 300));
      } else if (ext === 'txt' || ext === 'md') {
        text = await file.text();
        pages = Math.max(1, Math.round(text.split(/\s+/).length / 300));
      } else {
        toast.error(lang === 'ar' ? 'صيغة غير مدعومة. استخدم PDF أو DOCX أو TXT.' : 'Unsupported format. Use PDF, DOCX or TXT.');
        setBusy(false);
        return;
      }

      if (text.length < 60) {
        toast.error(lang === 'ar' ? 'لم نتمكن من استخراج نص مقروء.' : "Couldn't extract readable text from this document.");
        setBusy(false);
        return;
      }

      const id = await saveDocument(file.name.replace(/\.[^.]+$/, ''), text, pages);
      toast.success(t.ready);
      router.push(`/document/${id}`);
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
      setBusy(false);
    }
  };

  const processPaste = async () => {
    const text = pasteText.trim();
    if (text.length < 200) {
      toast.error(lang === 'ar' ? 'يرجى لصق نص أطول (~٢٠٠ حرف).' : 'Please paste a longer text (~200 characters).');
      return;
    }
    setBusy(true);
    try {
      const pages = Math.max(1, Math.round(text.split(/\s+/).length / 300));
      const id = await saveDocument(pasteTitle.trim() || text.split(/\s+/).slice(0, 6).join(' '), text, pages);
      toast.success(t.ready);
      router.push(`/document/${id}`);
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
      setBusy(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Processing overlay ---------- */
  if (busy) {
    return (
      <div className="fixed inset-0 z-[200] grid place-items-center p-4" style={{ background: 'rgba(8,10,22,.55)', backdropFilter: 'blur(8px)' }}>
        <Card className="animate-fade-up w-full max-w-sm p-8 text-center">
          <div className="relative mx-auto mb-6 h-20 w-20">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-edge border-t-primary" />
            <div className="absolute inset-0 grid place-items-center text-2xl">📄</div>
          </div>
          <h3 className="font-extrabold">{step === 1 ? t.step1 : t.step2}</h3>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-edge">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] transition-all duration-300"
              style={{ width: `${step === 1 ? Math.max(8, progress) : 100}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-fg">{progress}%</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[27px]">{t.uploadTitle}</h1>
          <p className="mt-1 text-sm text-muted-fg">{t.appTagline}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/library')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t.library}
        </Button>
      </div>

      {/* Segmented control */}
      <div className="mx-auto mt-8 max-w-xs rounded-2xl bg-edge/60 p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {(['file', 'paste'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all',
                mode === m ? 'bg-surface text-primary shadow-sm' : 'text-muted-fg hover:text-text'
              )}
            >
              {m === 'file' ? <Upload className="h-4 w-4" /> : <SquarePen className="h-4 w-4" />}
              {m === 'file' ? t.fileMode : t.pasteMode}
            </button>
          ))}
        </div>
      </div>

      {mode === 'file' ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group mx-auto mt-8 cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300',
            dragging ? 'scale-[1.01] border-primary bg-primary/5' : 'border-edge bg-surface hover:border-primary/50'
          )}
        >
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-linear-to-br from-primary/15 to-[var(--primary-2)]/20 transition-transform group-hover:scale-110">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold">{t.dropTitle}</h3>
          <p className="mt-1 text-sm text-muted-fg">{t.dropSub}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
          />
          <Button
            className="mt-6"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            <FileText className="h-4 w-4" />
            {t.browseFiles}
          </Button>
        </div>
      ) : (
        <Card className="mx-auto mt-8 max-w-2xl p-6">
          <input
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            placeholder={t.pasteTitlePh}
            className="mb-3 w-full rounded-xl border border-edge bg-background px-4 py-2.5 text-sm font-semibold transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t.pastePh}
            rows={9}
            className="w-full resize-y rounded-xl border border-edge bg-background px-4 py-3 text-sm leading-relaxed transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          <div className="mt-4 flex items-center justify-between">
            <span className={cn('text-xs text-muted-fg', pasteText.length >= 200 && 'font-semibold text-emerald-500')}>
              {pasteText.length.toLocaleString()} / 200+
            </span>
            <Button onClick={processPaste} loading={busy}>
              <Sparkles className="h-4 w-4" />
              {t.pasteGo}
            </Button>
          </div>
        </Card>
      )}

      {/* Feature strip */}
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEATURES.map(({ icon: Icon, key }) => (
          <Card key={key} className="flex flex-col items-center gap-2.5 p-5 transition hover:-translate-y-1 hover:shadow-[0_14px_30px_-14px_rgba(99,102,241,.28)]">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <p className="text-center text-[13px] font-bold leading-snug">{t[key]}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
