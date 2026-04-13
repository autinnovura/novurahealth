import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — NovuraHealth',
  description: 'NovuraHealth terms of service. Rules, responsibilities, and legal terms for using the platform.',
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-[#2D5A3D] px-5 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-white/40 text-xs hover:text-white/70 transition-colors">← NovuraHealth</Link>
          <h1 className="text-white font-bold text-2xl mt-3">Terms of Service</h1>
          <p className="text-white/50 text-sm mt-1">Last updated: April 13, 2026</p>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-5 py-8">
        <div className="space-y-6 text-sm text-[#6B6B65] leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Acceptance of Terms</h2>
            <p>By accessing or using NovuraHealth (&quot;the Service&quot;), operated by Terra Robotics, LLC (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Description of Service</h2>
            <p>NovuraHealth is a web-based wellness companion application designed for people using GLP-1 medications. The Service includes health data tracking (weight, nutrition, medication, side effects, exercise, water intake), AI-powered coaching via &quot;Nova,&quot; tapering and maintenance planning tools, cost savings resources, and educational health guides. The Service is a wellness tool and is not a medical device, healthcare provider, or pharmacy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Not Medical Advice</h2>
            <p><strong className="text-[#1E1E1C]">NovuraHealth does not provide medical advice, diagnosis, or treatment.</strong> The AI coach (Nova) provides general wellness information and personalized suggestions based on your self-reported data. Nova is not a doctor, nurse, pharmacist, or licensed healthcare professional. All information provided through the Service is for educational and informational purposes only. You should not rely on information from NovuraHealth as a substitute for professional medical advice. Always consult your physician or qualified healthcare provider before making changes to your medication, diet, exercise, or health regimen. If you are experiencing a medical emergency, call 911 or your local emergency number immediately.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Eligibility</h2>
            <p>You must be at least 18 years old to use NovuraHealth. By creating an account, you represent that you are at least 18 years of age and have the legal capacity to agree to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Your Account</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to provide accurate information during registration and to update it as needed. You must notify us immediately if you suspect unauthorized access to your account. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Your Data</h2>
            <p>You retain ownership of all health data you submit to NovuraHealth. By using the Service, you grant us a limited license to store, process, and display your data solely for the purpose of providing and improving the Service. You can export or delete your data at any time through the Settings page. See our Privacy Policy for full details on how we handle your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Acceptable Use</h2>
            <p>You agree not to use the Service to submit false, misleading, or fraudulent information, attempt to access other users&apos; data, reverse-engineer, decompile, or otherwise attempt to extract source code from the Service, use automated tools (bots, scrapers) to access the Service, use the Service for any illegal purpose, or attempt to overwhelm or disrupt the Service&apos;s infrastructure.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">AI Coach Limitations</h2>
            <p>Nova, our AI coaching feature, uses artificial intelligence to generate responses. While we strive for accuracy, AI-generated content may contain errors, may not account for your complete medical history, is not a substitute for professional medical guidance, and should be verified with your healthcare provider before acting on it. We are not liable for any actions you take based on AI-generated suggestions.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Pricing and Payments</h2>
            <p>NovuraHealth is currently free during the beta period. We reserve the right to introduce paid features or subscription tiers in the future. If we do, we will provide advance notice and you will not be charged without your explicit consent. Early beta users who are granted &quot;free forever&quot; access will retain that access as described at the time of their enrollment.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Intellectual Property</h2>
            <p>The NovuraHealth name, logo, design, code, and content (excluding user-submitted data) are the property of Terra Robotics, LLC. You may not copy, modify, distribute, or create derivative works from our materials without written permission. Educational guide content may be shared with attribution to NovuraHealth.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, TERRA ROBOTICS, LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, HEALTH OUTCOMES, OR PROFITS, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US (IF ANY) IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Indemnification</h2>
            <p>You agree to indemnify and hold harmless Terra Robotics, LLC, its officers, employees, and agents from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Governing Law</h2>
            <p>These Terms are governed by and construed in accordance with the laws of the State of Nebraska, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved in the state or federal courts located in Lancaster County, Nebraska.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes via email or a notice within the app. Continued use of the Service after changes constitutes acceptance. If you disagree with updated Terms, you should stop using the Service and delete your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1E1E1C] mb-2">Contact</h2>
            <p>Questions about these Terms? Contact us at:</p>
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
