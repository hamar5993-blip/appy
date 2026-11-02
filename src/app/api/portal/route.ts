/* POST /api/portal — returns a signed Waffo customer-portal URL for the
   signed-in user. The portal token is a bearer credential, so it is created
   per request on the server and never cached. */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WaffoPancakeError } from '@waffo/pancake-ts';
import { getMissingWaffoConfig, getWaffoClient, WAFFO_STORE_ID } from '@/lib/waffo';

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
    const missing = getMissingWaffoConfig({ product: false, store: true });
    if (!client || missing.length) {
      console.error(`[portal] Waffo portal is not configured. Missing: ${missing.join(', ') || 'unknown'}`);
      return NextResponse.json(
        {
          error: 'Subscription management is not configured yet.',
          code: 'not_configured',
          ...(process.env.NODE_ENV !== 'production' ? { missing } : {}),
        },
        { status: 503 }
      );
    }

    const { portalUrl } = await client.auth.createCustomerPortalLink({
      storeId: WAFFO_STORE_ID,
      buyerIdentity: user.id,
    });

    return NextResponse.json({ url: portalUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof WaffoPancakeError) {
      const message = error.errors?.map((e) => e.message).filter(Boolean).join(' · ') || error.message;
      console.error(`[portal] Waffo ${error.status}: ${message}`);
      return NextResponse.json({ error: message, code: 'waffo_error' }, { status: 502 });
    }
    console.error('[portal] unexpected error:', error);
    return NextResponse.json({ error: 'Could not open the subscription portal' }, { status: 500 });
  }
}
