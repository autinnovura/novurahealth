import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — NovuraHealth',
  description: 'NovuraHealth privacy policy. How we collect, use, and protect your personal health data.',
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-[#2D5A3D] px-5 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-white/40 text-xs hover:text-white/70 transition-colors">← NovuraHealth</Link>
          <h1 className="text-white font-bold text-2xl mt-3">Privacy Policy</h1>
          <p className="text-white/50 text-sm mt-1">Last updated: April 13, 2026</p>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-5 py-8">
        <div className="space-y-6 text-sm text-[#6B6B65] leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Overview</h2>
            <p>NovuraHealth (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is operated by Terra Robotics, LLC. We are committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, and safeguard your information when you use our web application at novurahealth.com.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Information We Collect</h2>
            <p className="mb-2"><strong className="text-[#1E1E1C]">Account Information:</strong> When you create an account, we collect your email address and the password you create. Passwords are encrypted and never stored in plain text.</p>
            <p className="mb-2"><strong className="text-[#1E1E1C]">Profile Information:</strong> During onboarding, you provide your name, medication type, dose, start date, weight, goal weight, and other health-related preferences. This information is used to personalize your experience.</p>
            <p className="mb-2"><strong className="text-[#1E1E1C]">Health Data You Log:</strong> This includes food logs, weight entries, medication/injection logs, water intake, exercise logs, side effect reports, mood and energy check-ins, and tapering check-ins. You choose what to log — all logging is voluntary.</p>
            <p className="mb-2"><strong className="text-[#1E1E1C]">Chat Messages:</strong> Conversations with Nova (our AI coach) are stored to provide continuity in your coaching experience. These messages are used only to improve your personal experience and are not shared with third parties.</p>
            <p><strong className="text-[#1E1E1C]">Usage Data:</strong> We collect basic analytics about how you use the app (pages visited, features used) to improve the product. We do not use third-party tracking pixels or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">How We Use Your Information</h2>
            <p>We use your information to provide and personalize the NovuraHealth service, including generating AI coaching responses based on your health data, sending you weekly progress emails (which you can opt out of), improving the app based on aggregate usage patterns, and communicating with you about your account or important updates. We do not sell your data. We do not share your data with advertisers. We do not use your data to train AI models.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">AI Coaching (Nova)</h2>
            <p>Nova, our AI coach, accesses your health data (weight, food logs, medication history, side effects, etc.) to provide personalized guidance. Your data is sent to Anthropic&apos;s API to generate responses. Anthropic does not retain your data for training purposes per their data usage policy. Nova does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider for medical decisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Data Storage and Security</h2>
            <p>Your data is stored in a secure Supabase database hosted in the United States (AWS us-east-2). All data is encrypted in transit (TLS/HTTPS) and at rest. We use row-level security (RLS) policies to ensure each user can only access their own data. No other user can see your information. Access to our database is restricted to essential personnel only.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Data Sharing</h2>
            <p className="mb-2">We do not sell, rent, or trade your personal information. We share data only with the following service providers who are necessary to operate the platform:</p>
            <p className="mb-1"><strong className="text-[#1E1E1C]">Supabase</strong> — database hosting and authentication</p>
            <p className="mb-1"><strong className="text-[#1E1E1C]">Vercel</strong> — web hosting and deployment</p>
            <p className="mb-1"><strong className="text-[#1E1E1C]">Anthropic</strong> — AI model provider for Nova coaching responses</p>
            <p><strong className="text-[#1E1E1C]">Resend</strong> — email delivery service</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Your Rights</h2>
            <p>You have the right to access all data we store about you (available via the Data Export feature in Settings), correct any inaccurate information in your profile, delete your account and all associated data, and opt out of marketing emails at any time. To exercise any of these rights, email us at support@novurahealth.com or use the relevant features within the app.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days. Anonymized, aggregate data (which cannot identify you) may be retained indefinitely for product improvement purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Children&apos;s Privacy</h2>
            <p>NovuraHealth is not intended for users under the age of 18. We do not knowingly collect information from children. If we learn that we have collected data from a user under 18, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a notice within the app. Your continued use of NovuraHealth after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Contact</h2>
            <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
            <p className="mt-2">
              <strong className="text-[#1E1E1C]">Terra Robotics, LLC</strong><br />
              Lincoln, Nebraska<br />
              <a href="mailto:support@novurahealth.com" className="text-[#2D5A3D] font-medium">support@novurahealth.com</a>
            </p>
          </section>

        </div>
      </article>
    </div>
  )
}
