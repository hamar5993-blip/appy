/* POST /api/studio/chat — authenticated users chat with the AI assistant.
   The model may end a reply with a ```create block; we strip it out and return
   it separately so the UI can offer a real file download. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { systemPrompt, parseCreation, type Creation } from '@/lib/studio';

export const maxDuration = 60;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash';
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_TOKENS = 8_000;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function mapOpenRouterError(status: number, message: string): string {
  const text = message.toLowerCase();
  if (status === 401 || status === 403 || text.includes('invalid api key') || text.includes('no auth credentials')) {
    return 'invalid_key';
  }
  if (status === 402 || text.includes('insufficient credit') || text.includes('not enough credit')) {
    return 'no_credits';
  }
  if (status === 429) return 'rate_limited';
  return 'provider';
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
    const rawMessages: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
    const lang: 'ar' | 'en' = body?.lang === 'ar' ? 'ar' : 'en';

    /* Last user message decides the language of the system prompt rules. */
    const lastUser = [...rawMessages].reverse().find(
      (m): m is ChatMessage => !!m && typeof m === 'object' && (m as ChatMessage).role === 'user'
    );
    const replyLang: 'ar' | 'en' = lastUser && /[\u0600-\u06FF]/.test(lastUser.content) ? 'ar' : lang;

    const messages: ChatMessage[] = rawMessages
      .filter((m): m is ChatMessage => {
        if (!m || typeof m !== 'object') return false;
        const msg = m as ChatMessage;
        return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
      })
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
      .slice(-MAX_MESSAGES);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Write a message first' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[studio] OPENROUTER_API_KEY is not set');
      return NextResponse.json(
        { error: 'The AI studio is not configured on the server yet', code: 'not_configured' },
        { status: 503 }
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': req.nextUrl.origin,
          'X-Title': 'Easier AI Studio',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: systemPrompt(replyLang) }, ...messages],
          temperature: 0.5,
          max_tokens: MAX_TOKENS,
        }),
        signal: controller.signal,
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const message = json?.error?.message || `OpenRouter request failed (${response.status})`;
        const code = mapOpenRouterError(response.status, message);
        console.error(`[studio] OpenRouter ${response.status} (${code}): ${message}`);
        return NextResponse.json(
          { error: message, code, providerStatus: response.status },
          { status: code === 'invalid_key' ? 401 : 502 }
        );
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
        console.error(
          `[studio] OpenRouter returned an empty answer (finish_reason: ${json?.choices?.[0]?.finish_reason ?? 'unknown'})`
        );
        return NextResponse.json({ error: 'The AI returned an empty answer', code: 'provider' }, { status: 502 });
      }

      const { text, creation } = parseCreation(answer);
      return NextResponse.json({
        answer: text.trim() || '…',
        creation,
        model: MODEL,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[studio] OpenRouter request timed out after 55s');
        return NextResponse.json({ error: 'The AI took too long to answer', code: 'timeout' }, { status: 504 });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Could not chat right now';
    console.error('[studio] unexpected error:', error);
    return NextResponse.json({ error: message, code: 'unknown' }, { status: 500 });
  }
}

export type { Creation };
