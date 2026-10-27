'use client';

import { Logo } from '@/components/ui';
import { useSettings } from '@/components/settings';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function LegalLayout({ title, updated, children }: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-10 flex items-center justify-between">
          <Logo href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-4 py-2 text-[13px] font-semibold transition hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            Back to app
          </Link>
        </div>

        <article className="animate-fade-up rounded-3xl border border-edge bg-surface p-8 shadow-[0_16px_50px_-20px_rgba(99,102,241,.2)] sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-fg">Last updated: {updated}</p>
          <div className="legal-body mt-8 space-y-8 text-[14.5px] leading-[1.85] text-text [&_a]:font-semibold [&_a]:text-primary [&_a]:hover:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:ps-6">
            {children}
          </div>
        </article>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-8 text-sm">
          <Link href="/pricing" className="text-muted-fg transition hover:text-primary">Pricing</Link>
          <Link href="/terms" className="text-muted-fg transition hover:text-primary">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="text-muted-fg transition hover:text-primary">Privacy Policy</Link>
          <span className="text-muted-fg">© Easier</span>
        </footer>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </section>
  );
}
