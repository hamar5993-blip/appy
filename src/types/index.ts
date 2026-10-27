export interface User {
  id: string;
  email: string;
  name: string;
  stage: 'primary' | 'middle' | 'high' | 'university' | 'teacher';
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  text: string;
  pages: number;
  word_count: number;
  summary_comprehensive?: string;
  summary_bullets?: string;
  summary_legal?: string;
  flashcards?: Flashcard[];
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface Stage {
  icon: string;
  en: string;
  ar: string;
}

export const STAGES: Record<string, Stage> = {
  primary: { icon: '🎨', en: 'Primary School', ar: 'الابتدائية' },
  middle: { icon: '📘', en: 'Middle School', ar: 'المتوسطة' },
  high: { icon: '🧪', en: 'High School', ar: 'الثانوية' },
  university: { icon: '🎓', en: 'University / College', ar: 'الجامعية' },
  teacher: { icon: '🏫', en: 'Teacher / Lecturer', ar: 'معلم / محاضر جامعي' }
};
