const fs = require('fs');
const path = require('path');
const root = 'C:/Users/עאמר/Documents/GitHub/appy';
const p = path.join(root, 'src/app/(app)/upload/page.tsx');
let s = fs.readFileSync(p, 'utf8');
const done = [];
function rep(oldStr, newStr, tag) {
  if (!s.includes(oldStr)) { console.log('NOT FOUND:', tag); process.exit(1); }
  s = s.replace(oldStr, newStr);
  done.push(tag);
}

/* import Mic icon */
rep(
  "import { Upload, FileText, Sparkles, BookOpen, AudioLines, BrainCircuit, SquarePen, ArrowLeft, FlaskConical } from 'lucide-react';",
  "import { Upload, FileText, Sparkles, BookOpen, AudioLines, BrainCircuit, SquarePen, ArrowLeft, FlaskConical, Mic } from 'lucide-react';",
  'import'
);

/* state */
rep(
  `  const fileInputRef = useRef<HTMLInputElement>(null);`,
  `  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const accumRef = useRef('');`,
  'state'
);

/* dictation logic — add before onDrop */
rep(
  `  const onDrop = useCallback((e: React.DragEvent) => {`,
  `  /* ---------- speech-to-text dictation (Web Speech API) ---------- */
  const toggleDictation = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error(t.micUnsupported);
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    setMode('paste');
    const r = new SR();
    r.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    r.continuous = true;
    r.interimResults = false;
    baseTextRef.current = pasteText;
    accumRef.current = '';
    r.onresult = (e: any) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText.trim()) {
        accumRef.current = (accumRef.current ? accumRef.current + ' ' : '') + finalText.trim();
        setPasteText(
          (baseTextRef.current ? baseTextRef.current + '\\n\\n' : '') + accumRef.current
        );
      }
    };
    r.onend = () => setListening(false);
    r.onerror = (e: any) => {
      setListening(false);
      if (e?.error === 'not-allowed') toast.error(lang === 'ar' ? 'تم رفض إذن الميكروفون.' : 'Microphone permission was denied.');
    };
    try {
      r.start();
      recogRef.current = r;
      setListening(true);
    } catch {
      toast.error(t.micUnsupported);
    }
  };

  useEffect(() => () => { try { recogRef.current?.stop(); } catch { /* ignore */ } }, []);

  const onDrop = useCallback((e: React.DragEvent) => {`,
  'dictation fn'
);

/* need useEffect import */
rep(
  "import { useState, useCallback, useRef } from 'react';",
  "import { useState, useCallback, useRef, useEffect } from 'react';",
  'react import'
);

/* mic button inside paste textarea */
rep(
  `          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t.pastePh}
            rows={9}
            className="w-full resize-y rounded-xl border border-edge bg-background px-4 py-3 text-[15px] leading-relaxed transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />`,
  `          <div className="relative">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t.pastePh}
              rows={9}
              className="w-full resize-y rounded-xl border border-edge bg-background px-4 py-3 pe-14 text-[15px] leading-relaxed transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
            <button
              type="button"
              onClick={toggleDictation}
              title={t.micDictate}
              className={cn(
                'absolute end-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-xl border transition',
                listening
                  ? 'border-red-400 bg-red-500/10 text-red-500'
                  : 'border-edge bg-surface text-muted-fg hover:border-primary hover:text-primary'
              )}
            >
              <Mic className={cn('h-4.5 w-4.5', listening && 'animate-pulse')} />
            </button>
            {listening && (
              <span className="absolute bottom-2.5 end-3 text-[12px] font-bold text-red-500 animate-pulse">
                {t.listening}
              </span>
            )}
          </div>`,
  'mic button'
);

fs.writeFileSync(p, s);
console.log('upload patched:', done.join(', '));
