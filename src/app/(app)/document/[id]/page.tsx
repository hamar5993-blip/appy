'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSettings, stageName } from '@/components/settings';
import { Button, Card, Spinner, Badge } from '@/components/ui';
import type { Document } from '@/types';
import { toast } from 'sonner';
import { cn, trunc } from '@/lib/utils';
import { STAGES, type StageKey } from '@/lib/i18n';
import { ArrowLeft, FileText, Sparkles, SquarePen, AudioLines, BrainCircuit,
  List, Gavel, ScrollText, Download, Play, Pause, Volume2 } from 'lucide-react';

/* ---------------- NLP helpers (same engine as original) ---------------- */
const STOP = {
  en: new Set('the a an and or but of to in on at for with by from as is are was were be been being it its this that these those he she they them their we our you your i his her him us not no nor so if then than too very can will just should now also into about over under between through during before after above below up down out off again further once here there when where why how all any both each few more most other some such only own same what which who whom has have had having does did doing would could ought might must shall may upon within without per via etc'.split(' ')),
  ar: new Set('من في على إلى عن أن إن أو أم ثم حتى إذا لكن بل لا ما لم لن هل قد كل بعض غير بين عند عندما حيث هذا هذه ذلك تلك هو هي هم هن نحن أنت أنتم كان كانت يكون تكون مع بعد قبل فوق تحت أمام خلف أيضا أيضًا جدا جدًا كذلك فيه فيها منه منها إليه إليها به بها له لها الذي التي الذين أي وهو وقد لقد'.split(' ')),
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
  const { t, lang, toggleTheme } = useSettings();
  const [doc, setDoc] = useState<Document | null>(null);
  const [stage, setStage] = useState<StageKey>('high');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'summary' | 'cards' | 'audio' | 'visual'>('summary');
  const [mode, setMode] = useState<'comprehensive' | 'bullets' | 'legal'>('comprehensive');
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data: authUser }, { data }, { data: profile }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from('documents').select('*').eq('id', params.id).single(),
          supabase.from('profiles').select('stage').then((r: any) => r),
        ]);
        if (!alive) return;
        if (data) {
          setDoc(data);
          setMode('comprehensive');
        }
        if (profile?.data?.[0]?.stage) setStage(profile.data[0].stage);
        else if (authUser.user?.id) {
          const p = await supabase.from('profiles').select('stage').eq('id', authUser.user.id).single();
          if (p.data?.stage) setStage(p.data.stage);
        }
      } catch {
        toast.error('Document not found');
        router.replace('/library');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [params.id, router]);

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

  const speak = () => {
    const synth = synthRef.current;
    if (!synth || !summarized.sentences.length) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(summarized.sentences.join(' '));
    u.lang = docLang === 'ar' ? 'ar-SA' : 'en-US';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  const ratedCount = Object.keys(ratings).length;

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
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => router.push('/library')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-edge bg-surface transition hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-4.5 w-4.5 rtl:rotate-180" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{doc.title}</h1>
            <p className="mt-0.5 text-[13px] text-muted-fg">
              {doc.pages} {lang === 'ar' ? 'صفحة' : 'pages'} · {words.toLocaleString()} {lang === 'ar' ? 'كلمة' : 'words'} · {detectLang(doc.text) === 'ar' ? 'عربي' : 'English'} · {stageName(stage, lang)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/upload')}>
          <Sparkles className="h-4 w-4" />
          + New
        </Button>
      </div>

      {/* Tabs */}
      <nav className="mt-7 flex gap-1.5 overflow-x-auto rounded-2xl bg-edge/50 p-1.5 pb-2">
        {TABS.map(({ id, icon: Icon, en, ar }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[13.5px] font-bold transition-all',
              tab === id ? 'bg-linear-to-r from-primary to-[var(--primary-2)] text-white shadow-[0_4px_12px_rgba(99,102,241,.3)]' : 'text-muted-fg hover:bg-surface hover:text-text'
            )}
          >
            <Icon className="h-4 w-4" />
            {lang === 'ar' ? ar : en}
          </button>
        ))}
      </nav>

      {/* --------- Summary tab --------- */}
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
                  onClick={() => setMode(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition',
                    mode === id ? 'border-primary bg-primary/10 text-primary' : 'border-edge bg-surface text-muted-fg hover:border-primary/40 hover:text-text'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>

          <Card className="mt-5 p-7">
            {summarized.sentences.length === 0 ? (
              <p className="text-sm text-muted-fg">{t.noSummary}</p>
            ) : mode === 'bullets' || mode === 'legal' ? (
              <ul className={cn('s-list text-[15px]', mode === 'legal' && 'legal')}>
                {summarized.sentences.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            ) : (
              <div className="space-y-4 text-[15.5px] leading-[1.9]">
                {chunk(summarized.sentences, 3).map((group, i) => (
                  <p key={i}>{group.join(' ')}</p>
                ))}
              </div>
            )}

            <div className="mt-7 border-t border-dashed border-edge pt-5">
              <h4 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-fg">{t.keyTerms}</h4>
              <div className="flex flex-wrap gap-2">
                {summarized.keywords.map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --------- Flashcards tab --------- */}
      {tab === 'cards' && (
        <div className="animate-fade-up mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted-fg">
              {t.cardCount(flashcards.length)} · {t.rateLabel}: {ratedCount}/{flashcards.length}
            </p>
            <Badge>
              <Sparkles className="h-3 w-3" />
              {t.regenerate}
            </Badge>
          </div>

          {flashcards.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-fg">
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
            <Button onClick={speak} loading={speaking && false}>
              {speaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {speaking ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'تشغيل' : 'Play')}
            </Button>
            <div className="flex items-center gap-1.5 rounded-full border border-edge px-4 py-2" style={{ display: 'none' }}>
              <AudioLines className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-fg">{docLang === 'ar' ? 'تشغيل الملخص الصوتي' : 'Plays the summary aloud'}</span>
          </div>
          <div className="mt-6 max-h-[420px] overflow-y-auto rounded-xl border border-edge bg-background p-6 text-[15.5px] leading-[2.1]">
            {summarized.sentences.join(' ') || t.noSummary}
          </div>
        </Card>
      )}

      {/* --------- Visual tab --------- */}
      {tab === 'visual' && (
        <Card className="animate-fade-up mt-5 p-10 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
            <BrainCircuit className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-bold">{lang === 'ar' ? 'الخرائط البصرية' : 'Visual Maps'}</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-fg">
            {lang === 'ar' ? 'الخرائط الذهنية والخطوط الزمنية قادمة قريبًا — ستُبنى تلقائيًا من محتوى المستند.' : 'Mind maps, timelines and process flows are coming soon — built automatically from document content.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {summarized.keywords.slice(0, 8).map((k) => <Badge key={k}>{k}</Badge>)}
          </div>
        </Card>
      )}
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
      <div className={cn('preserve-3d relative h-[230px] w-full cursor-pointer', flipped && 'flip-y')} onClick={onFlip}>
        {/* Front */}
        <div className="backface-hidden absolute inset-0 flex flex-col rounded-2xl border border-edge bg-primary/[.045] p-4">
          <span className="w-fit rounded-full bg-primary/12 px-2.5 py-1 text-[10.5px] font-extrabold text-primary">{index + 1}</span>
          <p className="mt-3 flex-1 overflow-y-auto text-[14px] font-semibold leading-relaxed">{card.q}</p>
          <span className="text-[11px] text-muted-fg">⟳ {lang === 'ar' ? 'انقر للقلب' : 'Tap to flip'}</span>
        </div>
        {/* Back */}
        <div className="backface-hidden flip-y absolute inset-0 flex flex-col rounded-2xl border border-edge bg-surface p-4" onClick={(e) => e.stopPropagation()}>
          <p className="flex-1 overflow-y-auto text-[13.5px] leading-relaxed text-muted-fg">{card.a}</p>
          <div className="mt-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            {(['hard', 'medium', 'easy'] as const).map((r) => (
              <button
                key={r}
                onClick={(e) => { e.stopPropagation(); onRate(r); }}
                className={cn(
                  'flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-bold transition',
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
