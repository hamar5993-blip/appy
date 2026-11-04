/* POST /api/studio/generate — turns a validated ```create payload into a real
   file: Word (.docx) via the docx package, PowerPoint (.pptx) via pptxgenjs,
   and Canva-style posters as SVG. Authenticated users only. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { safeFileName, type Creation } from '@/lib/studio';

export const maxDuration = 30;

const ARABIC_RE = /[\u0600-\u06FF]/;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const creation: Creation | null = body?.creation && typeof body.creation === 'object'
      ? (body.creation as Creation)
      : null;
    if (!creation || !['docx', 'pptx', 'design'].includes(creation.kind)) {
      return NextResponse.json({ error: 'Invalid creation payload' }, { status: 400 });
    }
    /* Serialized string sizes are capped so the JSON parses fast and cheap. */
    if (JSON.stringify(creation).length > 400_000) {
      return NextResponse.json({ error: 'Creation payload is too large' }, { status: 413 });
    }

    const isRtl = creation.lang === 'ar' || ARABIC_RE.test(creation.title);

    const buffer =
      creation.kind === 'docx'
        ? await buildDocx(creation, isRtl)
        : creation.kind === 'pptx'
          ? await buildPptx(creation, isRtl)
          : buildDesignSvg(creation);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          creation.kind === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : creation.kind === 'pptx'
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : 'image/svg+xml',
        'Content-Disposition': `attachment; filename="${safeFileName(
          creation.title,
          creation.kind === 'docx' ? 'docx' : creation.kind === 'pptx' ? 'pptx' : 'svg'
        )}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Could not build this file';
    console.error('[studio-generate] unexpected error:', error);
    return NextResponse.json({ error: message, code: 'unknown' }, { status: 500 });
  }
}

/* ---------------- Word (.docx) ---------------- */

async function buildDocx(creation: Extract<Creation, { kind: 'docx' }>, isRtl: boolean) {
  const rtl = isRtl;
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const run = (text: string, opts: { size?: number; bold?: boolean; color?: string } = {}) =>
    new TextRun({
      text,
      size: opts.size ?? 22,
      bold: opts.bold,
      color: opts.color,
      rightToLeft: rtl,
      font: rtl ? 'Arial' : 'Calibri',
    });

  const children: Paragraph[] = [];

  /* Title page block */
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2_400, after: 240 },
      children: [
        run(creation.title, { size: 56, bold: true, color: '6366F1' }),
      ],
      bidirectional: rtl,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1_200 },
      children: [
        run(new Date().toLocaleDateString(rtl ? 'ar' : 'en'), { size: 24, color: '6B7280' }),
      ],
      bidirectional: rtl,
    })
  );

  if (creation.intro) {
    children.push(
      new Paragraph({
        alignment: align,
        bidirectional: rtl,
        spacing: { before: 1_200, after: 240 },
        children: [run(creation.intro, { size: 24 })],
      })
    );
  }

  for (const section of creation.sections ?? []) {
    if (section.heading) {
      children.push(
        new Paragraph({
          alignment: align,
          bidirectional: rtl,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 160 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '6366F1' } },
          children: [run(section.heading, { size: 32, bold: true, color: '1F2937' })],
        })
      );
    }
    for (const paragraph of section.paragraphs ?? []) {
      children.push(
        new Paragraph({
          alignment: align,
          bidirectional: rtl,
          spacing: { after: 160 },
          children: [run(paragraph, { size: 24 })],
        })
      );
    }
    for (const bullet of section.bullets ?? []) {
      children.push(
        new Paragraph({
          alignment: align,
          bidirectional: rtl,
          bullet: { level: 0 },
          spacing: { after: 100 },
          children: [run(bullet, { size: 24 })],
        })
      );
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [run('— Made with Easier —', { size: 20, color: '9CA3AF' })],
    })
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: rtl ? 'Arial' : 'Calibri', size: 24 } } } },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

/* ---------------- PowerPoint (.pptx) ---------------- */

async function buildPptx(creation: Extract<Creation, { kind: 'pptx' }>, isRtl: boolean) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = creation.title;
  pptx.author = 'Easier AI Studio';
  pptx.rtlMode = isRtl;

  const accent = creation.accent || '#6366F1';

  const textOpts = (fontSize: number, bold: boolean, color: string) => ({
    fontSize,
    bold,
    color,
    fontFace: 'Arial',
    rtlMode: isRtl,
    align: isRtl ? ('right' as const) : ('left' as const),
    valign: 'top' as const,
    /* ST_Lang wants a full language tag — plain "ar" gets written into rPr and
       some Office builds treat it as invalid. */
    lang: isRtl ? ('ar-SA' as const) : ('en-US' as const),
  });

  /* Title slide */
  const title = pptx.addSlide();
  title.background = { color: '#0F172A' };
  title.addShape('rect', {
    x: 0, y: 4.9, w: 10, h: 0.18,
    fill: { color: accent },
  });
  title.addText(creation.title, {
    x: 0.6, y: 1.9, w: 8.8, h: 2.2,
    fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial',
    rtlMode: isRtl, align: 'center', valign: 'middle', lang: isRtl ? 'ar-SA' : 'en-US',
  });
  title.addText('Easier AI Studio', {
    x: 0.6, y: 5.25, w: 8.8, h: 0.4,
    fontSize: 12, color: '94A3B8', fontFace: 'Arial',
    rtlMode: isRtl, align: 'center', lang: 'en-US',
  });

  const hasTitleSlide = (creation.slides?.[0]?.bullets ?? []).length === 0
    && !!creation.slides?.[0]?.title;

  let slideIndex = 0;
  for (const slideDef of creation.slides ?? []) {
    slideIndex += 1;
    /* Skip a content-less opening slide — the designed title slide covers it. */
    if (slideIndex === 1 && hasTitleSlide && !(slideDef.bullets ?? []).length
      && (creation.slides?.length ?? 0) > 1) {
      continue;
    }
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.14, fill: { color: accent } });

    if (slideDef.title) {
      slide.addText(slideDef.title, {
        x: isRtl ? 0.6 : 0.6,
        y: 0.55, w: 8.8, h: 0.9,
        ...textOpts(26, true, '111827'),
      });
    }
    if ((slideDef.bullets ?? []).length) {
      /* breakLine makes every bullet its own <a:p> paragraph. Without it
         pptxgenjs crams all runs into ONE paragraph and re-emits a <a:pPr>
         before each run — schema-invalid XML that PowerPoint refuses to open. */
      slide.addText(
        (slideDef.bullets ?? []).map((b) => ({
          text: `•  ${b}`,
          options: { ...textOpts(18, false, '374151'), bullet: false, breakLine: true },
        })),
        { x: 0.7, y: 1.7, w: 8.6, h: 3.6, lineSpacingMultiple: 1.35, ...textOpts(18, false, '374151') }
      );
    }
    if (slideDef.notes) {
      slide.addNotes(slideDef.notes);
    }
    slide.addText(String(slideIndex), {
      x: 9.2, y: 5.1, w: 0.6, h: 0.4,
      fontSize: 10, color: '9CA3AF', fontFace: 'Arial', align: 'right', lang: 'en-US',
    });
  }

  const raw = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return await sanitizePptxPackage(raw);
}

/* pptxgenjs 4.0.1 writes an <Override> for /ppt/slideMasters/slideMasterN.xml
   for EVERY slide, but only ever emits slideMaster1.xml. Overrides pointing at
   missing parts make PowerPoint reject the whole package ("needs repair").
   Strip the bogus ones before delivering the file. */
async function sanitizePptxPackage(raw: Buffer): Promise<Buffer> {
  try {
  const zip = await JSZip.loadAsync(raw);
  const entry = zip.file('[Content_Types].xml');
  if (!entry) return raw;
  const ct = await entry.async('string');
  const cleaned = ct.replace(
    /<Override PartName="\/ppt\/slideMasters\/slideMaster(\d+)\.xml"[^>]*\/>/g,
    (match, n: string) => (Number(n) <= 1 ? match : '')
  );
  if (cleaned === ct) return raw;
  zip.file('[Content_Types].xml', cleaned);
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return out as Buffer;
  } catch (error) {
    console.error('[studio-generate] pptx sanitize failed - delivering raw package:', error);
    return raw;
  }
}
/* ---------------- Canva-style poster (.svg) ---------------- */

function buildDesignSvg(creation: Extract<Creation, { kind: 'design' }>) {
  const W = 1080;
  const H = 1350;
  const bg = creation.bg || '#0f172a';
  const accent = creation.accent || '#818cf8';
  const rtl = creation.lang === 'ar';
  const anchor = rtl ? 'end' : 'start';
  const pad = 90;
  const inset = 24;
  const startX = rtl ? W - pad - inset : pad + inset;
  const contentWidth = W - pad * 2 - inset * 2;
  const font = `Arial, 'Segoe UI', Tahoma, sans-serif`;

  /* Rough per-character width (Arial). SVG never auto-wraps <text>, so long
     lines rendered past the canvas edge and were silently clipped ("part of
     the text missing"). Wrap everything into lines that fit the frame. */
  const estWidth = (s: string, size: number): number => s.length * size * 0.56;

  function wrap(text: string, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && estWidth(next, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /* Largest size whose wrapped text fits within maxLines. */
  function fit(text: string, baseSize: number, maxWidth: number, maxLines: number, minSize: number): { size: number; lines: string[] } {
    const clean = text.replace(/\s+/g, ' ').trim();
    let size = baseSize;
    let lines = wrap(clean, size, maxWidth);
    while (size > minSize && lines.length > maxLines) {
      size = Math.round(size * 0.85);
      lines = wrap(clean, size, maxWidth);
    }
    return { size, lines: lines.slice(0, maxLines) };
  }

  const headline = fit(
    creation.headline,
    creation.headline.length > 60 ? 58 : creation.headline.length > 34 ? 74 : 92,
    contentWidth, 2, 44
  );
  const subline = creation.subline
    ? fit(creation.subline, 40, contentWidth, 2, 28)
    : null;
  const bullets = (creation.bullets ?? [])
    .slice(0, 5)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((b) => fit(b, 40, contentWidth - 40, 2, 26));

  /* ---- flowing layout ---- */
  const parts: string[] = [];

  let y = pad + 280;
  const headlineLH = Math.round(headline.size * 1.18);
  for (const line of headline.lines) {
    parts.push(
      `<text x="${startX}" y="${y}" text-anchor="${anchor}"
        font-family="${font}" font-size="${headline.size}" font-weight="900"
        fill="#FFFFFF" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(line)}</text>`
    );
    y += headlineLH;
  }

  if (subline) {
    const subLH = Math.round(subline.size * 1.3);
    y += 16;
    for (const line of subline.lines) {
      parts.push(
        `<text x="${startX}" y="${y}" text-anchor="${anchor}"
          font-family="${font}" font-size="${subline.size}" font-weight="500"
          fill="#CBD5E1" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(line)}</text>`
      );
      y += subLH;
    }
  }

  /* Bullets start at least at mid-poster so the layout breathes. */
  y = Math.max(y + 46, 640);

  for (const bullet of bullets) {
    const bulletLH = Math.round(bullet.size * 1.28);
    const firstY = y + bullet.size;
    /* Keep every bullet fully above the footer zone, or drop it — never let
       text collide with the frame/footer. */
    if (firstY > H - pad - 150) break;
    parts.push(
      `<circle cx="${rtl ? startX + 16 : startX - 16}" cy="${firstY - bullet.size * 0.42}" r="7" fill="${accent}"/>`
    );
    for (let i = 0; i < bullet.lines.length; i += 1) {
      parts.push(
        `<text x="${startX}" y="${firstY + i * bulletLH}" text-anchor="${anchor}"
          font-family="${font}" font-size="${bullet.size}" font-weight="600"
          fill="#E2E8F0" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(bullet.lines[i])}</text>`
      );
    }
    y += bulletLH * bullet.lines.length + Math.round(bullet.size * 0.55);
  }

  /* The footer rule sits right below the content, but never above mid-poster. */
  const footerRuleY = Math.max(y + 30, H - pad - 110);
  const footerY = Math.min(footerRuleY + 62, H - pad - 24);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="glow" cx="${rtl ? '85%' : '15%'}" cy="8%" r="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}"
    fill="none" stroke="#FFFFFF22" stroke-width="2" rx="28"/>
  <text x="${rtl ? W - pad - inset : pad + inset}" y="${pad + 140}" font-family="${font}"
    font-size="26" font-weight="800" letter-spacing="6" fill="${accent}" text-anchor="${anchor}" direction="${rtl ? 'rtl' : 'ltr'}">EASIER</text>
  <circle cx="${rtl ? pad + 20 : W - pad - 20}" cy="${pad + 130}" r="26" fill="none" stroke="${accent}" stroke-width="5"/>
  ${parts.join('\n  ')}
  <line x1="${pad}" y1="${footerRuleY}" x2="${W - pad}" y2="${footerRuleY}" stroke="#FFFFFF26" stroke-width="2"/>
  <text x="${startX}" y="${footerY}" text-anchor="${anchor}"
    font-family="${font}" font-size="30" font-weight="600"
    fill="#94A3B8" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(creation.tagline || 'Made with Easier')}</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}
