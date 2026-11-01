export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  /* subscription (Waffo) — present once the SQL in supabase/subscriptions.sql is applied */
  subscription_status?: 'trialing' | 'active' | 'canceling' | 'past_due' | 'canceled' | '';
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  waffo_order_id?: string | null;
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
