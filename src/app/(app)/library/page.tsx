'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Document } from '@/types';
import { Plus, Search, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Delete this document permanently?')) return;
    
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      setDocuments(documents.filter(d => d.id !== id));
      toast.success('Document deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-extrabold">My Library</h1>
        <Link href="/upload" className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] hover:brightness-110 transition">
          <Plus className="w-4 h-4" />
          New study set
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </span>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your documents…"
            className="w-full pl-10 pr-4 py-2 rounded-full border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--muted)' }} />
          <p className="mb-4" style={{ color: 'var(--muted)' }}>
            {documents.length === 0 ? "Nothing here yet — create your first study set!" : "No documents match your search"}
          </p>
          {documents.length === 0 && (
            <Link href="/upload" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)]">
              <Plus className="w-4 h-4" />
              New study set
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-4 rounded-2xl border hover:border-[rgba(99,102,241,0.45)] hover:-translate-y-0.5 transition" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
              <div className="w-12 h-12 rounded-xl bg-[rgba(99,102,241,0.12)] flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6" style={{ color: 'var(--primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/document/${doc.id}`} className="font-semibold block truncate hover:text-[var(--primary)] transition">
                  {doc.title}
                </Link>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {doc.pages} pages · {doc.word_count?.toLocaleString()} words · {format(new Date(doc.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/document/${doc.id}`} className="px-4 py-1.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)]">
                  Open
                </Link>
                <button onClick={() => deleteDocument(doc.id)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
