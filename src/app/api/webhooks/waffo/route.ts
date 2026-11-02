/* POST /api/webhooks/waffo — keeps profile entitlements in sync with Waffo.
   Events use RSA-signed bodies verified by the SDK (no shared secret needed).

   The checkout is created with the Supabase user id as `buyerIdentity`, so the
   webhook credits `merchantProvidedBuyerIdentity` first and only falls back to
   the email when an older anonymous checkout sent no identity. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyWebhook, WebhookEventType, type WebhookEvent } from '@waffo/pancake-ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoPeriodEnd(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  // subscription events carry a plain date (YYYY-MM-DD); keep the whole day
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function patchProfile(
  admin: SupabaseClient,
  patch: Record<string, unknown>,
  identity: { userId?: string; email?: string }
) {
  if (identity.userId) return admin.from('profiles').update(patch).eq('id', identity.userId);
  if (identity.email) return admin.from('profiles').update(patch).eq('email', identity.email);
  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-waffo-signature') || '';

  let event: WebhookEvent;
  try {
    event = verifyWebhook(rawBody, signature) as WebhookEvent;
  } catch (error) {
    console.error('[waffo-webhook] signature verification failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const expectedStoreId = process.env.WAFFO_STORE_ID?.trim();
  if (!expectedStoreId) {
    console.error('[waffo-webhook] WAFFO_STORE_ID is missing — cannot verify the event belongs to this store');
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  if (event.storeId !== expectedStoreId) {
    // Waffo signs every merchant's events with the same public key, so the
    // store id is what proves this event belongs to our account.
    console.warn(`[waffo-webhook] ignored event ${event.id} for store ${event.storeId}`);
    return NextResponse.json({ ok: true, ignored: 'wrong-store' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    console.error('[waffo-webhook] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing');
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const d = event.data ?? ({} as WebhookEvent['data']);
  const rawUserId = typeof d.merchantProvidedBuyerIdentity === 'string'
    ? d.merchantProvidedBuyerIdentity
    : typeof d.orderMetadata?.userId === 'string'
      ? d.orderMetadata.userId
      : '';
  const userId = UUID_RE.test(rawUserId) ? rawUserId : '';
  const email = String(d.buyerEmail || '').trim().toLowerCase();
  const orderId = d.orderId ?? event.eventId ?? null;
  const periodEnd = isoPeriodEnd(d.currentPeriodEnd);
  const now = new Date().toISOString();
  const type = event.eventType;

  const patch: Record<string, unknown> = { updated_at: now };
  if (orderId) patch.waffo_order_id = orderId;

  switch (type) {
    case WebhookEventType.SubscriptionActivated:
    case WebhookEventType.SubscriptionRenewed:
    case WebhookEventType.SubscriptionRecovered:
    case WebhookEventType.SubscriptionPlanChanged:
    case WebhookEventType.SubscriptionUncanceled:
      patch.subscription_status = 'active';
      if (periodEnd) patch.subscription_ends_at = periodEnd;
      break;

    case WebhookEventType.SubscriptionPaymentSucceeded:
      // Payment-only event: it carries no billing period or status. Keep the
      // order reference and let subscription.activated/renewed drive access.
      break;

    case WebhookEventType.OrderCompleted:
      // Only subscription orders carry billing-period fields; one-time orders
      // from other products must not unlock the app.
      if (!d.billingPeriod && !d.currentPeriodEnd) {
        return NextResponse.json({ ok: true, ignored: type });
      }
      patch.subscription_status = 'active';
      if (periodEnd) patch.subscription_ends_at = periodEnd;
      break;

    case WebhookEventType.SubscriptionCanceling:
      // keep access until the paid period ends
      patch.subscription_status = 'canceling';
      if (periodEnd) patch.subscription_ends_at = periodEnd;
      break;

    case WebhookEventType.SubscriptionPastDue:
      patch.subscription_status = 'past_due';
      break;

    case WebhookEventType.SubscriptionCanceled:
      // terminated — access ends now
      patch.subscription_status = 'canceled';
      patch.subscription_ends_at = now;
      break;

    case WebhookEventType.RefundSucceeded:
      // money returned — revoke access immediately
      patch.subscription_status = 'canceled';
      patch.subscription_ends_at = now;
      break;

    default:
      return NextResponse.json({ ok: true, ignored: type });
  }

  if (!userId && !email) {
    console.warn(`[waffo-webhook] ${type}: no buyer identity or email on event ${event.id}`);
    return NextResponse.json({ ok: true, unmatched: true });
  }

  /* A delayed "canceled"/"past_due"/refund event from an old order must not
     revoke a newer subscription the student has since started. */
  const destructive =
    type === WebhookEventType.SubscriptionCanceling ||
    type === WebhookEventType.SubscriptionPastDue ||
    type === WebhookEventType.SubscriptionCanceled ||
    type === WebhookEventType.RefundSucceeded;

  if (destructive && d.orderId) {
    const lookup = admin.from('profiles').select('waffo_order_id');
    const { data: current } = userId
      ? await lookup.eq('id', userId).maybeSingle()
      : await lookup.eq('email', email).maybeSingle();
    const currentOrderId = (current as { waffo_order_id?: string | null } | null)?.waffo_order_id;
    if (currentOrderId && currentOrderId !== d.orderId) {
      console.log(`[waffo-webhook] ${type} for old order ${d.orderId} (current ${currentOrderId}) — ignored`);
      return NextResponse.json({ ok: true, ignored: 'stale-order' });
    }
  }

  const result = await patchProfile(admin, patch, { userId: userId || undefined, email: email || undefined });
  if (result?.error) {
    console.error(`[waffo-webhook] ${type}: profile update failed:`, result.error.message);
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 });
  }

  console.log(`[waffo-webhook] ${type} → user ${userId || email}`);
  return NextResponse.json({ ok: true, event: type });
}
