'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Spinner, Logo } from '@/components/ui';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      router.replace(user ? '/library' : '/login');
    });
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-5">
        <Logo size="lg" />
        <Spinner className="h-8 w-8 border-2" />
      </div>
    </main>
  );
}
