'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSettings, stageName } from '@/components/settings';
import { toast } from 'sonner';
import { Spinner, Logo } from '@/components/ui';
import type { User } from '@/types';
import { STAGES, type StageKey } from '@/lib/i18n';
import { Moon, Sun, LogOut, ChevronDown, Plus, Check, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang, theme, toggleLang, toggleTheme } = useSettings();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!alive) return;
      if (!authUser) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      if (!alive) return;
      setUser(
        profile ?? { id: authUser.id, email: authUser.email ?? '', name: 'Student', stage: 'high', created_at: '' }
      );
    });
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
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6">{children}</main>
      <Footer />
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
