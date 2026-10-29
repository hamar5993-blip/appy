'use client';

/* Document workspace: AI summary (editable), flashcards, audio tutor and an
   interactive mind map built locally from the document text. */

import { useEffect, useState, useMemo, useRef, Suspense, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSettings, stageName } from '@/components/settings';
import { Button, Card, Spinner, Badge } from '@/components/ui';
import type { Document } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { STAGES, type StageKey } from '@/lib/i18n';
import { ArrowLeft, FileText, Sparkles, SquarePen, Volume2, BrainCircuit,
  List, Gavel, ScrollText, Download, Play, Pause, RotateCcw, Check, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

/* ---------------- NLP helpers (same engine as original) ---------------- */
const STOP = {
  en: new Set('the a an and or but of to in on at for with by from as is are was were be been being it its this that these those he she they them their we our you your i his her him us not no nor so if then than too very can will just should now also into about over under between through during before after above below up down out off again further once here there when where why how all any both each few more most other some such only own same what which who whom has have had having does did doing would could ought might must shall may upon within without per via etc'.split(' ')),
  ar: new Set('من في على إلى عن أن إن أو أم ثم حتى إذا لكن بل لا ما لم لن هل قد كل بعض غير بين عند عندما حيث هذا هذه ذلك تلك هو هي هم هن نحن أنت أنتم كان كانت يكون تكون مع بعد قبل فوق تحت أمام خلف أيضا أيضًا جدا جدًا كذلك فيه فيها منه منها إليه إليها به بها له الذي التي الذين أي وهو وقد لقد'.split(' ')),
};
const LEGAL_WORDS = {
  en: ['law','act','article','section','regulation','statute','clause','right','rights','court','legal','shall','provision','defined','means','refers','liability','contract'],
  ar: ['المادة','القانون','اللائحة','النظام','الحق','الحقوق','المحكمة','ينص','تنص','تعريف','يعرف','البند','الفقرة','الالتزام','العقد','الجزاء'],
};

const detectLang = (text: string) =>
  ((text.match(/[\u0600-\u06FF]/g) || []).length > (text.match(/[A-Za-z]/g) || []).length) ? 'ar' : 'en';

const splitSentences = (text: string) =>
  (text.replace(/\s+/g, ' ').match(/[^.!?؟۔]+[.!?؟۔]+|[^.!?؟۔]+$/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.split(' ').length >= 3 && s.length >= 15);

const tokenize = (text: string, lang: 'en' | 'ar') =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((w) => w && !STOP[lang].has(w) && w.length >= 3 && !/^\d+$/.test(w));

const termFreq = (text: string, lang: 'en' | 'ar') => {
  const f: Record<string, number> = {};
  tokenize(text, lang).forEach((w) => { f[w] = (f[w] || 0) + 1; });
  return f;
};

const MODE_STAGES: Record<StageKey, { ratio: number; cards: number }> = {
  primary: { ratio: .22, cards: 8 },
  middle: { ratio: .26, cards: 10 },
  high: { ratio: .30, cards: 12 },
  university: { ratio: .34, cards: 14 },
  teacher: { ratio: .38, cards: 14 },
};

type Flashcard = { q: string; a: string };
type Rating = 'hard' | 'medium' | 'easy';
type SummaryOverride = { mode: 'comprehensive' | 'bullets' | 'legal'; text: string };

/* ---------------- Tabs config ---------------- */
const TABS = [
  { id: 'summary', icon: FileText, en: 'Summary', ar: 'الملخص' },
  { id: 'cards', icon: Sparkles, en: 'Flashcards', ar: 'البطاقات' },
  { id: 'audio', icon: Volume2, en: 'Audio', ar: 'الصوت' },
  { id: 'visual', icon: BrainCircuit, en: 'Visual', ar: 'الخريطة' },
] as const;

export default function DocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 py-24">
          <Spinner />
          <p className="text-sm font-semibold text-muted-fg">Loading…</p>
        </div>
      }
    >
      <DocumentPageInner />
    </Suspense>
  );
}

function DocumentPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useSettings();
  const [doc, setDoc] = useState<Document | null>(null);
  const [stage, setStage] = useState<StageKey>('high');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'summary' | 'cards' | 'audio' | 'visual'>('summary');
  const [mode, setMode] = useState<'comprehensive' | 'bullets' | 'legal'>('comprehensive');
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [speaking, setSpeaking] = useState(false);
  /* editable summary */
  const [override, setOverride] = useState<SummaryOverride | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!alive) return;
        if (!user) {
          router.replace('/login');
          return;
        }
        /* Hard deadline: a hanging request can never leave the page spinning. */
        const withTimeout = <T,>(p: { then: (r: (v: T) => void, e: (e: any) => void) => void }, ms = 15000): Promise<T> =>
          new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ms);
            p.then(
              (v) => { clearTimeout(timer); resolve(v); },
              (e) => { clearTimeout(timer); reject(e); }
            );
          });
        const [docRes, profileRes] = await Promise.all([
          withTimeout<{ data: Document | null; error: any }>(supabase.from('documents').select('*').eq('id', params.id).single()),
          withTimeout<{ data: { stage?: StageKey } | null }>(supabase.from('profiles').select('stage').eq('id', user.id).single()).catch(
            () => ({ data: null }) as { data: { stage?: StageKey } | null }
          ),
        ]);
        const docData = docRes.data;
        const docError = docRes.error;
        const profile = profileRes.data;
        if (!alive) return;
        if (docError || !docData) {
          toast.error(t.notFound);
          router.replace('/library');
          return;
        }
        setDoc(docData);
        if (profile?.stage) setStage(profile.stage);
        try {
          const saved = localStorage.getItem(`easier:summary:${params.id}`);
          if (saved) setOverride(JSON.parse(saved));
        } catch { /* ignore corrupt local edits */ }
      } catch {
        if (!alive) return;
        toast.error(t.notFound);
        setFailed(true);
        setLoading(false);
        return;
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [params.id, router, t.notFound]);

  /* derived content */
  const docLang = useMemo(() => detectLang(doc?.text ?? ''), [doc]);
  const tuning = MODE_STAGES[stage] ?? MODE_STAGES.high;

  const summarized = useMemo(() => {
    if (!doc) return { sentences: [] as string[], keywords: [] as string[] };
    const sentences = splitSentences(doc.text);
    const freq = termFreq(doc.text, docLang);
    let pool = sentences.map((s, i) => ({ s, i, score: (tokenize(s, docLang).reduce((a, w) => a + (freq[w] || 0), 0)) / Math.sqrt(Math.max(1, tokenize(s, docLang).length)) }));
    if (mode === 'legal') {
      const filtered = pool.filter((o) => LEGAL_WORDS[docLang].some((w) => o.s.toLowerCase().includes(w)));
      if (filtered.length >= 3) pool = filtered;
    }
    if (mode === 'bullets') {
      const short = pool.filter((o) => o.s.length <= 220);
      if (short.length >= 3) pool = short;
    }
    const n = Math.max(3, Math.round(sentences.length * tuning.ratio));
    const picked = pool.sort((a, b) => b.score - a.score).slice(0, Math.min(n, pool.length)).sort((a, b) => a.i - b.i).map((o) => o.s);
    const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
    return { sentences: picked, keywords };
  }, [doc, docLang, mode, tuning.ratio]);

  /* ---------- editable summary ---------- */
  const generatedText = useMemo(() => {
    if (!summarized.sentences.length) return '';
    return mode === 'bullets' || mode === 'legal'
      ? summarized.sentences.map((s) => `• ${s}`).join('\n')
      : chunk(summarized.sentences, 3).map((g) => g.join(' ')).join('\n\n');
  }, [mode, summarized]);

  const shownText = override && override.mode === mode ? override.text : generatedText;

  const startEdit = () => {
    setDraft(shownText);
    setEditing(true);
  };

  const saveEdit = () => {
    setEditing(false);
    const text = draft.trim();
    if (!doc || !text) return;
    if (text === generatedText) {
      if (override?.mode === mode) resetEdit();
      return;
    }
    const next: SummaryOverride = { mode, text };
    setOverride(next);
    try { localStorage.setItem(`easier:summary:${doc.id}`, JSON.stringify(next)); } catch { /* storage unavailable */ }
    toast.success(lang === 'ar' ? 'تم حفظ تعديلك على الملخص' : 'Your summary edit was saved');
  };

  const resetEdit = useCallback(() => {
    setOverride(null);
    setEditing(false);
    try { if (doc) localStorage.removeItem(`easier:summary:${doc.id}`); } catch { /* ignore */ }
    toast.success(t.resetSummary);
  }, [doc, t.resetSummary]);

  const flashcards = useMemo<Flashcard[]>(() => {
    if (!doc) return [];
    const EN_DEF = /^(.{3,70}?)\s+(?:is|are|means|refers to|is defined as|is known as|is called)\s+(.{15,240})$/i;
    const AR_DEF = /^(.{3,70}?)\s+(?:هو|هي|يعني|تشير إلى|يُعرف بأنه|تُعرَّف بأنها|يعرف بأنه|تعرف بأنها|تعد|يعد)\s+(.{15,240})$/;
    const defRe = docLang === 'ar' ? AR_DEF : EN_DEF;
    const sentences = splitSentences(doc.text);
    const freq = termFreq(doc.text, docLang);
    const cards: Flashcard[] = [];

    for (const s of sentences) {
      const m = s.trim().match(defRe);
      if (m) {
        const term = m[1].trim().replace(/^[-–—:،\s]+/, '');
        const pred = m[2].trim();
        if (term.length < 3 || pred.length < 12) continue;
        cards.push({ q: docLang === 'ar' ? `ما المقصود بـ«${term}»؟` : `What is "${term}"?`, a: pred });
        if (cards.length >= tuning.cards) break;
      }
    }
    if (cards.length < 6) {
      const ranked = sentences.map((s) => ({ s, score: tokenize(s, docLang).reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(Math.max(1, tokenize(s, docLang).length)) })).sort((a, b) => b.score - a.score);
      for (const o of ranked) {
        const toks = tokenize(o.s, docLang);
        if (!toks.length) continue;
        const key = toks.reduce((a, b) => (freq[b] > freq[a] ? b : a));
        if (key.length < 4) continue;
        const blanked = o.s.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');
        if (!blanked.includes('_____')) continue;
        cards.push({ q: docLang === 'ar' ? 'أكمل الفراغ: ' + blanked : 'Fill in the blank: ' + blanked, a: key });
        if (cards.length >= Math.max(6, tuning.cards - 2)) break;
      }
    }
    return cards;
  }, [doc, docLang, tuning.cards]);

  /* audio */
  useEffect(() => {
    if (typeof window !== 'undefined') synthRef.current = window.speechSynthesis;
    return () => { synthRef.current?.cancel(); };
  }, []);

  /* --- voices: list system voices, auto-pick Arabic, remember choice --- */
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`easier:voice:${docLang}`);
    if (saved) setVoiceName(saved);
  }, [docLang]);

  const arabicVoiceAvailable = voices.some((v) => v.lang.toLowerCase().startsWith('ar'));

  const testVoice = () => {
    const synth = synthRef.current;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); }
    const u = new SpeechSynthesisUtterance(t.voiceTestLine);
    u.lang = 'ar-SA';
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; }
    else {
      const ar = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
      if (ar) { u.voice = ar; u.lang = ar.lang; }
    }
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
  };

  /* Prefer the picked voice, then an exact language match, then anything Arabic/English,
     otherwise let the browser choose by u.lang. */
  const chosenVoice =
    voices.find((v) => v.name === voiceName) ||
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(docLang === 'ar' ? 'ar' : 'en')) ||
    (docLang === 'ar'
      ? voices.find((v) => v.lang.toLowerCase().startsWith('a') ) // any Arabic-adjacent voice
      : null) ||
    null;

  const speak = () => {
    const synth = synthRef.current;
    if (!synth || !summarized.sentences.length) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    if (docLang === 'ar' && voices.length > 0 && !arabicVoiceAvailable) {
      toast.warning(t.noArabicVoice);
    }
    /* split into short chunks — many browsers cut long utterances and some
       lose the onend event, and chunking also lets the voice start sooner */
    const text = summarized.sentences.join(' ');
    const pieces: string[] = [];
    let buf = '';
    for (const w of text.split(' ')) {
      if ((buf + ' ' + w).length > 180) { pieces.push(buf.trim()); buf = w; }
      else buf = (buf + ' ' + w).trim();
    }
    if (buf) pieces.push(buf.trim());
    synth.cancel();
    pieces.forEach((piece, i) => {
      const u = new SpeechSynthesisUtterance(piece);
      u.lang = docLang === 'ar' ? 'ar-SA' : 'en-US';
      if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; }
      u.rate = 0.95;
      if (i === pieces.length - 1) {
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
      }
      synth.speak(u);
    });
    setSpeaking(true);
  };

  const pickVoice = (name: string) => {
    setVoiceName(name);
    try { localStorage.setItem(`easier:voice:${docLang}`, name); } catch { /* ignore */ }
    if (speaking) { synthRef.current?.cancel(); setSpeaking(false); }
  };

  const ratedCount = Object.keys(ratings).length;

  if (failed) {
    return (
      <Card className="animate-fade-up mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-bold">{t.notFound}</p>
        <Button className="mt-5" onClick={() => router.push('/library')}>{t.library}</Button>
      </Card>
    );
  }
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Spinner />
        <p className="text-sm font-semibold text-muted-fg">{t.loadingDoc}</p>
      </div>
    );
  }
  if (!doc) return null;

  const words = doc.text.trim().split(/\s+/).length;

  return (
    <div className="animate-fade-up">
      {/* Doc header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <button
            onClick={() => router.push('/library')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-edge bg-surface transition hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-4.5 w-4.5 rtl:rotate-180" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{doc.title}</h1>
            <p className="mt-0.5 text-[14.5px] text-muted-fg">
              {doc.pages} {lang === 'ar' ? 'صفحة' : 'pages'} · {words.toLocaleString()} {lang === 'ar' ? 'كلمة' : 'words'} · {detectLang(doc.text) === 'ar' ? 'عربي' : 'English'} · {stageName(stage, lang)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push('/upload')}>
          <Sparkles className="h-4 w-4" />
          + {lang === 'ar' ? 'جديد' : 'New'}
        </Button>
      </div>

      {/* Tabs */}
      <nav className="mt-7 flex gap-1.5 overflow-x-auto rounded-2xl bg-edge/50 p-1.5 pb-2">
        {TABS.map(({ id, icon: Icon, en, ar }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setEditing(false); }}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[15px] font-bold transition-all',
              tab === id ? 'bg-linear-to-r from-primary to-[var(--primary-2)] text-white shadow-[0_4px_12px_rgba(99,102,241,.3)]' : 'text-muted-fg hover:bg-surface hover:text-text'
            )}
          >
            <Icon className="h-4 w-4" />
            {lang === 'ar' ? ar : en}
          </button>
        ))}
      </nav>

      {/* --------- Summary tab (editable) --------- */}
      {tab === 'summary' && (
        <div className="animate-fade-up">
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'comprehensive', label: t.modeComp, icon: ScrollText },
                { id: 'bullets', label: t.modeBullets, icon: List },
                { id: 'legal', label: t.modeLegal, icon: Gavel },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMode(id); setEditing(false); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] font-semibold transition',
                    mode === id ? 'border-primary bg-primary/10 text-primary' : 'border-edge bg-surface text-muted-fg hover:border-primary/40 hover:text-text'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {!editing && (
                <Button variant="outline" size="md" onClick={startEdit}>
                  <SquarePen className="h-4 w-4" />
                  {t.editSummary}
                </Button>
              )}
              <Button variant="outline" size="md" onClick={() => window.print()}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          <Card className="mt-5 p-7">
            {editing ? (
              /* ---------- edit mode ---------- */
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <Badge><SquarePen className="h-3 w-3" />{t.editSummary}</Badge>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" />{t.cancelEdit}
                    </Button>
                    <Button size="sm" onClick={saveEdit}>
                      <Check className="h-4 w-4" />{t.saveSummary}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-xl border border-edge bg-background p-5 text-[16px] leading-[1.9] transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  dir={docLang === 'ar' ? 'rtl' : 'ltr'}
                />
                <p className="mt-2 text-[12.5px] text-muted-fg">
                  {lang === 'ar' ? 'افصل الفقرات بسطرين فارغين، وابدأ كل نقطة بعلامة •' : 'Separate paragraphs with a blank line; start bullet lines with •'}
                </p>
              </>
            ) : shownText ? (
              /* ---------- view mode ---------- */
              <>
                {override && override.mode === mode && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Badge>{t.edited}</Badge>
                    <Button variant="ghost" size="sm" onClick={resetEdit}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t.resetSummary}
                    </Button>
                  </div>
                )}
                {mode === 'bullets' || mode === 'legal' ? (
                  <ul className={cn('s-list text-[16.5px]', mode === 'legal' && 'legal')}>
                    {shownText.split('\n').map((line, i) => {
                      const clean = line.replace(/^[•\s]+/, '').trim();
                      return clean ? <li key={i}>{clean}</li> : null;
                    })}
                  </ul>
                ) : (
                  <div className="summary-text space-y-4 text-[17px] leading-[1.95]" dir={docLang === 'ar' ? 'rtl' : 'ltr'}>
                    {shownText.split('\n\n').map((p, i) => <p key={i}>{p.split('\n').join(' ')}</p>)}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[15px] text-muted-fg">{t.noSummary}</p>
            )}

            {summarized.keywords.length > 0 && (
              <div className="mt-7 border-t border-dashed border-edge pt-5">
                <h4 className="mb-3 text-[12px] font-extrabold uppercase tracking-wider text-muted-fg">{t.keyTerms}</h4>
                <div className="flex flex-wrap gap-2">
                  {summarized.keywords.map((k) => (
                    <Badge key={k}>{k}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --------- Flashcards tab --------- */}
      {tab === 'cards' && (
        <div className="animate-fade-up mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14.5px] font-semibold text-muted-fg">
              {t.cardCount(flashcards.length)} · {t.rateLabel}: {ratedCount}/{flashcards.length}
            </p>
            <Badge>
              <Sparkles className="h-3 w-3" />
              {t.regenerate}
            </Badge>
          </div>

          {flashcards.length === 0 ? (
            <Card className="p-10 text-center text-[15px] text-muted-fg">
              {lang === 'ar' ? 'لم نتمكن من توليد بطاقات لهذا المستند.' : "Couldn't generate flashcards for this document."}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {flashcards.map((c, i) => (
                <FlashCard
                  key={i}
                  index={i}
                  card={c}
                  flipped={flipped.has(i)}
                  rating={ratings[i]}
                  onFlip={() => setFlipped((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
                  onRate={(r) => setRatings((prev) => ({ ...prev, [i]: prev[i] === r ? (undefined as any) : r }))}
                  lang={lang === 'ar' ? 'ar' : 'en'}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------- Audio tab --------- */}
      {tab === 'audio' && (
        <Card className="animate-fade-up mt-5 p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={speak}>
              {speaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {speaking ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'تشغيل' : 'Play')}
            </Button>
            <span className="text-[13.5px] text-muted-fg">{docLang === 'ar' ? 'تشغيل الملخص الصوتي' : 'Plays the summary aloud'}</span>
          </div>

          {/* narrator picker — Arabic voices from the system appear first */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex shrink-0 items-center gap-2 text-[13.5px] font-bold">
              <Volume2 className="h-4 w-4 text-primary" />
              {t.voice}
            </label>
            {voices.length > 0 ? (
              <select
                value={chosenVoice?.name ?? voiceName ?? ''}
                onChange={(e) => pickVoice(e.target.value)}
                className="w-full rounded-xl border border-edge bg-background px-3.5 py-2.5 text-[14px] font-semibold transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 sm:max-w-md"
              >
                <option value="">{t.autoVoice} ({lang === 'ar' ? 'ar-SA' : 'en-US'})</option>
                {voices
                  .slice()
                  .sort((a, b) => {
                    const rank = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase().startsWith(docLang) ? 0 : v.lang.toLowerCase().startsWith(docLang === 'ar' ? 'en' : 'ar') ? 1 : 2);
                    return rank(a) - rank(b) || a.name.localeCompare(b.name);
                  })
                  .map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang}){v.localService ? '' : ' · online'}
                    </option>
                  ))}
              </select>
            ) : (
              <span className="text-[13px] text-muted-fg">{t.noVoices}</span>
            )}
          </div>
          {voices.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={testVoice}
                className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3.5 py-1.5 text-[12.5px] font-bold text-muted-fg transition hover:border-primary hover:text-primary"
              >
                <Volume2 className="h-3.5 w-3.5" />
                {t.testVoice}
              </button>
            </div>
          )}
          {docLang === 'ar' && voices.length > 0 && !arabicVoiceAvailable && (
            <div className="mt-1.5 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-600 dark:text-amber-300">
              {t.noArabicVoice}
            </div>
          )}
          <div className="summary-text mt-6 max-h-[420px] overflow-y-auto rounded-xl border border-edge bg-background p-6 text-[16.5px] leading-[2.1]">
            {summarized.sentences.join(' ') || t.noSummary}
          </div>
        </Card>
      )}

      {/* --------- Visual tab (real mind map) --------- */}
      {tab === 'visual' && (
        <div className="animate-fade-up mt-5">
          {summarized.keywords.length >= 2 ? (
            <>
              <p className="mb-3 text-[13px] text-muted-fg">{t.visualHint}</p>
              <Card className="overflow-hidden p-2">
                <MindMap
                  title={doc.title}
                  keywords={summarized.keywords.slice(0, 6)}
                  sentences={summarized.sentences}
                  lang={lang === 'ar' ? 'ar' : 'en'}
                />
              </Card>
              <div className="mt-4 flex flex-wrap gap-2">
                {summarized.keywords.slice(0, 8).map((k) => <Badge key={k}>{k}</Badge>)}
              </div>
            </>
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
                <BrainCircuit className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold">{lang === 'ar' ? 'الخرائط البصرية' : 'Visual Maps'}</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[14.5px] text-muted-fg">
                {lang === 'ar' ? 'هذا المستند قصير جدًا لبناء خريطة — جرّب مستندًا أطول أو نموذجًا جاهزًا.' : 'This document is too short to map — try a longer document or the sample set.'}
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Interactive mind map ---------------- */
const MM_W = 1000;
const MM_H = 620;
const MM_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

type Leaf = { x: number; y: number; lines: string[] };
type BranchPlan = { kw: string; color: string; x: number; y: number; leaves: Leaf[] };

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur.trim()) lines.push(cur.trim());
      if (lines.length === maxLines) break;
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (lines.length < maxLines && cur.trim()) lines.push(cur.trim());
  return lines.slice(0, maxLines);
}

function MindMap({ title, keywords, sentences, lang }: { title: string; keywords: string[]; sentences: string[]; lang: 'en' | 'ar' }) {
  const [view, setView] = useState({ x: 0, y: 0, w: MM_W });
  const dragRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  const branches = useMemo<BranchPlan[]>(() => {
    const n = Math.min(6, Math.max(3, keywords.length));
    const out: BranchPlan[] = [];
    const base = keywords.slice(0, n);
    for (let i = 0; i < n; i++) {
      const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
      const bx = MM_W / 2 + 300 * Math.cos(ang);
      const by = MM_H / 2 + 225 * Math.sin(ang);
      const related = sentences
        .filter((s) => tokenize(s, lang).includes(base[i]))
        .slice(0, 2)
        .map((s) => (s.length > 110 ? s.slice(0, 105).trim() + '…' : s.trim()));
      const fallback = sentences.slice(0, 1).map((s) => (s.length > 110 ? s.slice(0, 105) + '…' : s));
      const use = related.length ? related : fallback;
      const leaves = use.map((txt, j) => {
        const la = ang + (j === 0 ? -0.42 : 0.42) * (n > 4 ? 1 : 1.25);
        return {
          x: bx + 250 * Math.cos(la),
          y: by + 165 * Math.sin(la),
          lines: wrapLines(txt, 26, 3),
        };
      });
      out.push({ kw: base[i], color: MM_COLORS[i % MM_COLORS.length], x: bx, y: by, leaves });
    }
    return out;
  }, [keywords, sentences, lang]);

  /* clamp node positions inside the viewBox so nothing spills over */
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  branches.forEach((b) => {
    b.x = clamp(b.x, 80, MM_W - 80);
    b.y = clamp(b.y, 62, MM_H - 62);
    b.leaves.forEach((l) => {
      l.x = clamp(l.x, 115, MM_W - 115);
      l.y = clamp(l.y, 48, MM_H - 48);
    });
  });

  const zoom = (f: number) =>
    setView((v) => {
      const w = clamp(v.w * f, MM_W * 0.45, MM_W * 2);
      const cx = v.x + v.w / 2;
      const cy = v.y + (v.w * MM_H) / MM_W / 2;
      return { x: cx - w / 2, y: cy - (w * MM_H) / MM_W / 2, w };
    });

  const reset = () => setView({ x: 0, y: 0, w: MM_W });

  const onWheel = useCallback((e: React.WheelEvent) => {
    setView((v) => {
      const f = e.deltaY < 0 ? 0.88 : 1.12;
      const w = clamp(v.w * f, MM_W * 0.45, MM_W * 2);
      const cx = v.x + v.w / 2;
      const cy = v.y + (v.w * MM_H) / MM_W / 2;
      return { x: cx - w / 2, y: cy - (w * MM_H) / MM_W / 2, w };
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setView((v) => ({ ...v, x: clamp(v.x + dx, -MM_W * 1.4, MM_W * 1.1), y: clamp(v.y + dy, -MM_H * 1.4, MM_H * 1.1) }));
  }, []);

  const vh = view.w * (MM_H / MM_W);

  return (
    <div className="relative select-none">
      <svg
        viewBox={`${view.x} ${view.y} ${view.w} ${vh}`}
        className="block h-auto w-full touch-none"
        onWheel={onWheel}
        onPointerDown={(e) => {
          (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          if (!rect.width) return;
          const k = view.w / rect.width;
          panBy(d.vx + (e.clientX - d.sx) * -k, d.vy + (e.clientY - d.sy) * -k);
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        {/* connections */}
        {branches.map((b, i) => (
          <g key={`e-${i}`}>
            <path
              d={`M ${MM_W / 2} ${MM_H / 2} Q ${(MM_W / 2 + b.x) / 2} ${(MM_H / 2 + b.y) / 2 - 24} ${b.x} ${b.y}`}
              stroke={b.color}
              strokeWidth={2}
              fill="none"
              opacity={0.5}
            />
            {b.leaves.map((l, j) => (
              <line key={`l-${j}`} x1={b.x} y1={b.y} x2={l.x} y2={l.y} stroke={b.color} strokeWidth={1} opacity={0.35} strokeDasharray="4 3" />
            ))}
          </g>
        ))}

        {/* leaf note cards */}
        {branches.flatMap((b, i) =>
          b.leaves.map((l, j) => {
            const bh = l.lines.length * 18 + 14;
            return (
              <g key={`leaf-${i}-${j}`}>
                <rect
                  x={l.x - 110}
                  y={l.y - bh / 2 - 8}
                  width={220}
                  height={bh}
                  rx={12}
                  fill="var(--surface)"
                  opacity={0.95}
                  style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.08))' }}
                />
                {l.lines.map((t, k) => (
                  <text
                    key={k}
                    x={l.x}
                    y={l.y - bh / 2 - 8 + 18 + k * 18}
                    textAnchor="middle"
                    fontSize={12.5}
                    fill="var(--muted)"
                    style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
                  >
                    {t}
                  </text>
                ))}
              </g>
            );
          })
        )}

        {/* root node */}
        <circle cx={MM_W / 2} cy={MM_H / 2} r={56} fill="var(--primary)" opacity={0.14} />
        <circle cx={MM_W / 2} cy={MM_H / 2} r={44} fill="var(--primary)" />
        {wrapLines(title.length > 64 ? title.slice(0, 58) + '…' : title, 14, 2).map((t, k, arr) => (
          <text
            key={`rt-${k}`}
            x={MM_W / 2}
            y={MM_H / 2 + 4 + (k - (arr.length - 1) / 2) * 15}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight={800}
            fill="#fff"
            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
          >
            {t}
          </text>
        ))}

        {/* branch nodes — tap one to zoom on it */}
        {branches.map((b, i) => (
          <g
            key={`b-${i}`}
            className="cursor-pointer"
            onClick={() => {
              const w = MM_W / 2.2;
              setView({ x: clamp(b.x - w / 2, -MM_W, MM_W), y: clamp(b.y - (w * MM_H / MM_W) / 2, -MM_H, MM_H), w });
            }}
          >
            <ellipse cx={b.x} cy={b.y} rx={Math.max(56, b.kw.length * 5.4 + 18)} ry={32} fill={b.color} opacity={0.16} />
            <ellipse cx={b.x} cy={b.y} rx={Math.max(48, b.kw.length * 4.9 + 13)} ry={25} fill={b.color} />
            <text
              x={b.x}
              y={b.y + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={800}
              fill="#fff"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              {b.kw}
            </text>
          </g>
        ))}
      </svg>

      {/* zoom controls */}
      <div className="absolute end-3 bottom-3 flex gap-1.5">
        <button onClick={() => zoom(0.8)} className="grid h-9 w-9 place-items-center rounded-xl border border-edge bg-surface transition hover:border-primary hover:text-primary" title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => zoom(1.25)} className="grid h-9 w-9 place-items-center rounded-xl border border-edge bg-surface transition hover:border-primary hover:text-primary" title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button onClick={reset} className="grid h-9 w-9 place-items-center rounded-xl border border-edge bg-surface transition hover:border-primary hover:text-primary" title="Reset view">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Flip card component ---------------- */
function FlashCard({ index, card, flipped, rating, onFlip, onRate, lang }: {
  index: number;
  card: Flashcard;
  flipped: boolean;
  rating?: Rating;
  onFlip: () => void;
  onRate: (r: Rating) => void;
  lang: 'en' | 'ar';
}) {
  return (
    <div className="persp">
      <div className={cn('preserve-3d relative h-[270px] w-full cursor-pointer', flipped && 'flip-y')} onClick={onFlip}>
        {/* Front */}
        <div className="backface-hidden absolute inset-0 flex flex-col rounded-2xl border border-edge bg-primary/[.045] p-4">
          <span className="w-fit rounded-full bg-primary/12 px-2.5 py-1 text-[12.5px] font-extrabold text-primary">{index + 1}</span>
          <p className="mt-3 flex-1 overflow-y-auto text-[17.5px] font-semibold leading-relaxed">{card.q}</p>
          <span className="text-[13px] text-muted-fg">⟳ {lang === 'ar' ? 'انقر للقلب' : 'Tap to flip'}</span>
        </div>
        {/* Back */}
        <div className="backface-hidden flip-y absolute inset-0 flex flex-col rounded-2xl border border-edge bg-surface p-4" onClick={(e) => e.stopPropagation()}>
          <p className="flex-1 overflow-y-auto text-[16.5px] leading-relaxed text-muted-fg">{card.a}</p>
          <div className="mt-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            {(['hard', 'medium', 'easy'] as const).map((r) => (
              <button
                key={r}
                onClick={(e) => { e.stopPropagation(); onRate(r); }}
                className={cn(
                  'flex-1 rounded-lg border px-1 py-2 text-[13px] font-bold transition',
                  rating === r
                    ? r === 'hard' ? 'border-transparent bg-red-500 text-white'
                    : r === 'medium' ? 'border-transparent bg-amber-500 text-white'
                    : 'border-transparent bg-emerald-500 text-white'
                    : 'border-edge text-muted-fg hover:text-text'
                )}
              >
                {r === 'hard' ? '😕' : r === 'medium' ? '🤔' : '😊'} {lang === 'ar' ? (r === 'hard' ? 'صعب' : r === 'medium' ? 'متوسط' : 'سهل') : r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
