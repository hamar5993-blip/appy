import type { Metadata } from 'next';
import { LegalLayout, Section } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Terms & Conditions — Easier',
  description: 'Terms and conditions for using the Easier AI study companion.',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms &amp; Conditions" updated="October 27, 2026">
      <p>
        Welcome to <strong>Easier</strong> (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;). By creating an
        account or using Easier, you agree to these Terms &amp; Conditions. Please read them carefully.
      </p>

      <Section title="1. What Easier does">
        <p>
          Easier is an AI-powered study companion. You upload documents (PDF, DOCX, TXT) or paste text, and the
          app generates study materials for you: summaries, flashcards, quizzes, audio lessons and visual maps.
        </p>
      </Section>

      <Section title="2. Your account">
        <ul>
          <li>You must provide a valid email address and accurate information when signing up.</li>
          <li>You are responsible for keeping your password secure and for all activity under your account.</li>
          <li>You must be at least 13 years old (or the minimum digital-consent age in your country) to use Easier.</li>
          <li>You may stop using the app and delete your account and documents at any time.</li>
        </ul>
      </Section>

      <Section title="3. Your content">
        <ul>
          <li>You keep all ownership rights to documents and text you upload (&quot;your content&quot;).</li>
          <li>You grant Easier a limited license to process your content solely to generate the study materials you request.</li>
          <li>You confirm you have the right to upload and use any content you submit — do not upload content you are not allowed to use.</li>
        </ul>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree <strong>not</strong> to:</p>
        <ul>
          <li>Upload illegal, harmful, or infringing content, or content you do not own or have permission to use.</li>
          <li>Attempt to disrupt, overload or reverse-engineer the service, or access data of other users.</li>
          <li>Use Easier to cheat in violation of your school&apos;s or institution&apos;s academic policies.</li>
        </ul>
      </Section>

      <Section title="5. AI-generated materials">
        <p>
          Summaries, flashcards, quizzes and other study materials are generated automatically and may contain
          errors or omissions. They are provided for study assistance only and are <strong>not</strong> a
          substitute for your own learning, judgment, or professional advice. Always verify important
          information against your original sources.
        </p>
      </Section>

      <Section title="6. Availability and changes">
        <p>
          We work hard to keep Easier available, but we do not guarantee uninterrupted or error-free service.
          We may add, change or remove features, and may suspend or discontinue the service at any time. These
          terms may be updated occasionally; continued use after changes means you accept the updated terms.
        </p>
      </Section>

      <Section title="7. Billing, refunds and cancellations">
        <p>
          <strong>Subscription &amp; pricing:</strong> Easier is offered as a subscription of{' '}
          <strong>$4.99 per month</strong>, which includes a <strong>1-day free trial</strong>. Every
          feature — document uploads, summaries, flashcards, audio lessons and visual maps — is part of
          the single subscription plan; there is no free tier.
        </p>
        <p>
          <strong>Trial:</strong> your trial day starts when your account is created. Nothing is charged
          during the trial. If you cancel before the trial ends, you will not be billed at all.
        </p>
        <p>
          <strong>Renewal:</strong> after the trial, the subscription renews automatically each month at
          $4.99 unless canceled before the renewal date. Payments are processed by our payment provider
          (Waffo); we never see or store your card details.
        </p>
        <p>
          <strong>Cancellation:</strong> you can cancel at any time through your account or by contacting{' '}
          <a href="mailto:support@easier.app">support@easier.app</a>. Canceling stops future charges, and
          your access continues until the end of the paid period you have already paid for. If you cancel
          during the trial day, access ends when the trial ends and you owe nothing.
        </p>
        <p>
          <strong>Refunds:</strong> because you are billed monthly and can cancel at any time before the
          next renewal, refunds for partial months are generally not owed. Any statutory consumer rights
          that apply in your jurisdiction are unaffected. If you believe you were charged in error,
          contact us at{' '}
          <a href="mailto:billing@easier.app">billing@easier.app</a> and we will resolve it promptly.
        </p>
      </Section>

      <Section title="8. Termination">
        <p>
          We may suspend or terminate your account if you violate these terms. You may cancel at any time by
          deleting your account. When your account is deleted, your documents and profile data are removed
          from our systems.
        </p>
      </Section>

      <Section title="9. Availability and changes">
        <p>
          We work hard to keep Easier available, but we do not guarantee uninterrupted or error-free service.
          We may add, change or remove features, and may suspend or discontinue the service at any time. These
          terms may be updated occasionally; continued use after changes means you accept the updated terms.
        </p>
      </Section>

      <Section title="10. Disclaimer and limitation of liability">
        <p>
          Easier is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted
          by law, Easier and its operators are not liable for any indirect, incidental or consequential
          damages arising from your use of the app, including academic outcomes or lost data.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about these terms? Contact us at{' '}
          <a href="mailto:support@easier.app">support@easier.app</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
