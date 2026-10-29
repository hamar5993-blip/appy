import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Sparkles, Mail, Clock3 } from 'lucide-react';
import { Logo } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Pricing — Easier',
  description: 'One simple plan: 1 day free, then $4.99/month. Cancel anytime — keep access until the end of your paid period.',
};

const FEATURES = [
  'Unlimited document uploads (PDF · DOCX · TXT, up to 70 pages)',
  'Paste any text — or dictate it with your voice',
  'Smart summaries — comprehensive, bullet points & laws/key terms',
  'Editable summaries',
  'Auto-generated flashcards with difficulty ratings',
  'Interactive mind maps & visual maps',
  'English & Arabic with full RTL support',
  'Light & dark themes',
  'Personal library for all your documents',
];

const FAQ = [
  {
    q: 'How does the free trial work?',
    a: 'Your 1-day free trial starts as soon as you sign up — no payment is collected during the trial. If you cancel before it ends, you are never charged at all.',
  },
  {
    q: 'Can I cancel?',
    a: 'Anytime, from checkout or your account. Your subscription stays active until the end of the period you already paid for.',
  },
  {
    q: 'Do you offer a free tier?',
    a: 'No — Easier is a paid subscription with a 1-day free trial. Everyone gets the full trial day to try every feature before paying.',
  },
  {
    q: 'Is there a long-term commitment?',
    a: 'No. It is a simple monthly plan at $4.99/month. Cancel any time — no cancellation fees, no questions asked.',
  },
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
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">One simple plan</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-fg">
            Every feature included. 1 day free, then $4.99/month — cancel anytime.
          </p>
        </div>

        <div className="animate-fade-up mx-auto mt-10 max-w-md">
          <div className="relative rounded-3xl border-2 border-primary bg-surface p-7 shadow-[0_24px_60px_-20px_rgba(99,102,241,.35)]">
            <span className="absolute -top-3 start-6 inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] px-4 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
              <Clock3 className="h-3 w-3" />
              1-day free trial included
            </span>
            <h2 className="mt-2 text-lg font-extrabold">Easier Subscription</h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="bg-linear-to-r from-primary to-[var(--primary-2)] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">$4.99</span>
              <span className="pb-1.5 text-sm font-semibold text-muted-fg">per month · billed monthly</span>
            </div>
            <p className="mt-2 text-[13px] text-muted-fg">
              Nothing is charged during your free trial day. Cancel before it ends and you pay nothing at all.
            </p>

            <ul className="mt-6 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] leading-snug">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(99,102,241,.35)] transition hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(99,102,241,.45)]"
            >
              <Sparkles className="h-4 w-4" />
              Start your 1-day free trial
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="animate-fade-up mt-12">
          <h2 className="text-xl font-extrabold">Frequently asked</h2>
          <div className="mt-5 space-y-3">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="rounded-2xl border border-edge bg-surface p-5">
                <h3 className="text-[15px] font-bold">{q}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-fg">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up mt-8 rounded-2xl border border-edge bg-surface p-5 text-center text-[13.5px] leading-relaxed text-muted-fg">
          You will never be billed without first seeing the price, the billing cycle, and giving explicit payment
          authorization. See our{' '}
          <Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link> and{' '}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
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
