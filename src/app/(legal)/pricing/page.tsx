import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Sparkles, Mail, Clock3, Minus } from 'lucide-react';
import { Logo } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Pricing — Easier',
  description: 'Easier is currently 100% free. A Pro plan with a 1-day free trial then $4.99/month is on the way — see exactly what you get before paying.',
};

const FREE_FEATURES = [
  'Unlimited document uploads (PDF · DOCX · TXT, up to 70 pages)',
  'Paste any text or article',
  'Voice dictation (speech-to-text) for pasting',
  'Smart summaries — comprehensive, bullet points & laws/key terms',
  'Editable summaries',
  'Auto-generated flashcards with difficulty ratings',
  'Audio tutor with voice picker (incl. Arabic voices)',
  'Interactive mind maps & visual maps',
  'English & Arabic with full RTL support',
  'Light & dark themes',
  'Personal library for all your documents',
];

const PRO_FEATURES = [
  'Everything in the Free plan',
  'AI-powered deeper analysis of your documents',
  'Quizzes and exam simulation',
  'Priority audio voices & longer lessons',
  'Early access to new study features',
  'Priority support',
];

const FAQ = [
  {
    q: 'Is Easier really free right now?',
    a: 'Yes — every feature below is available at no charge, with no credit card and no trial timer.',
  },
  {
    q: 'Will I be charged automatically when Pro launches?',
    a: 'No. Pro will be opt-in: you choose the plan, authorize the payment yourself, and get a 1-day free trial first. Nothing happens without your explicit approval.',
  },
  {
    q: 'What will Pro cost?',
    a: 'One day free, then $4.99 per month. You will be able to cancel anytime before the trial ends and never pay anything.',
  },
  {
    q: 'Do I need a subscription to keep using the Free plan?',
    a: 'No. The core study features stay free for everyone — no credit card required.',
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
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-fg">
            Everything you need to study smarter — free today. A Pro plan is on the way, and you&apos;ll decide if and when to pay.
          </p>
        </div>

        <div className="animate-fade-up mx-auto mt-10 grid gap-6 sm:grid-cols-2">
          {/* Free plan — active */}
          <div className="relative rounded-3xl border-2 border-primary bg-surface p-7 shadow-[0_24px_60px_-20px_rgba(99,102,241,.35)]">
            <span className="absolute -top-3 start-6 rounded-full bg-linear-to-r from-primary to-[var(--primary-2)] px-4 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
              Available now
            </span>
            <h2 className="mt-2 text-lg font-extrabold">Free Plan</h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="bg-linear-to-r from-primary to-[var(--primary-2)] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">$0</span>
              <span className="pb-1.5 text-sm font-semibold text-muted-fg">forever · no billing cycle</span>
            </div>
            <p className="mt-2 text-[13px] text-muted-fg">
              No credit card required · nothing expires
            </p>

            <ul className="mt-6 space-y-2.5">
              {FREE_FEATURES.map((f) => (
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
              Get started free
            </Link>
          </div>

          {/* Pro — coming soon */}
          <div className="relative rounded-3xl border border-edge bg-surface/60 p-7">
            <span className="absolute -top-3 start-6 rounded-full border border-edge bg-surface px-4 py-1 text-[11px] font-extrabold uppercase tracking-wide text-muted-fg">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" />
                Coming soon
              </span>
            </span>
            <h2 className="mt-2 text-lg font-extrabold">Pro Plan</h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[26px] font-extrabold tracking-tight text-muted-fg/80">$4.99</span>
              <span className="pb-1 text-[13px] font-semibold text-muted-fg/80">per month</span>
            </div>
            <p className="mt-2 text-[13px] text-muted-fg">
              <strong className="font-bold text-text">1 day free trial</strong> first · cancel anytime · only pay after you authorize it yourself
            </p>

            <ul className="mt-6 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] leading-snug text-muted-fg">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10">
                    <Check className="h-3 w-3 text-primary" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              disabled
              className="mt-7 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-edge py-3 text-sm font-bold text-muted-fg opacity-70"
            >
              <Minus className="h-4 w-4" />
              Opening soon
            </button>
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
