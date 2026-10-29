const fs = require('fs');
const path = require('path');
const root = 'C:/Users/עאמר/Documents/GitHub/appy';
const p = path.join(root, 'src/app/(app)/document/[id]/page.tsx');
let s = fs.readFileSync(p, 'utf8');
const reps = [];

function rep(oldStr, newStr, tag) {
  if (!s.includes(oldStr)) { console.log('NOT FOUND:', tag); process.exit(1); }
  s = s.replace(oldStr, newStr);
  reps.push(tag);
}

/* ---------- 1. bigger flashcards ---------- */
rep(
  "className={cn('preserve-3d relative h-[240px] w-full cursor-pointer', flipped && 'flip-y')}",
  "className={cn('preserve-3d relative h-[270px] w-full cursor-pointer', flipped && 'flip-y')}",
  'card height'
);
rep(
  '<p className="mt-3 flex-1 overflow-y-auto text-[15.5px] font-semibold leading-relaxed">{card.q}</p>',
  '<p className="mt-3 flex-1 overflow-y-auto text-[17.5px] font-semibold leading-relaxed">{card.q}</p>',
  'card question'
);
rep(
  '<p className="flex-1 overflow-y-auto text-[15px] leading-relaxed text-muted-fg">{card.a}</p>',
  '<p className="flex-1 overflow-y-auto text-[16.5px] leading-relaxed text-muted-fg">{card.a}</p>',
  'card answer'
);
rep(
  '<span className="text-[12px] text-muted-fg">⟳ {lang === \'ar\' ? \'انقر للقلب\' : \'Tap to flip\'}</span>',
  '<span className="text-[13px] text-muted-fg">⟳ {lang === \'ar\' ? \'انقر للقلب\' : \'Tap to flip\'}</span>',
  'flip hint'
);
rep(
  '<span className="w-fit rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-extrabold text-primary">{index + 1}</span>',
  '<span className="w-fit rounded-full bg-primary/12 px-2.5 py-1 text-[12.5px] font-extrabold text-primary">{index + 1}</span>',
  'card number'
);
rep(
  "'flex-1 rounded-lg border px-1 py-1.5 text-[11.5px] font-bold transition',",
  "'flex-1 rounded-lg border px-1 py-2 text-[13px] font-bold transition',",
  'rating buttons'
);

/* ---------- 2. Arabic voice + voice picker ---------- */
const oldAudioState = `  const synthRef = useRef<SpeechSynthesis | null>(null);
`;
const newAudioState = `  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState('');
`;
rep(oldAudioState, newAudioState, 'audio state');

const oldSpeak = `  const speak = () => {
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
  };`;
const newSpeak = `  /* --- voices: list system voices, auto-pick Arabic, remember choice --- */
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(\`easier:voice:\${docLang}\`);
    if (saved) setVoiceName(saved);
  }, [docLang]);

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
    try { localStorage.setItem(\`easier:voice:\${docLang}\`, name); } catch { /* ignore */ }
    if (speaking) { synthRef.current?.cancel(); setSpeaking(false); }
  };`;
rep(oldSpeak, newSpeak, 'speak + voice logic');

/* ---------- 3. Audio tab UI: voice picker ---------- */
const oldAudioTab = `      {tab === 'audio' && (
        <Card className="animate-fade-up mt-5 p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={speak}>
              {speaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {speaking ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'تشغيل' : 'Play')}
            </Button>
            <span className="text-[13.5px] text-muted-fg">{docLang === 'ar' ? 'تشغيل الملخص الصوتي' : 'Plays the summary aloud'}</span>
          </div>`;
const newAudioTab = `      {tab === 'audio' && (
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
          {voices.length > 0 && <p className="mt-1.5 text-[12.5px] text-muted-fg">{t.voiceHint}</p>}`;
rep(oldAudioTab, newAudioTab, 'audio tab UI');

fs.writeFileSync(p, s);
console.log('doc page patched:', reps.join(', '));
