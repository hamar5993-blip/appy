'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { Moon, Sun, LogOut, Globe } from 'lucide-react';
import { toast } from 'sonner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile);
      }
      setLoading(false);
    };

    checkAuth();

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    const savedLang = localStorage.getItem('lang') as 'en' | 'ar';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
    if (savedLang) {
      setLang(savedLang);
      document.documentElement.lang = savedLang;
      document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'ar' : 'en';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 py-3 backdrop-blur-xl border-b" style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>
        <Link href="/library" className="flex items-center gap-2 text-xl font-extrabold bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] bg-clip-text text-transparent">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="url(#grad3)">
            <defs>
              <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--primary-2)" />
              </linearGradient>
            </defs>
            <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>
          </svg>
          Easier
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="w-9 h-9 rounded-xl border flex items-center justify-center hover:border-[var(--primary)] transition" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            {lang === 'en' ? 'ع' : 'EN'}
          </button>
          <button onClick={toggleTheme} className="w-9 h-9 rounded-xl border flex items-center justify-center hover:border-[var(--primary)] transition" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          {user && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 px-3 py-1.5 rounded-full border hover:border-[var(--primary)] transition" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] flex items-center justify-center text-white text-sm font-bold">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold">{user.name}</div>
                </div>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="mb-3">
                    <div className="font-bold">{user.name}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</div>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full border hover:border-[var(--primary)] hover:text-[var(--primary)] transition" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
