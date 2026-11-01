/* POST /api/homework — authenticated users send a homework question (text and/or
   an image) and receive a step-by-step solution from OpenRouter. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash';
const MAX_QUESTION_CHARS = 60_000;
/* Base64 inflates the payload ~33%; each image and the total are capped. */
const MAX_IMAGE_CHARS = 9_000_000;
const MAX_TOTAL_IMAGE_CHARS = 12_000_000;
const MAX_IMAGES = 4;
const IMAGE_DATA_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
/* Scanned PDFs travel as a single base64 data URL (~22 MB of PDF). */
const MAX_PDF_CHARS = 30_000_000;
const PDF_DATA_RE = /^data:application\/pdf;base64,/i;

function systemPrompt(lang: 'ar' | 'en') {
  return [
    "You are Easier's homework tutor. Solve the student's question accurately and teach the method.",
    'Rules:',
    '- Break the solution into clear numbered steps and explain the reasoning briefly at each step.',
    '- For multiple-choice questions, state the correct option first, then explain why it is correct and why the others are not.',
    '- For math and science, show the full calculation in plain text (use × ÷ √ ^ and fractions like 3/4 — never LaTeX or $...$).',
    '- If the text or file is missing information, state the assumption you make and continue.',
    '- If the attached PDF has more than 100 pages, only the first 100 pages are relevant.',
    '- Finish with a line that starts with "Final answer:" when the question has one concrete answer.',
    '- Keep the answer focused: no filler, no self-reference.',
    lang === 'ar' ? '- Write the entire answer in Arabic.' : '- Write the entire answer in English.',
  ].join('\n');
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
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    const rawImages: unknown[] = Array.isArray(body?.images)
      ? body.images
      : typeof body?.image === 'string'
        ? [body.image]
        : [];
    const images = rawImages
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .slice(0, MAX_IMAGES);
    const rawFile = body?.file;
    const file = rawFile && typeof rawFile === 'object' && typeof rawFile.dataUrl === 'string' && rawFile.dataUrl.length > 0
      ? {
          name: typeof rawFile.name === 'string' && rawFile.name.trim()
            ? rawFile.name.trim().slice(0, 120)
            : 'homework.pdf',
          dataUrl: rawFile.dataUrl as string,
        }
      : null;
    const lang: 'ar' | 'en' = body?.lang === 'ar' ? 'ar' : 'en';

    if (!question && !images.length && !file) {
      return NextResponse.json({ error: 'Add a question or a file first' }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json({ error: 'Question is too long' }, { status: 413 });
    }
    if (file) {
      if (file.dataUrl.length > MAX_PDF_CHARS) {
        return NextResponse.json({ error: 'PDF is too large' }, { status: 413 });
      }
      if (!PDF_DATA_RE.test(file.dataUrl)) {
        return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
      }
    }
    if (images.length) {
      const totalChars = images.reduce((sum, value) => sum + value.length, 0);
      if (totalChars > MAX_TOTAL_IMAGE_CHARS || images.some((value) => value.length > MAX_IMAGE_CHARS)) {
        return NextResponse.json({ error: 'Image is too large' }, { status: 413 });
      }
      if (images.some((value) => !IMAGE_DATA_RE.test(value))) {
        return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 });
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'The AI tutor is not configured on the server yet' },
        { status: 503 }
      );
    }

    const userContent = file || images.length
      ? [
          { type: 'text', text: question || 'Solve the homework shown in the attached file.' },
          ...(file
            ? [{ type: 'file', file: { filename: file.name, file_data: file.dataUrl } }]
            : []),
          ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
      : question;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': req.nextUrl.origin,
          'X-Title': 'Easier — Homework solver',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt(lang) },
            { role: 'user', content: userContent },
          ],
          temperature: 0.25,
          max_tokens: 2500,
        }),
        signal: controller.signal,
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const message = json?.error?.message || `OpenRouter request failed (${response.status})`;
        return NextResponse.json({ error: message }, { status: 502 });
      }

      const content = json?.choices?.[0]?.message?.content;
      const answer = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((part: string | { text?: string }) =>
                typeof part === 'string' ? part : part?.text ?? ''
              )
              .join('')
          : '';
      if (!answer.trim()) {
        return NextResponse.json({ error: 'The AI returned an empty answer' }, { status: 502 });
      }

      return NextResponse.json({ answer: answer.trim(), model: MODEL });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'The AI took too long to answer' }, { status: 504 });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message ? error.message : 'Could not solve this question' },
      { status: 500 }
    );
  }
}
