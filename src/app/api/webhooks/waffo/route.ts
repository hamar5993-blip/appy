/* POST /api/webhooks/waffo — keeps profile entitlements in sync with Waffo.
   Events use RSA-signed bodies verified by the SDK (no shared secret needed). */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@waffo/pancake-ts';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-waffo-signature') || '';

  let event: any;
  try {
    // verifyWebhook has the test/prod public keys embedded + replay protection
    event = (verifyWebhook as any)(rawBody, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const d = event?.data ?? {};
  const email = String(d.buyerEmail || '').trim().toLowerCase();
  const orderId = d.orderId ?? event?.id ?? null;
  // subscription-domain events carry an ISO date (YYYY-MM-DD) for the period end
  const periodEnd = d.currentPeriodEnd ? new Date(`${d.currentPeriodEnd}T23:59:59.999Z`).toISOString() : null;
  const type: string = event?.eventType ?? '';

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (orderId) patch.waffo_order_id = orderId;

  switch (type) {
    case 'subscription.activated':
    case 'subscription.renewed':
    case 'subscription.recovered':
    case 'subscription.plan_changed':
    case 'subscription.payment_succeeded':
    case 'subscription.uncanceled':
      patch.subscription_status = 'active';
      if (periodEnd) patch.subscription_ends_at = periodEnd;
      break;
    case 'subscription.canceling':
      // keep access until the paid period ends
      patch.subscription_status = 'canceling';
      if (periodEnd) patch.subscription_ends_at = periodEnd;
      break;
    case 'subscription.past_due':
      patch.subscription_status = 'past_due';
      break;
    case 'subscription.canceled':
      // terminated — access ends now
      patch.subscription_status = 'canceled';
      patch.subscription_ends_at = new Date().toISOString();
      break;
    default:
      // order.completed, refunds, non-subscription events — nothing to do yet
      return NextResponse.json({ ok: true, ignored: type });
  }

  if (email) {
    await admin.from('profiles').update(patch).eq('email', email);
  }
  return NextResponse.json({ ok: true, event: type });
}
