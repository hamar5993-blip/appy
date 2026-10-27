import type { Metadata } from 'next';
import { LegalLayout, Section } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy — Easier',
  description: 'How Easier collects, uses and protects your data.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="October 27, 2026">
      <p>
        Your privacy matters. This policy explains what data <strong>Easier</strong> collects, how it is used,
        and the choices you have. By using the app you agree to this policy.
      </p>

      <Section title="1. What we collect">
        <ul>
          <li><strong>Account data:</strong> your name, email address, and the educational stage you select — stored in Supabase when you create an account.</li>
          <li><strong>Your documents:</strong> the documents you upload (PDF/DOCX/TXT) or paste, and their generated text, summaries and flashcards.</li>
          <li><strong>Study activity:</strong> flashcard difficulty ratings and quiz scores, saved so you can track progress.</li>
          <li><strong>Preferences (stored locally on your device):</strong> language (English/Arabic) and light/dark theme preference.</li>
          <li><strong>Usage data:</strong> standard hosting and security logs (such as IP address and request time) kept by our infrastructure providers.</li>
        </ul>
      </Section>

      <Section title="2. How we use your data">
        <ul>
          <li>To provide the service: extract document text and generate summaries, flashcards, quizzes and audio.</li>
          <li>To operate your account and show your library across devices.</li>
          <li>To personalize results for your educational stage.</li>
          <li>To keep the service secure, prevent abuse and comply with law.</li>
        </ul>
        <p>We do <strong>not</strong> sell your personal data, and we do not use your documents to advertise to you.</p>
      </Section>

      <Section title="3. Third-party processors">
        <p>We rely on trusted providers to operate Easier:</p>
        <ul>
          <li><strong>Supabase</strong> — account authentication and database hosting of your documents.</li>
          <li><strong>OpenRouter / AI language models</strong> — document text may be sent to AI models to generate summaries, flashcards and quizzes. We send only the text needed for the feature you request.</li>
          <li><strong>Vercel / hosting &amp; infrastructure</strong> — serving the app and standard security logs.</li>
          <li><strong>Your browser</strong> — audio playback uses your device&apos;s built-in speech engine; audio is not stored by us.</li>
        </ul>
        <p>
          These providers process data on our behalf under their own privacy and security terms.
        </p>
      </Section>

      <Section title="4. Data sharing">
        <p>
          We share data only with the processors above, and only as necessary to run the service, or when
          required by law. Your documents are private to your account and are never published.
        </p>
      </Section>

      <Section title="5. Data retention and deletion">
        <ul>
          <li>Your documents and profile are retained while your account is active.</li>
          <li>Deleting a document removes it permanently from our database.</li>
          <li>Deleting your account (or requesting deletion at <a href="mailto:privacy@easier.app">privacy@easier.app</a>) removes your profile and all stored documents.</li>
        </ul>
      </Section>

      <Section title="6. Security">
        <p>
          Data is transmitted over HTTPS and stored with row-level security so that only you can access your
          documents. No service is perfectly secure, but we use industry-standard practices to protect your data.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>
          Depending on your region, you may have the right to access, correct, export or delete your personal
          data. Uploads and accounts are under your direct control in the app, and you can contact us at{' '}
          <a href="mailto:privacy@easier.app">privacy@easier.app</a> for any privacy request.
        </p>
      </Section>

      <Section title="8. Children">
        <p>
          Easier is not directed at children under 13. If we learn that an account belongs to a child under
          the required age, we will delete it.
        </p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          We may update this policy as the service evolves. The &quot;last updated&quot; date at the top will
          always show the current version.
        </p>
      </Section>
    </LegalLayout>
  );
}
