'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button, Input, Label, Logo } from '@/components/ui';
import { useSettings } from '@/components/settings';
import { STAGES, type StageKey } from '@/lib/i18n';
import { Mail, Lock, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const router = useRouter();
  const { t, lang } = useSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stage, setStage] = useState<StageKey>('high');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name, stage } },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email,
          name,
          stage,
        });
      }
      toast.success('Account created — welcome to Easier!');
      router.push('/library');
    } catch (error: any) {
      toast.error(error.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-72 -translate-x-1/4 rounded-full bg-[var(--primary-2)]/20 blur-3xl" />

      <div className="animate-fade-up relative w-full max-w-[470px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="max-w-[320px] text-center text-sm leading-relaxed text-muted-fg">{t.appTagline}</p>
        </div>

        <div className="rounded-3xl border border-edge bg-surface p-8 shadow-[0_20px_60px_-20px_rgba(99,102,241,.25)]">
          <h1 className="text-lg font-bold">{t.createAccount}</h1>
          <p className="mt-1 mb-4 text-[13px] text-muted-fg">Personalize your learning experience.</p>

          <Link
            href="/pricing"
            className="mb-5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-[12px] font-bold text-emerald-600 transition hover:bg-emerald-500/15 dark:text-emerald-400"
          >
            100% free · see what&apos;s included
          </Link>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label>{t.fullName}</Label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input value={name} onChange={(e) => setName(e.target.value)} className="ps-10" required autoComplete="name" />
              </div>
            </div>
            <div>
              <Label>{t.email}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10" required autoComplete="email" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t.password}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10" required autoComplete="new-password" />
                </div>
              </div>
              <div>
                <Label>{t.confirmPass}</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
              </div>
            </div>

            <div>
              <Label>{t.stageLabel}</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(Object.entries(STAGES) as [StageKey, typeof STAGES[StageKey]][]).map(([key, s]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setStage(key)}
                    className={cn(
                      'relative rounded-xl border p-2 text-center transition-all duration-200 hover:-translate-y-0.5',
                      stage === key
                        ? 'border-primary bg-primary/10 shadow-[0_4px_12px_rgba(99,102,241,.2)]'
                        : 'border-edge bg-background hover:border-primary/40'
                    )}
                  >
                    {stage === key && (
                      <span className="absolute top-1 end-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <span className="block text-xl">{s.icon}</span>
                    <span className="mt-1 block text-[10.5px] font-bold leading-tight">
                      {lang === 'ar' ? s.ar : s.en}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {t.createAccount}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-fg">
          {t.haveAccount}{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">
            {t.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
