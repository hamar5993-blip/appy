'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button, Input, Label, Logo } from '@/components/ui';
import { useSettings } from '@/components/settings';
import { Mail, Lock, ArrowRight } from 'lucide-react';

// Auth pages are part of the public site — footer contact is present here too.

export default function LoginPage() {
  const router = useRouter();
  const { t } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      toast.success('Welcome back!');
      router.push('/library');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-72 -translate-x-1/4 rounded-full bg-primary/20 blur-3xl" />

      <div className="animate-fade-up relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="max-w-[300px] text-center text-sm leading-relaxed text-muted-fg">{t.appTagline}</p>
        </div>

        <div className="rounded-3xl border border-edge bg-surface p-8 shadow-[0_20px_60px_-20px_rgba(99,102,241,.25)]">
          <h1 className="text-lg font-bold">{t.signIn}</h1>
          <p className="mt-1 mb-4 text-[13px] text-muted-fg">Welcome back — continue your studies.</p>

          <Link
            href="/pricing"
            className="mb-5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-[12px] font-bold text-emerald-600 transition hover:bg-emerald-500/15 dark:text-emerald-400"
          >
            100% free · no credit card required
          </Link>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>{t.email}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10" required autoComplete="email" />
              </div>
            </div>
            <div>
              <Label>{t.password}</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10" required autoComplete="current-password" />
              </div>
            </div>
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {t.signIn}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-fg">
          {t.noAccount}{' '}
          <Link href="/signup" className="font-bold text-primary hover:underline">
            {t.signUp}
          </Link>
        </p>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold">
          <Link href="/pricing" className="text-muted-fg transition hover:text-primary">Pricing</Link>
          <Link href="/terms" className="text-muted-fg transition hover:text-primary">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="text-muted-fg transition hover:text-primary">Privacy Policy</Link>
          <a
            href="mailto:support@easier.app"
            className="inline-flex items-center gap-1.5 text-muted-fg transition hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5" />
            support@easier.app
          </a>
        </footer>
      </div>
    </main>
  );
}
