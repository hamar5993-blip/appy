'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Document } from '@/types';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [summaryMode, setSummaryMode] = useState<'comprehensive' | 'bullets' | 'legal'>('comprehensive');

  useEffect(() => {
    fetchDocument();
  }, [params.id]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error: any) {
      toast.error(error.message);
      router.push('/library');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = () => {
    if (!document) return { html: '', text: '' };
    
    const sentences = document.text.match(/[^.!?؟۔]+[.!?؟۔]+|[^.!?؟۔]+$/g) || [];
    const cleanSentences = sentences.map((s: string) => s.trim()).filter((s: string) => s.split(' ').length >= 3);
    
    const ratio = 0.3;
    const n = Math.max(3, Math.round(cleanSentences.length * ratio));
    const selected = cleanSentences.slice(0, Math.min(n, cleanSentences.length));
    
    if (summaryMode === 'bullets' || summaryMode === 'legal') {
      const html = '<ul class="s-list">' + selected.map((s: string) => `<li>${s}</li>`).join('') + '</ul>';
      return { html, text: selected.join(' ') };
    } else {
      const html = selected.map((s: string) => `<p>${s}</p>`).join('');
      return { html, text: selected.join(' ') };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!document) return null;

  const summary = generateSummary();
  const words = document.text.trim().split(/\s+/).length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/library')} className="p-2 rounded-xl border hover:border-[var(--primary)] transition" style={{ borderColor: 'var(--border)' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">{document.title}</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {document.pages} pages · {words.toLocaleString()} words
            </p>
          </div>
        </div>
        <button onClick={() => router.push('/upload')} className="flex items-center gap-2 px-6 py-2.5 rounded-full border hover:border-[var(--primary)] hover:text-[var(--primary)] transition" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <Sparkles className="w-4 h-4" />
          + New document
        </button>
      </div>

      <nav className="flex gap-2 overflow-x-auto mb-6 pb-1">
        {[
          { id: 'summary', label: '📄 Summary' },
          { id: 'flashcards', label: '🎴 Flashcards' },
          { id: 'audio', label: '🔊 Audio Tutor' },
          { id: 'visual', label: '🧠 Infographic' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2 rounded-full border whitespace-nowrap transition ${activeTab === tab.id ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] text-white border-transparent' : ''}`}
            style={{ borderColor: activeTab === tab.id ? 'transparent' : 'var(--border)', color: activeTab === tab.id ? 'white' : 'var(--muted)' }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'summary' && (
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div className="flex gap-2">
              {[
                { id: 'comprehensive', label: 'Comprehensive' },
                { id: 'bullets', label: 'Bullet points' },
                { id: 'legal', label: 'Laws and key terms' },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSummaryMode(mode.id as any)}
                  className={`px-4 py-1.5 rounded-full border text-sm font-semibold transition ${summaryMode === mode.id ? 'bg-[rgba(99,102,241,0.12)] text-[var(--primary)] border-[var(--primary)]' : ''}`}
                  style={{ borderColor: summaryMode === mode.id ? 'var(--primary)' : 'var(--border)', color: summaryMode === mode.id ? 'var(--primary)' : 'var(--muted)' }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="prose max-w-none" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: summary.html }} />
        </div>
      )}

      {activeTab === 'flashcards' && (
        <div className="rounded-2xl border p-6 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
          <p style={{ color: 'var(--muted)' }}>Flashcards and Quiz - Coming soon with OpenRouter AI</p>
        </div>
      )}

      {activeTab === 'audio' && (
        <div className="rounded-2xl border p-6 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
          <p style={{ color: 'var(--muted)' }}>Audio Tutor - Coming soon</p>
        </div>
      )}

      {activeTab === 'visual' && (
        <div className="rounded-2xl border p-6 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
          <p style={{ color: 'var(--muted)' }}>Infographic - Coming soon</p>
        </div>
      )}
    </div>
  );
}
