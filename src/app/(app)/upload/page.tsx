'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');

  const extractTextFromPDF = async (file: File): Promise<{ text: string; pages: number }> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, 70);
    let fullText = '';
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as any[]).map((item) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return { text: fullText.trim(), pages: pdf.numPages };
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractTextFromTXT = async (file: File): Promise<string> => {
    return await file.text();
  };

  const processFile = async (file: File) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let text = '';
      let pages = 1;
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        const result = await extractTextFromPDF(file);
        text = result.text;
        pages = result.pages;
      } else if (ext === 'docx' || ext === 'doc') {
        text = await extractTextFromDOCX(file);
        pages = Math.max(1, Math.round(text.split(/\s+/).length / 300));
      } else if (ext === 'txt' || ext === 'md') {
        text = await extractTextFromTXT(file);
        pages = Math.max(1, Math.round(text.split(/\s+/).length / 300));
      } else {
        throw new Error('Unsupported format. Please use PDF, DOCX or TXT.');
      }

      if (text.length < 60) {
        throw new Error("Couldn't extract readable text from this document.");
      }

      if (pages > 70) {
        toast.error('Document exceeds 70 pages — processed the first 70.');
      }

      const wordCount = text.trim().split(/\s+/).length;
      const title = file.name.replace(/\.[^.]+$/, '');

      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title,
          text,
          pages: Math.min(pages, 70),
          word_count: wordCount,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Your study set is ready!');
      router.push(`/document/${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const processPaste = async () => {
    if (pasteText.trim().length < 200) {
      toast.error('Please paste a longer text (at least ~200 characters).');
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const text = pasteText.trim();
      const pages = Math.max(1, Math.round(text.split(/\s+/).length / 300));
      const wordCount = text.split(/\s+/).length;
      const title = pasteTitle.trim() || text.split(/\s+/).slice(0, 6).join(' ');

      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title,
          text,
          pages,
          word_count: wordCount,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Your study set is ready!');
      router.push(`/document/${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  if (processing) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(8, 10, 22, 0.6)', backdropFilter: 'blur(6px)' }}>
        <div className="text-center text-white">
          <div className="w-14 h-14 border-4 border-white/20 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-semibold">Extracting text... Analyzing content... Building your study assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-extrabold">Create a new study set</h1>
        <button onClick={() => router.push('/library')} className="flex items-center gap-2 px-6 py-2.5 rounded-full border hover:border-[var(--primary)] hover:text-[var(--primary)] transition" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <FileText className="w-4 h-4" />
          Library
        </button>
      </div>

      <div className="flex gap-2 p-1 rounded-xl mb-6 max-w-xs mx-auto" style={{ background: 'var(--bg)' }}>
        <button
          onClick={() => setMode('file')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition ${mode === 'file' ? 'bg-[var(--surface)] shadow' : ''}`}
          style={{ color: mode === 'file' ? 'var(--primary)' : 'var(--muted)' }}
        >
          Upload file
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition ${mode === 'paste' ? 'bg-[var(--surface)] shadow' : ''}`}
          style={{ color: mode === 'paste' ? 'var(--primary)' : 'var(--muted)' }}
        >
          Paste text
        </button>
      </div>

      {mode === 'file' && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition ${isDragging ? 'border-[var(--primary)] bg-[rgba(99,102,241,0.07)] scale-[1.008]' : ''}`}
            style={{ background: 'var(--surface)', borderColor: isDragging ? 'var(--primary)' : 'var(--border)', boxShadow: 'var(--shadow)' }}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--primary)' }} />
            <h3 className="font-bold text-lg mb-1">Drag and drop your document here</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>PDF · DOCX · TXT — up to 70 pages</p>
            <button className="px-6 py-2.5 rounded-full font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)]">
              Browse files
            </button>
            <input id="fileInput" type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={handleFileSelect} className="hidden" />
          </div>
        </div>
      )}

      {mode === 'paste' && (
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-4 py-2.5 rounded-xl border mb-3 outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your lesson, article or chapter here… (200+ characters works best)"
              className="w-full h-48 px-4 py-3 rounded-xl border resize-y outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <button onClick={processPaste} className="w-full mt-4 py-3 rounded-full font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] hover:brightness-110 transition">
              Summarize text
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {[
          { icon: '📝', text: 'Smart Summaries' },
          { icon: '🎴', text: 'Flashcards and Quiz' },
          { icon: '🎧', text: 'Audio Tutor' },
          { icon: '🧠', text: 'Visual Maps' },
        ].map((f, i) => (
          <div key={i} className="text-center p-4 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
            <div className="text-2xl mb-2">{f.icon}</div>
            <p className="font-bold text-sm">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
