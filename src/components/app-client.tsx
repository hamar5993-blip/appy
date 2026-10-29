'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSettings, stageName } from '@/components/settings';
import { toast } from 'sonner';
import { Spinner, Logo, Button } from '@/components/ui';
import type { User } from '@/types';
import { STAGES, type StageKey } from '@/lib/i18n';
import { Moon, Sun, LogOut, ChevronDown, Plus, Check, Mail, Sparkles, Volume2, BrainCircuit, BookOpen, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

function Header({ onGate }: { onGate?: (locked: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang, theme, toggleLang, toggleTheme } = useSettings();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef(onGate);
  gateRef.current = onGate;

  /* Entitlement check (Waffo subscription / trial) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || !alive) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        if (!alive) return;
        gateRef.current?.(computeLock(profile));
      } catch { /* never block on a failed entitlement check */ }
    })();
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        /* Deadline every request: a hanging network call can never leave the
           header spinner stuck forever. */
        const withTimeout = <T,>(p: { then: (r: (v: T) => void, e: (e: any) => void) => void }, ms: number): Promise<T> =>
          new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ms);
            p.then(
              (v) => { clearTimeout(timer); resolve(v); },
              (e) => { clearTimeout(timer); reject(e); }
            );
          });

        const { data: { user: authUser } } = await withTimeout<{ data: { user: any } }>(supabase.auth.getUser(), 15000);
        if (!alive) return;
        if (!authUser) {
          router.replace('/login');
          return;
        }
        let profile: any = null;
        try {
          const res = await withTimeout<any>(
            supabase.from('profiles').select('*').eq('id', authUser.id).single(),
            10000
          );
          if (!alive) return;
          profile = res.data;
        } catch {
          if (!alive) return;
        }
        if (!alive) return;
        setUser(
          profile ?? { id: authUser.id, email: authUser.email ?? '', name: 'Student', stage: 'high', created_at: '' }
        );
        gateRef.current?.(computeLock(profile));
      } catch {
        /* auth itself failed or timed out — bounce to login rather than spinning */
        if (!alive) return;
        router.replace('/login');
      }
    })();
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const changeStage = async (stage: StageKey) => {
    if (!user) return;
    setUser({ ...user, stage });
    await supabase.from('profiles').update({ stage }).eq('id', user.id);
    toast.success(stageName(stage, lang));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(t.logout);
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-edge backdrop-blur-xl" style={{ background: 'var(--header-bg)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo href="/library" />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLang}
            title="Language"
            className="grid h-10 w-10 place-items-center rounded-xl border border-edge bg-surface text-[13px] font-bold transition hover:border-primary hover:text-primary"
          >
            {lang === 'en' ? 'ع' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            title="Theme"
            className="grid h-10 w-10 place-items-center rounded-xl border border-edge bg-surface transition hover:border-primary hover:text-primary"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {pathname === '/library' && (
            <Link
              href="/upload"
              className="hidden items-center gap-1.5 rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] px-4 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(99,102,241,.35)] transition hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(99,102,241,.45)] sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              {t.newStudy}
            </Link>
          )}

          <div className="relative" ref={menuRef}>
            {user ? (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full border border-edge bg-surface py-1 pe-2 ps-1 transition hover:border-primary"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-primary to-[var(--primary-2)] text-[13px] font-extrabold text-white">
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="hidden text-start sm:block">
                  <span className="block max-w-[120px] truncate text-xs font-bold leading-tight">{user.name}</span>
                  <span className="block text-[10.5px] leading-tight text-muted-fg">{stageName(user.stage, lang)}</span>
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-fg transition-transform', menuOpen && 'rotate-180')} />
              </button>
            ) : (
              <div className="grid h-10 w-10 place-items-center">
                <Spinner className="h-6 w-6 border-2" />
              </div>
            )}

            {menuOpen && user && (
              <div className="animate-fade-up absolute end-0 top-full z-50 mt-2 w-72 rounded-2xl border border-edge bg-surface p-4 shadow-[0_16px_48px_-12px_rgba(0,0,0,.25)]">
                <div className="mb-4 border-b border-edge pb-3">
                  <div className="text-sm font-bold">{user.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-fg">{user.email}</div>
                </div>
                <div className="mb-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-fg">
                  {t.stageLabel}
                </div>
                <div className="mb-4 space-y-1">
                  {(Object.entries(STAGES) as [StageKey, typeof STAGES[StageKey]][]).map(([key, s]) => (
                    <button
                      key={key}
                      onClick={() => changeStage(key)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] font-semibold transition',
                        user.stage === key
                          ? 'border border-primary bg-primary/10 text-primary'
                          : 'border border-transparent hover:bg-background'
                      )}
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className="flex-1">{lang === 'ar' ? s.ar : s.en}</span>
                      {user.stage === key && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-edge py-2 text-[13px] font-semibold transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header onGate={setLocked} />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        {locked ? <Paywall /> : children}
      </main>
      <Footer />
    </div>
  );
}

/* Grant access unless the profile explicitly says otherwise. If subscription
   columns are not provisioned yet (SQL not run) the profile carries no status
   and we deliberately keep everyone in — no accidental lock-out. */
function computeLock(profile: any): boolean {
  if (!profile) return false;
  const status = profile.subscription_status;
  if (!status) return false;
  const now = Date.now();
  const ends = [profile.subscription_ends_at, profile.trial_ends_at]
    .filter(Boolean)
    .map((v: string) => new Date(v).getTime())
    .filter((n: number) => !Number.isNaN(n));
  if (ends.some((n: number) => n > now)) return false;
  if (status === 'active' || status === 'canceling') return false;
  if (status === 'trialing' && !profile.trial_ends_at) return false;
  return true;
}

const PaywallIcons = [
  { icon: Sparkles, key: 'f1' },
  { icon: Volume2, key: 'f3' },
  { icon: BrainCircuit, key: 'f4' },
  { icon: BookOpen, key: 'f2' },
] as const;

function Paywall() {
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);

  const startCheckout = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      toast.error(`${t.subFailed}${json.error ?? ''}`);
      setBusy(false);
    } catch {
      toast.error(t.subFailed);
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up mx-auto max-w-md py-10">
      <div className="relative rounded-3xl border-2 border-primary bg-surface p-8 text-center shadow-[0_24px_60px_-20px_rgba(99,102,241,.35)]">
        <Logo href="/pricing" />
        <h1 className="mt-5 text-xl font-extrabold">{t.subTitle}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-fg">{t.subDesc}</p>

        <div className="mt-6 flex items-end justify-center gap-2">
          <span className="bg-linear-to-r from-primary to-[var(--primary-2)] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">$4.99</span>
          <span className="pb-1.5 text-sm font-semibold text-muted-fg">/ month</span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3.5 py-1.5 text-[12.5px] font-extrabold text-emerald-600 dark:text-emerald-400">
          <Clock3 className="h-3.5 w-3.5" />
          1 day free · then $4.99/month · cancel anytime
        </span>

        <div className="mt-6 grid grid-cols-2 gap-2 text-[13px] font-semibold">
          {PaywallIcons.map(({ icon: Icon, key }) => (
            <div key={key} className="flex items-center gap-2 rounded-xl border border-edge bg-background px-3 py-2.5">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              {t[key]}
            </div>
          ))}
        </div>

        <Button className="mt-7 w-full" size="lg" loading={busy && !!t.subPreparing} onClick={startCheckout}>
          {busy ? t.subPreparing : t.subStart}
        </Button>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-fg">{t.subNote}</p>
        <Link href="/pricing" className="mt-2 inline-block text-[12.5px] font-bold text-primary hover:underline">
          Full pricing details →
        </Link>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return <div className="h-[65px] border-b border-edge" />;
}

function Footer() {
  return (
    <footer className="border-t border-edge">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-5 text-sm sm:justify-between sm:px-6">
        <nav className="flex flex-wrap gap-5 text-[13px] font-semibold">
          <Link href="/pricing" className="text-muted-fg transition hover:text-primary">Pricing</Link>
          <Link href="/terms" className="text-muted-fg transition hover:text-primary">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="text-muted-fg transition hover:text-primary">Privacy Policy</Link>
        </nav>
        <a
          href="mailto:support@easier.app"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-fg transition hover:text-primary"
        >
          <Mail className="h-3.5 w-3.5" />
          support@easier.app
        </a>
        <Suspense fallback={null}>
          <FooterYear />
        </Suspense>
      </div>
    </footer>
  );
}

function FooterYear() {
  return <span className="text-[13px] text-muted-fg">© {new Date().getFullYear()} Easier</span>;
}
