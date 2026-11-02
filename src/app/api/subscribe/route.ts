/* POST /api/subscribe — authenticated users get a hosted Waffo checkout link
   for the $4.99/month subscription with a 1-day free trial.

   Authenticated checkout binds the order to the Supabase user id
   (`buyerIdentity`), so webhooks can credit the right profile even if the
   customer edits their email on the checkout page. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WaffoPancakeError } from '@waffo/pancake-ts';
import { getWaffoClient, WAFFO_CURRENCY, WAFFO_PRODUCT_ID } from '@/lib/waffo';

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

    const client = getWaffoClient();
    if (!client || !WAFFO_PRODUCT_ID) {
      console.error('[subscribe] Waffo is not configured (missing WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY / WAFFO_PRODUCT_ID)');
      return NextResponse.json(
        { error: 'Payments are being configured on our side. Please try again soon.', code: 'not_configured' },
        { status: 503 }
      );
    }

    const origin = req.nextUrl.origin;
    const session = await client.checkout.authenticated.create({
      productId: WAFFO_PRODUCT_ID,
      currency: WAFFO_CURRENCY,
      buyerIdentity: user.id,
      buyerEmail: user.email ?? undefined,
      // The 1-day trial is granted in-app at signup; the checkout starts the
      // paid $4.99/month plan so the two trials cannot stack.
      withTrial: false,
      successUrl: `${origin}/library?checkout=success`,
      expiresInSeconds: 3600,
      orderMerchantExternalId: `easier_${user.id}_${Date.now()}`,
      metadata: { userId: user.id, plan: 'easier-pro-monthly' },
    });

    return NextResponse.json({
      url: session.checkoutUrl,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    if (error instanceof WaffoPancakeError) {
      const message = error.errors?.map((e) => e.message).filter(Boolean).join(' · ') || error.message;
      console.error(`[subscribe] Waffo ${error.status}: ${message}`);
      return NextResponse.json({ error: message, code: 'waffo_error' }, { status: 502 });
    }
    console.error('[subscribe] unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error && error.message ? error.message : 'Checkout failed', code: 'unknown' },
      { status: 500 }
    );
  }
}
