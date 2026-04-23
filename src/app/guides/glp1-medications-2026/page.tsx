import { Metadata } from 'next'
import { MEDICATIONS } from '../../lib/medications'
import type { Medication } from '../../lib/medications'

export const metadata: Metadata = {
  title: 'GLP-1 Medications Compared (2026) — Ozempic, Wegovy, Mounjaro, Foundayo & More | NovuraHealth',
  description: 'Complete comparison of every GLP-1 medication available in 2026. FDA-approved options, dosing, weight loss data, costs, and upcoming medications like retatrutide. Updated April 2026.',
  keywords: [
    'GLP-1 medications 2026', 'Ozempic vs Wegovy', 'Mounjaro vs Zepbound',
    'Foundayo orforglipron', 'oral Wegovy pill', 'retatrutide',
    'semaglutide comparison', 'tirzepatide comparison',
    'GLP-1 weight loss', 'GLP-1 cost comparison',
  ],
  openGraph: {
    title: 'GLP-1 Medications Compared (2026) — Complete Guide',
    description: 'Every GLP-1 medication compared: dosing, weight loss, costs, and what\'s coming next.',
    url: 'https://novurahealth.com/guides/glp1-medications-2026',
  },
}

function statusBadge(med: Medication) {
  if (med.status === 'available') {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    if (med.fda_approval_date && new Date(med.fda_approval_date) > sixMonthsAgo) {
      return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#7FFFA4]/20 text-[#1F4B32]">Newly Approved</span>
    }
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#EAF2EB] text-[#1F4B32]">Available</span>
  }
  if (med.status === 'coming_soon') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#EDF5FC] text-[#4A90D9]">Coming Soon</span>
  if (med.status === 'restricted') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#FFF4E8] text-[#C4742B]">Restricted</span>
  return null
}

function routeLabel(med: Medication) {
  return med.route === 'oral' ? 'Oral pill' : 'Injection'
}

export default function GLP1MedicationsGuide() {
  const available = MEDICATIONS.filter(m => m.status === 'available')
  const comingSoon = MEDICATIONS.filter(m => m.status === 'coming_soon')
  const restricted = MEDICATIONS.filter(m => m.status === 'restricted')

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Hero */}
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#7FFFA4] text-xs font-semibold uppercase tracking-wider mb-3">NovuraHealth Guide</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Every GLP-1 Medication<br />Compared for 2026
          </h1>
          <p className="text-white/70 text-sm mt-4 max-w-xl mx-auto leading-relaxed">
            From established weekly injections to the newest oral pills and triple-agonists in trials.
            FDA-sourced data on dosing, efficacy, costs, and what&apos;s coming next.
          </p>
          <p className="text-white/40 text-xs mt-3">Updated April 2026</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-10">
        {/* Quick comparison table */}
        <section>
          <h2 className="text-xl font-bold text-[#0D1F16] mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>
            At a Glance
          </h2>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-[#EAF2EB]">
                  <th className="text-left py-3 pr-3 text-[#6B7A72] font-semibold uppercase tracking-wider text-[10px]">Medication</th>
                  <th className="text-left py-3 pr-3 text-[#6B7A72] font-semibold uppercase tracking-wider text-[10px]">Type</th>
                  <th className="text-left py-3 pr-3 text-[#6B7A72] font-semibold uppercase tracking-wider text-[10px]">Frequency</th>
                  <th className="text-left py-3 pr-3 text-[#6B7A72] font-semibold uppercase tracking-wider text-[10px]">Mechanism</th>
                  <th className="text-right py-3 pr-3 text-[#6B7A72] font-semibold uppercase tracking-wider text-[10px]">Avg Weight Loss</th>
                  <th className="text-right py-3 text-[#6B7A72] font-semibold uppercase tracking-wider text-[10px]">Cost/mo</th>
                </tr>
              </thead>
              <tbody>
                {[...available, ...comingSoon].map(med => (
                  <tr key={med.id} className="border-b border-[#F5F8F3] hover:bg-[#F5F8F3]/50 transition-colors">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0D1F16]">{med.brand_names.join(' / ')}</span>
                        {statusBadge(med)}
                      </div>
                      <span className="text-[10px] text-[#6B7A72]">{med.generic_name}</span>
                    </td>
                    <td className="py-3 pr-3 text-[#6B7A72]">{routeLabel(med)}</td>
                    <td className="py-3 pr-3 text-[#6B7A72] capitalize">{med.frequency}</td>
                    <td className="py-3 pr-3 text-[#6B7A72]">{med.mechanism}</td>
                    <td className="py-3 pr-3 text-right font-semibold text-[#1F4B32]">{med.typical_weight_loss_pct}%</td>
                    <td className="py-3 text-right text-[#6B7A72]">{med.cost_monthly_range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed cards for each available medication */}
        <section>
          <h2 className="text-xl font-bold text-[#0D1F16] mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>
            FDA-Approved Medications
          </h2>
          <div className="space-y-4">
            {available.map(med => (
              <article key={med.id} className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.06)]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>
                      {med.brand_names.join(' / ')}
                    </h3>
                    <p className="text-xs text-[#6B7A72] mt-0.5">{med.generic_name} · {med.manufacturer}</p>
                  </div>
                  {statusBadge(med)}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Route</p>
                    <p className="text-sm font-bold text-[#0D1F16] mt-0.5">{routeLabel(med)}</p>
                  </div>
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Frequency</p>
                    <p className="text-sm font-bold text-[#0D1F16] mt-0.5 capitalize">{med.frequency}</p>
                  </div>
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Avg Weight Loss</p>
                    <p className="text-sm font-bold text-[#1F4B32] mt-0.5">{med.typical_weight_loss_pct}%</p>
                  </div>
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Half-life</p>
                    <p className="text-sm font-bold text-[#0D1F16] mt-0.5">
                      {med.half_life_hours >= 24 ? `${Math.round(med.half_life_hours / 24)} days` : `${med.half_life_hours} hours`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider mr-1 py-1">Doses:</span>
                  {med.available_doses.map(d => (
                    <span key={d} className="text-[10px] px-2 py-1 rounded-lg bg-[#EAF2EB] text-[#1F4B32] font-medium">{d}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7A72]">
                    {med.mechanism} · {med.fda_approval_date ? `Approved ${new Date(med.fda_approval_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
                  </span>
                  <span className="font-semibold text-[#0D1F16]">{med.cost_monthly_range}</span>
                </div>

                {med.notes && (
                  <p className="mt-3 text-xs text-[#6B7A72] leading-relaxed bg-[#F5F8F3] rounded-xl p-3">{med.notes}</p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Coming soon */}
        {comingSoon.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-[#0D1F16] mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>
              In Development
            </h2>
            {comingSoon.map(med => (
              <article key={med.id} className="bg-white border-2 border-dashed border-[#EAF2EB] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>
                      {med.generic_name}
                    </h3>
                    <p className="text-xs text-[#6B7A72] mt-0.5">{med.manufacturer} · {med.mechanism}</p>
                  </div>
                  {statusBadge(med)}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Route</p>
                    <p className="text-sm font-bold text-[#0D1F16] mt-0.5">{routeLabel(med)}, {med.frequency}</p>
                  </div>
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Trial Weight Loss</p>
                    <p className="text-sm font-bold text-[#1F4B32] mt-0.5">{med.typical_weight_loss_pct}%</p>
                  </div>
                  <div className="bg-[#F5F8F3] rounded-xl p-3">
                    <p className="text-[9px] text-[#6B7A72] uppercase tracking-wider font-semibold">Status</p>
                    <p className="text-sm font-bold text-[#4A90D9] mt-0.5">Phase 3</p>
                  </div>
                </div>

                {med.notes && (
                  <p className="text-xs text-[#6B7A72] leading-relaxed">{med.notes}</p>
                )}
              </article>
            ))}
          </section>
        )}

        {/* Restricted */}
        {restricted.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-[#0D1F16] mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>
              No Longer Available
            </h2>
            {restricted.map(med => (
              <article key={med.id} className="bg-[#FFF8F0] border border-[#C4742B]/15 rounded-3xl p-6">
                <h3 className="text-base font-bold text-[#C4742B]" style={{ fontFamily: 'var(--font-fraunces)' }}>
                  {med.brand_names.join(' / ')}
                </h3>
                {med.notes && (
                  <p className="mt-2 text-xs text-[#8B7355] leading-relaxed">{med.notes}</p>
                )}
              </article>
            ))}
          </section>
        )}

        {/* Disclaimer */}
        <section className="bg-[#F5F8F3] rounded-3xl p-6 text-xs text-[#6B7A72] leading-relaxed">
          <p className="font-semibold text-[#0D1F16] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>Medical Disclaimer</p>
          <p>
            This guide is for informational and educational purposes only and is not medical advice.
            Weight loss percentages represent trial averages — individual results vary significantly.
            Always consult your healthcare provider before starting, changing, or stopping any medication.
            Pricing may vary by insurance coverage, pharmacy, and manufacturer programs.
          </p>
          <p className="mt-2">
            Data sourced from FDA prescribing labels and published clinical trial results.
            Last updated April 2026.
          </p>
        </section>

        {/* CTA */}
        <div className="text-center py-6">
          <a href="/signup" className="inline-block bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-8 py-3.5 rounded-2xl text-sm font-semibold hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all">
            Track Your GLP-1 Journey with NovuraHealth
          </a>
          <p className="text-xs text-[#6B7A72] mt-2">Free AI health coach included</p>
        </div>
      </main>
    </div>
  )
}
