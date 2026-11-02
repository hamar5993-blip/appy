'use client';

/* Client-side helpers for the Waffo billing routes. The private key never
   leaves the server — these only call our own API with the session token. */

import { supabase } from '@/lib/supabase';

async function authHeader(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}` };
}

async function billingPost(path: string): Promise<{ url: string } | { needsAuth: true }> {
  const headers = await authHeader();
  if (!headers) return { needsAuth: true };

  const res = await fetch(path, { method: 'POST', headers, cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) {
    throw new Error(
      typeof json?.error === 'string' && json.error
        ? json.error
        : `Request failed (HTTP ${res.status})`
    );
  }
  return { url: json.url };
}

/** Create a Waffo checkout session for the signed-in user. */
export function startWaffoCheckout() {
  return billingPost('/api/subscribe');
}

/** Open the Waffo customer portal (subscription management). */
export function startWaffoPortal() {
  return billingPost('/api/portal');
}
