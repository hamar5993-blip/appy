'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/components/settings';
import { Button, EmptyState, Spinner } from '@/components/ui';
import type { Document } from '@/types';
import { toast } from 'sonner';
import { Plus, Search, Trash2, FileText, ArrowRight, Clock3, FileWarning } from 'lucide-react';
import { cn, trunc } from '@/lib/utils';

export default function LibraryPage() {
  const { t, lang } = useSettings();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('documents')
          .select('id, user_id, title, pages, word_count, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setDocuments((data ?? []) as Document[]);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const deleteDocument = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      setDocuments((d) => d.filter((x) => x.id !== id));
      toast.success(t.docDeleted);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = documents.filter((d) =>
    (d.title ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8 h-9 w-48 animate-shimmer rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-shimmer rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      {/* Page head */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[27px]">{t.myLibrary}</h1>
          <p className="mt-1 text-sm text-muted-fg">{t.docsCount(documents.length)}</p>
        </div>
        <Link href="/upload">
          <Button size="md">
            <Plus className="h-4 w-4" />
            {t.newStudy}
          </Button>
        </Link>
      </div>

      {/* Search */}
      {documents.length > 0 && (
        <div className="relative mt-7 max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-4 h-4 w-4 -translate-y-1/2 text-muted-fg" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPh}
            className="w-full rounded-full border border-edge bg-surface py-2.5 pe-4 ps-11 text-sm transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
      )}

      {/* Grid */}
      {documents.length === 0 ? (
        <EmptyState
          icon="📚"
          title={t.emptyLibrary}
          description={t.emptyLibraryDesc}
          action={
            <Link href="/upload">
              <Button size="lg">
                <Plus className="h-4 w-4" />
                {t.newStudy}
              </Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileSearch className="h-7 w-7 text-primary" />} title={t.searchPh} />
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                'group relative flex flex-col justify-between rounded-2xl border border-edge bg-surface p-5 transition-all duration-200',
                'hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_16px_36px_-14px_rgba(99,102,241,.3)]',
                deleting === doc.id && 'scale-95 opacity-0'
              )}
            >
              <div className="flex items-start gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary/15 to-[var(--primary-2)]/20 text-xl">
                  📄
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/document/${doc.id}`}
                    className="block truncate font-bold leading-snug transition group-hover:text-primary"
                    title={doc.title}
                  >
                    {trunc(doc.title ?? '—', 44)}
                  </Link>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-fg">
                    {doc.pages} {lang === 'ar' ? 'صفحة' : 'pages'} · {(doc.word_count ?? 0).toLocaleString()} {lang === 'ar' ? 'كلمة' : 'words'}
                  </p>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="rounded-lg p-2 text-muted-fg opacity-0 transition hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-fg">
                  <Clock3 className="h-3 w-3" />
                  {fmtDate(doc.created_at)}
                </span>
                <Link
                  href={`/document/${doc.id}`}
                  className="inline-flex items-center gap-1 text-[13px] font-bold text-primary opacity-80 transition group-hover:opacity-100"
                >
                  {t.open}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileSearch(props: React.SVGProps<SVGSVGElement>) {
  return <FileText {...props} />;
}
