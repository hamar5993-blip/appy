/* POST /api/subscribe — authenticated users get a hosted Waffo checkout link
   for the $4.99/month subscription with a 1-day free trial. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWaffoClient, WAFFO_PRODUCT_ID } from '@/lib/waffo';

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
      return NextResponse.json(
        { error: 'Payments are being configured on our side. Please try again soon.' },
        { status: 503 }
      );
    }

    const session = await (client.checkout as any).createSession({
      productId: WAFFO_PRODUCT_ID,
      currency: 'USD',
      buyerEmail: user.email ?? '',
      withTrial: true, // 1-day trial is also configured on the product itself
      successUrl: `${req.nextUrl.origin}/library?checkout=success`,
      orderMerchantExternalId: user.id,
      metadata: { userId: user.id, product: 'easier-pro-monthly' },
      expiresInSeconds: 3600,
    });

    return NextResponse.json({ url: (session as any).checkoutUrl, expiresAt: (session as any).expiresAt });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Checkout failed' }, { status: 500 });
  }
}
