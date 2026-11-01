/* POST /api/homework — authenticated users send a homework question (text and/or
   an image) and receive a step-by-step solution from OpenRouter. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash';
const MAX_QUESTION_CHARS = 20_000;
/* Base64 inflates the payload ~33%; this keeps the raw image under ~6.5 MB. */
const MAX_IMAGE_CHARS = 9_000_000;

function systemPrompt(lang: 'ar' | 'en') {
  return [
    "You are Easier's homework tutor. Solve the student's question accurately and teach the method.",
    'Rules:',
    '- Break the solution into clear numbered steps and explain the reasoning briefly at each step.',
    '- For multiple-choice questions, state the correct option first, then explain why it is correct and why the others are not.',
    '- For math and science, show the full calculation in plain text (use × ÷ √ ^ and fractions like 3/4 — never LaTeX or $...$).',
    '- If the text or photo is missing information, state the assumption you make and continue.',
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
    const image = typeof body?.image === 'string' ? body.image : '';
    const lang: 'ar' | 'en' = body?.lang === 'ar' ? 'ar' : 'en';

    if (!question && !image) {
      return NextResponse.json({ error: 'Add a question or a photo first' }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json({ error: 'Question is too long' }, { status: 413 });
    }
    if (image) {
      if (image.length > MAX_IMAGE_CHARS) {
        return NextResponse.json({ error: 'Image is too large' }, { status: 413 });
      }
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(image)) {
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

    const userContent = image
      ? [
          { type: 'text', text: question || 'Solve the homework shown in the image.' },
          { type: 'image_url', image_url: { url: image } },
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
