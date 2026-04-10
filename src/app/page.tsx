'use client'

import { useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState('')
  const [bottomEmail, setBottomEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [bottomSubmitted, setBottomSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent, location: 'top' | 'bottom') {
    e.preventDefault()
    const currentEmail = location === 'top' ? email : bottomEmail
    setError('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, source: location })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.')
        return
      }

      if (location === 'top') setSubmitted(true)
      else setBottomSubmitted(true)
    } catch {
      setError('Something went wrong. Try again.')
    }
  }

  return (
    <main className="bg-[#FFFBF5] text-[#2A2A28] min-h-screen">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFFBF5]/90 backdrop-blur-md border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <a href="#" className="text-xl font-bold tracking-tight text-[#2D5A3D]">
            Novura<span className="text-[#C4742B]">Health</span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/login"
              className="text-sm font-medium text-[#2D5A3D] hover:text-[#3A7A52] transition-colors"
            >
              Log in
            </a>
            <a
              href="/signup"
              className="bg-[#2D5A3D] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#3A7A52] transition-colors"
            >
              Get started free
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-36 pb-20 text-center px-6">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-[#E8F0EB] text-[#2D5A3D] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            Launching Summer 2026
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#1E1E1C] mb-5 leading-[1.1]">
            Your AI coach for the{' '}
            <span className="text-[#2D5A3D]">GLP-1 journey</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#6B6B65] max-w-xl mx-auto mb-10 leading-relaxed">
            Personalized coaching, side effect intelligence, nutrition planning, and the only transition planner built to help you thrive beyond the medication.
          </p>

          {!submitted ? (
            <form
              onSubmit={(e) => handleSubmit(e, 'top')}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4"
            >
              <input
                id="waitlist-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-5 py-3.5 rounded-full border border-black/10 bg-white text-base outline-none focus:border-[#2D5A3D] transition-colors placeholder:text-[#9B9B93]"
              />
              <button
                type="submit"
                className="bg-[#2D5A3D] text-white px-8 py-3.5 rounded-full text-base font-semibold hover:bg-[#3A7A52] transition-colors cursor-pointer whitespace-nowrap"
              >
                Join the waitlist
              </button>
            </form>
          ) : (
            <div className="bg-[#E8F0EB] text-[#2D5A3D] px-6 py-3.5 rounded-full text-base font-medium max-w-md mx-auto mb-4">
              You&apos;re on the list. We&apos;ll be in touch soon.
            </div>
          )}

          {error && (
            <p className="text-[#C4742B] text-sm mb-4">{error}</p>
          )}

          <p className="text-sm text-[#9B9B93] mb-6">
            Free to join. No spam. No medical advice. Just early access.
          </p>

          {/* TRY NOVA CTA */}
          <div className="mt-2">
            <a
              href="/signup"
              className="inline-block bg-[#C4742B] text-white px-8 py-3.5 rounded-full text-base font-semibold hover:bg-[#a86224] transition-colors"
            >
              Try Nova — AI Coach (Free)
            </a>
            <p className="text-xs text-[#9B9B93] mt-2">No credit card required. Start chatting in 60 seconds.</p>
          </div>

          {/* STATS */}
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 mt-14">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#2D5A3D]">40-70%</div>
              <div className="text-sm text-[#6B6B65] mt-1">of GLP-1 users report<br />GI side effects</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#2D5A3D]">1 in 12</div>
              <div className="text-sm text-[#6B6B65] mt-1">patients stay on GLP-1s<br />past 3 years</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#2D5A3D]">$1,000+</div>
              <div className="text-sm text-[#6B6B65] mt-1">monthly cost without<br />insurance coverage</div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="bg-[#1E1E1C] py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold text-[#E8943A] tracking-widest uppercase mb-3">The problem</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Your doctor gave you a prescription.<br />Nobody gave you a plan.
          </h2>
          <p className="text-[#9B9B93] text-lg max-w-xl mb-12">
            GLP-1 medications are powerful. But a 15-minute appointment doesn&apos;t cover nutrition, side effects, muscle loss, insurance, or what happens when you want to stop.
          </p>

          <div className="grid sm:grid-cols-3 gap-5">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7">
              <div className="w-12 h-12 rounded-xl bg-[#E8943A]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#E8943A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Side effects with no support</h3>
              <p className="text-sm text-white/50 leading-relaxed">Nausea, fatigue, and GI issues hit hard — especially during dose changes. You&apos;re left Googling at 2am instead of getting real guidance.</p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7">
              <div className="w-12 h-12 rounded-xl bg-[#F87171]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#F87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Muscle loss nobody warns you about</h3>
              <p className="text-sm text-white/50 leading-relaxed">Up to 40% of weight lost on GLP-1s can be muscle, not fat. Without the right nutrition and exercise, you&apos;re setting yourself up for regain.</p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-7">
              <div className="w-12 h-12 rounded-xl bg-[#60A5FA]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#60A5FA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No plan for life after the medication</h3>
              <p className="text-sm text-white/50 leading-relaxed">Only 1 in 12 stay on GLP-1s past 3 years. Most regain the weight fast. Nobody&apos;s helping you build the habits to keep results when the prescription ends.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold text-[#C4742B] tracking-widest uppercase mb-3">The solution</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1E1E1C] mb-4 tracking-tight">
            An AI coach that knows<br />exactly what you&apos;re going through
          </h2>
          <p className="text-[#6B6B65] text-lg max-w-xl mb-12">
            NovuraHealth is the first AI-powered wellness companion built specifically for people on GLP-1 medications. We don&apos;t prescribe. We don&apos;t sell drugs. We help you succeed.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { num: '01', title: 'AI coaching that actually understands GLP-1s', desc: 'Not a generic chatbot. A coach trained on GLP-1 nutrition, side effect management, and behavior change — available 24/7 and personalized to your medication, dose, and goals.' },
              { num: '02', title: 'Side effect intelligence', desc: 'Log symptoms in 3 taps. Our AI identifies your personal patterns — when nausea peaks, what triggers it, and what to do about it. No more guessing.' },
              { num: '03', title: 'Protein-first nutrition planning', desc: 'Meal plans designed for GLP-1 users — high protein to prevent muscle loss, easy on the stomach, and built for days when you have zero appetite.' },
              { num: '04', title: 'Insurance savings navigator', desc: 'AI that finds manufacturer savings cards, walks you through prior authorization, and helps you appeal denials. Users save an average of $200+/month.' },
              { num: '05', title: 'Transition planner', desc: "The feature nobody else has built. A structured, AI-guided plan for when you're ready to reduce or stop your medication — without losing everything you've gained." },
              { num: '06', title: 'Works with any GLP-1', desc: "Wegovy, Zepbound, Ozempic, Mounjaro, Foundayo, or whatever your doctor prescribes. We're medication-agnostic because we don't sell drugs — we just help you succeed on them." },
            ].map((f) => (
              <div key={f.num} className="bg-white border border-black/[0.06] rounded-2xl p-7 hover:border-[#2D5A3D] hover:shadow-lg hover:shadow-[#2D5A3D]/5 transition-all">
                <div className="w-8 h-8 rounded-lg bg-[#E8F0EB] text-[#2D5A3D] text-sm font-bold flex items-center justify-center mb-4">
                  {f.num}
                </div>
                <h3 className="text-lg font-semibold text-[#1E1E1C] mb-2">{f.title}</h3>
                <p className="text-sm text-[#6B6B65] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="bg-[#F5EDE0] py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold text-[#C4742B] tracking-widest uppercase mb-3">The difference</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1E1E1C] mb-4 tracking-tight">
            We&apos;re not like the others
          </h2>
          <p className="text-[#6B6B65] text-lg max-w-xl mb-12">
            Every GLP-1 app either sells you drugs or tracks your injections. We&apos;re the first one that actually coaches you through the whole journey — including the part where you don&apos;t need the drugs anymore.
          </p>

          <div className="grid sm:grid-cols-2 gap-[2px] rounded-2xl overflow-hidden bg-black/[0.06]">
            <div className="bg-[#F5EDE0] p-7">
              <p className="text-xs font-bold text-[#2D5A3D] tracking-widest uppercase mb-5">NovuraHealth</p>
              {[
                'AI coaching personalized to your medication and dose',
                'Side effect pattern recognition with actionable insights',
                'Transition planner for life after medication',
                'Insurance navigation and savings finder',
                'No prescriptions, no pharmacy, no conflict of interest',
                'Built for real people, not coastal influencers',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-[#2D5A3D] mt-1.5 shrink-0" />
                  <span className="text-sm text-[#3D3D38]">{item}</span>
                </div>
              ))}
            </div>
            <div className="bg-white p-7">
              <p className="text-xs font-bold text-[#9B9B93] tracking-widest uppercase mb-5">Everyone else</p>
              {[
                'Generic chatbots or no AI at all',
                'Basic symptom logging — no pattern intelligence',
                'No off-ramp planning (they profit from keeping you on meds)',
                'Zero insurance support',
                'Most prescribe and sell medication (conflict of interest)',
                'Premium pricing targeting affluent urban consumers',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-black/10 mt-1.5 shrink-0" />
                  <span className="text-sm text-[#6B6B65]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="bg-[#2D5A3D] py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Ready to meet your AI coach?
          </h2>
          <p className="text-white/60 text-lg mb-8">
            Sign up free and start chatting with Nova in 60 seconds. No credit card required.
          </p>

          <a
            href="/signup"
            className="inline-block bg-white text-[#2D5A3D] px-10 py-4 rounded-full text-lg font-semibold hover:bg-white/90 transition-colors mb-6"
          >
            Get started free
          </a>

          <div className="border-t border-white/10 pt-8 mt-8">
            <p className="text-white/40 text-sm mb-4">Or join the waitlist for updates</p>
            {!bottomSubmitted ? (
              <form
                onSubmit={(e) => handleSubmit(e, 'bottom')}
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <input
                  type="email"
                  required
                  value={bottomEmail}
                  onChange={(e) => setBottomEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-5 py-3.5 rounded-full border-none bg-white/15 text-white text-base outline-none focus:bg-white/25 transition-colors placeholder:text-white/45"
                />
                <button
                  type="submit"
                  className="bg-white/20 text-white px-8 py-3.5 rounded-full text-base font-semibold hover:bg-white/30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Join waitlist
                </button>
              </form>
            ) : (
              <div className="bg-white/15 text-white px-6 py-3.5 rounded-full text-base font-medium max-w-md mx-auto">
                You&apos;re on the list. We&apos;ll be in touch soon.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1E1E1C] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between gap-8">
          <div>
            <a href="#" className="text-xl font-bold tracking-tight text-white">
              Novura<span className="text-[#E8943A]">Health</span>
            </a>
            <p className="text-xs text-white/30 max-w-sm mt-3 leading-relaxed">
              NovuraHealth does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider before making changes to your medication or treatment plan. This platform is a wellness coaching tool and is not a substitute for professional medical care.
            </p>
          </div>
          <div className="text-right">
            <div className="flex gap-6 justify-end">
              <a href="#" className="text-sm text-white/40 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-white/40 hover:text-white transition-colors">Terms of Service</a>
            </div>
            <p className="text-xs text-white/30 mt-3">&copy; 2026 NovuraHealth. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
