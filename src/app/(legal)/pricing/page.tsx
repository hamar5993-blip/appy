import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Sparkles, Mail } from 'lucide-react';
import { Logo } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Pricing — Easier',
  description: 'Easier is 100% free. All study features included — no credit card required.',
};

const FEATURES = [
  'Unlimited document uploads (PDF · DOCX · TXT, up to 70 pages)',
  'Paste any text or article',
  'Smart summaries — comprehensive, bullet points & laws/key terms',
  'Auto-generated flashcards with difficulty ratings',
  'Audio tutor (text-to-speech lessons)',
  'English & Arabic with full RTL support',
  'Light & dark themes',
  'Personal library for all your documents',
];

export default function PricingPage() {
  return (
    <div className="relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-10 flex items-center justify-between">
          <Logo href="/" />
          <Link
            href="/"
            className="rounded-full border border-edge bg-surface px-4 py-2 text-[13px] font-semibold transition hover:border-primary hover:text-primary"
          >
            Back to app
          </Link>
        </div>

        <div className="animate-fade-up text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Simple pricing</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-fg">
            Everything you need to study smarter — for free.
          </p>
        </div>

        <div className="animate-fade-up mx-auto mt-10 max-w-md">
          <div className="relative rounded-3xl border-2 border-primary bg-surface p-8 shadow-[0_24px_60px_-20px_rgba(99,102,241,.35)]">
            <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] px-4 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white rtl:translate-x-1/2">
              Most generous
            </span>
            <h2 className="text-lg font-extrabold">Free Plan</h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="bg-linear-to-r from-primary to-[var(--primary-2)] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">$0</span>
              <span className="pb-1.5 text-sm font-semibold text-muted-fg">forever · no billing cycle</span>
            </div>
            <p className="mt-2 text-[13px] text-muted-fg">
              No credit card required · no trial period · nothing expires
            </p>

            <ul className="mt-7 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px]">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(99,102,241,.35)] transition hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(99,102,241,.45)]"
            >
              <Sparkles className="h-4 w-4" />
              Get started free
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-edge bg-surface p-5 text-center text-[13px] leading-relaxed text-muted-fg">
            Paid plans may be introduced in the future for higher limits and early features — but everything
            above will always remain free. Whenever billing happens, we&apos;ll say so first. See our{' '}
            <Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link> and{' '}
            <Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
          </div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-8 text-sm">
          <Link href="/terms" className="text-muted-fg transition hover:text-primary">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="text-muted-fg transition hover:text-primary">Privacy Policy</Link>
          <a
            href="mailto:support@easier.app"
            className="inline-flex items-center gap-1.5 font-semibold text-muted-fg transition hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5" />
            support@easier.app
          </a>
          <span className="text-muted-fg">© Easier</span>
        </footer>
      </div>
    </div>
  );
}
