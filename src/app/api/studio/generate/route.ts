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
    lang: creation.lang,
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
    rtlMode: isRtl, align: 'center', valign: 'middle', lang: creation.lang,
  });
  title.addText('Easier AI Studio', {
    x: 0.6, y: 5.25, w: 8.8, h: 0.4,
    fontSize: 12, color: '94A3B8', fontFace: 'Arial',
    rtlMode: isRtl, align: 'center', lang: creation.lang,
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
      slide.addText(
        (slideDef.bullets ?? []).map((b) => ({ text: `•  ${b}`, options: { ...textOpts(18, false, '374151'), bullet: false } })),
        { x: 0.7, y: 1.7, w: 8.6, h: 3.6, lineSpacingMultiple: 1.35, ...textOpts(18, false, '374151') }
      );
    }
    if (slideDef.notes) {
      slide.addNotes(slideDef.notes);
    }
    slide.addText(String(slideIndex), {
      x: 9.2, y: 5.1, w: 0.6, h: 0.4,
      fontSize: 10, color: '9CA3AF', fontFace: 'Arial', align: 'right', lang: 'en',
    });
  }

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

/* ---------------- Canva-style poster (.svg) ---------------- */

function buildDesignSvg(creation: Extract<Creation, { kind: 'design' }>) {
  const W = 1080;
  const H = 1350;
  const bg = creation.bg || '#0f172a';
  const accent = creation.accent || '#818cf8';
  const rtl = creation.lang === 'ar';
  const anchor = rtl ? 'end' : 'start';
  const alignX = rtl ? 'right' : 'left';
  const pad = 90;

  /* Headline font size scales down as the text grows, so long titles still fit. */
  const headlineSize = creation.headline.length > 60 ? 58 : creation.headline.length > 34 ? 74 : 92;

  const bullets = (creation.bullets ?? []).slice(0, 4);
  const contentStart = 620 + (creation.subline ? 90 : 0);
  const rowGap = 74;
  const rows: string[] = [];
  for (let i = 0; i < bullets.length; i += 1) {
    const y = contentStart + i * rowGap;
    rows.push(
      `${rtl
        ? `<circle cx="${W - pad + 14}" cy="${y - 11}" r="7" fill="${accent}"/>`
        : `<circle cx="${pad + 7}" cy="${y - 11}" r="7" fill="${accent}"/>`}
      <text x="${alignX === 'right' ? W - pad : pad}" y="${y + 34}" text-anchor="${anchor}"
        font-family="Arial, 'Segoe UI', Tahoma, sans-serif" font-size="42" font-weight="600"
        fill="#E2E8F0" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(bullets[i])}</text>`
    );
  }

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
  <text x="${pad}" y="${pad + 140}" font-family="Arial, 'Segoe UI', Tahoma, sans-serif"
    font-size="26" font-weight="800" letter-spacing="6" fill="${accent}">EASIER</text>
  <circle cx="${alignX === 'right' ? pad + 16 : W - pad - 16}" cy="${pad + 130}" r="26" fill="none" stroke="${accent}" stroke-width="5"/>
  <text x="${pad}" y="${pad + 300}" text-anchor="start"
    font-family="Arial, 'Segoe UI', Tahoma, sans-serif" font-size="${headlineSize}" font-weight="900"
    fill="#FFFFFF" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(creation.headline)}</text>
  ${creation.subline
    ? `<text x="${pad}" y="${pad + 300 + headlineSize + 34}" font-family="Arial, 'Segoe UI', Tahoma, sans-serif"
      font-size="40" font-weight="500" fill="#CBD5E1" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(creation.subline)}</text>`
    : ''}
  ${rows.join('\n  ')}
  <line x1="${pad}" y1="${H - pad - 110}" x2="${W - pad}" y2="${H - pad - 110}" stroke="#FFFFFF26" stroke-width="2"/>
  <text x="${rtl ? W - pad : pad}" y="${H - pad - 50}" text-anchor="${anchor}"
    font-family="Arial, 'Segoe UI', Tahoma, sans-serif" font-size="30" font-weight="600"
    fill="#94A3B8" direction="${rtl ? 'rtl' : 'ltr'}">${xmlEscape(creation.tagline || 'Made with Easier')}</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}
