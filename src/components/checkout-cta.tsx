'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { startWaffoCheckout } from '@/lib/billing';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/components/settings';

/** Pricing-page CTA: sends guests to signup, signed-in users to Waffo checkout. */
export function CheckoutCta({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    return () => { alive = false; };
  }, []);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await startWaffoCheckout();
      if ('needsAuth' in result) {
        router.push('/signup');
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      toast.error(
        `${t.subFailed}${error instanceof Error && error.message ? ` ${error.message}` : ''}`
      );
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={start} disabled={busy} className={className}>
      {busy ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {busy ? t.subPreparing : signedIn ? t.subSubscribe : t.subStart}
    </button>
  );
}
