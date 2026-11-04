/* AI Studio — shared contract between the chat, the model and the file
   generator. The model ends a reply that "makes" something for the user with
   a fenced ```create block holding strict JSON; /api/studio/generate turns
   that JSON into a real .docx / .pptx / SVG file. */

export type CreationKind = 'docx' | 'pptx' | 'design';

export type Creation =
  | {
      kind: 'docx';
      title: string;
      lang: 'ar' | 'en';
      intro?: string;
      sections: Array<{
        heading: string;
        paragraphs?: string[];
        bullets?: string[];
      }>;
    }
  | {
      kind: 'pptx';
      title: string;
      lang: 'ar' | 'en';
      accent?: string;
      slides: Array<{
        title: string;
        bullets?: string[];
        notes?: string;
      }>;
    }
  | {
      kind: 'design';
      title: string;
      lang: 'ar' | 'en';
      bg?: string;
      accent?: string;
      headline: string;
      subline?: string;
      bullets?: string[];
      tagline?: string;
    };

export const KIND_LABEL: Record<CreationKind, string> = {
  docx: 'Word document',
  pptx: 'PowerPoint',
  design: 'Canva-style design',
};

const KINDS: CreationKind[] = ['docx', 'pptx', 'design'];

export function systemPrompt(lang: 'ar' | 'en'): string {
  return [
    `You are Easier Studio, an AI assistant for students. You chat normally AND you can create real files: Word documents, PowerPoint presentations, and visual posters ("designs").`,
    'Rules:',
    `- Reply in the same language the user writes in (Arabic or English).`,
    '- Be concise, warm and practical. Plain text, no markdown headings or LaTeX.',
    '- When the user asks you to make, write, create or design something (a document, a presentation, slides, a poster, an infographic, a summary document, a design, ...) you MUST end your reply with exactly one fenced block, tagged "create", containing nothing but this JSON:',
    '',
    'For a Word document:',
    '```create',
    '{"kind":"docx","title":"Document title","lang":"ar","intro":"One short intro paragraph.","sections":[{"heading":"Section heading","paragraphs":["..."],"bullets":["..."]}]}',
    '```',
    '',
    'For a PowerPoint:',
    '```create',
    '{"kind":"pptx","title":"Deck title","lang":"ar","accent":"#6366f1","slides":[{"title":"Slide title","bullets":["2-5 short bullets"],"notes":"optional speaker note"}]}',
    '```',
    '',
    'For a poster / visual design:',
    '```create',
    '{"kind":"design","title":"Design name","lang":"ar","bg":"#0f172a","accent":"#6366f1","headline":"Big headline (max 8 words)","subline":"One supporting line","bullets":["Up to 4 short lines"],"tagline":"Small footer line"}',
    '```',
    '',
    'JSON rules: UTF-8 text only, double quotes, no comments, no trailing commas, no markdown inside strings (use plain text; a newline as \\n is allowed). Write REAL, complete, useful content in the requested language — never placeholders. Word documents: 3-6 sections. Presentations: 5-10 slides. Designs: keep every line short.',
    '- Emit the block ONLY when the user wants a file. For a normal question, answer plainly with no block.',
    '- Before the block, write one short friendly sentence describing what you prepared.',
    '- If the request is ambiguous, make a reasonable decision and proceed — do not ask follow-up questions first.',
    lang === 'ar'
      ? "- Always write the lang field as 'ar' when replying in Arabic, 'en' otherwise. Put all content values in Arabic when the user writes Arabic."
      : '- Put all content values in English unless the user asks for another language.',
  ].join('\n');
}

/* Extract the last ```create block from a model reply and parse+validate it.
   Returns the cleaned chat text and the creation (or null). */
export function parseCreation(answer: string): { text: string; creation: Creation | null } {
  const re = /```create\b[^\n]*\n([\s\S]*?)```/g;
  let last: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer))) last = match;

  let text = answer.trim();
  if (!last) return { text, creation: null };

  text = (answer.slice(0, last.index) + answer.slice(last.index + last[0].length)).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(last[1]);
  } catch {
    /* The model wrote a malformed block — keep the text, drop the block. */
    return { text, creation: null };
  }
  const creation = validateCreation(parsed);
  return { text, creation };
}

function validateCreation(raw: unknown): Creation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const kindRaw = obj.kind;
  if (typeof kindRaw !== 'string' || !KINDS.includes(kindRaw as CreationKind)) return null;
  const kind = kindRaw as CreationKind;
  const lang: 'ar' | 'en' = obj.lang === 'ar' ? 'ar' : 'en';
  const str = (v: unknown, max: number): string =>
    typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  const title = str(obj.title, 120) || 'Untitled';

  if (kind === 'docx') {
    const sections = Array.isArray(obj.sections) ? obj.sections : [];
    const clean = sections
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .slice(0, 20)
      .map((s) => ({
        heading: str(s.heading, 200),
        paragraphs: Array.isArray(s.paragraphs)
          ? s.paragraphs.filter((p): p is string => typeof p === 'string').slice(0, 12)
          : [],
        bullets: Array.isArray(s.bullets)
          ? s.bullets.filter((b): b is string => typeof b === 'string').slice(0, 14)
          : [],
      }))
      .filter((s) => s.heading || s.paragraphs.length || s.bullets.length);
    if (!clean.length) return null;
    return {
      kind,
      lang,
      title,
      intro: str(obj.intro, 2000) || undefined,
      sections: clean,
    };
  }

  if (kind === 'pptx') {
    const slides = Array.isArray(obj.slides) ? obj.slides : [];
    const clean = slides
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .slice(0, 30)
      .map((s) => ({
        title: str(s.title, 200),
        bullets: Array.isArray(s.bullets)
          ? s.bullets.filter((b): b is string => typeof b === 'string').slice(0, 8)
          : [],
        notes: str(s.notes, 600) || undefined,
      }))
      .filter((s) => s.title || s.bullets.length);
    if (!clean.length) return null;
    const accent = normalizeHex(obj.accent) || '#6366f1';
    return { kind, lang, title, accent, slides: clean };
  }

  /* design */
  const headline = str(obj.headline, 140) || title;
  return {
    kind,
    lang,
    title,
    bg: normalizeHex(obj.bg) || '#0f172a',
    accent: normalizeHex(obj.accent) || '#818cf8',
    headline,
    subline: str(obj.subline, 200) || undefined,
    bullets: Array.isArray(obj.bullets)
      ? obj.bullets
          .filter((b): b is string => typeof b === 'string')
          .map((b) => b.slice(0, 240))
          .slice(0, 5)
      : [],
    tagline: str(obj.tagline, 120) || 'Made with Easier',
  };
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v.startsWith('#') ? v : `#${v}`);
  return m ? `#${m[1]}` : null;
}

export function safeFileName(title: string, ext: string): string {
  const base = title
    .replace(/[\\/:*?"<>|#%&{}$!'`]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return `${base || 'easier'}.${ext}`;
}
