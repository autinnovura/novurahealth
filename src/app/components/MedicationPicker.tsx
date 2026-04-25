'use client'

import { useState, useEffect } from 'react'
import { Syringe, Pill, X, Clock, Info, ChevronDown } from 'lucide-react'
import {
  getAvailableMedications, getComingSoonMedications,
  type Medication, MEDICATIONS,
} from '../lib/medications'

export interface MedicationMetadata {
  custom_half_life_hours?: number | null
  custom_tmax_hours?: number | null
}

interface MedicationPickerProps {
  value: string
  onChange: (medication: string) => void
  onDoseChange?: (dose: string) => void
  medicationMetadata?: MedicationMetadata | null
  onMetadataChange?: (metadata: MedicationMetadata) => void
}

const availableMeds = getAvailableMedications()
const comingSoonMeds = getComingSoonMedications()
const fdaApproved = availableMeds.filter(m => m.fda_approved)
const nonFda = availableMeds.filter(m => !m.fda_approved)

const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

function isNew(med: Medication): boolean {
  return !!med.fda_approval_date && new Date(med.fda_approval_date) > sixMonthsAgo
}

function parseCustomMed(value: string) {
  if (!value.startsWith('custom:')) return null
  try { return JSON.parse(value.slice(7)) as { name: string; dose: string; frequency: string; notes: string } }
  catch { return null }
}

export default function MedicationPicker({ value, onChange, onDoseChange, medicationMetadata, onMetadataChange }: MedicationPickerProps) {
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [showPKHelper, setShowPKHelper] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDose, setCustomDose] = useState('')
  const [customFrequency, setCustomFrequency] = useState('weekly')
  const [customNotes, setCustomNotes] = useState('')
  const [customHalfLife, setCustomHalfLife] = useState('')
  const [customTmax, setCustomTmax] = useState('')

  const isCustom = value.startsWith('custom:')
  const customData = isCustom ? parseCustomMed(value) : null
  const isUnknownLegacy = !!value && !isCustom && !availableMeds.some(m => isSelected(m, value))

  function isSelected(med: Medication, v: string): boolean {
    return med.brand_names.some(b => b === v) || med.id === v || med.generic_name === v
  }

  function selectMed(med: Medication) {
    onChange(med.brand_names[0])
    if (!med.fda_approved && !localStorage.getItem('novura_nonfda_ack')) {
      setShowDisclaimer(true)
    }
  }

  function dismissDisclaimer() {
    localStorage.setItem('novura_nonfda_ack', '1')
    setShowDisclaimer(false)
  }

  function openCustomModal() {
    if (customData) {
      setCustomName(customData.name)
      setCustomDose(customData.dose)
      setCustomFrequency(customData.frequency || 'weekly')
      setCustomNotes(customData.notes)
    } else {
      setCustomName(''); setCustomDose(''); setCustomFrequency('weekly'); setCustomNotes('')
    }
    setCustomHalfLife(medicationMetadata?.custom_half_life_hours ? String(medicationMetadata.custom_half_life_hours) : '')
    setCustomTmax(medicationMetadata?.custom_tmax_hours ? String(medicationMetadata.custom_tmax_hours) : '')
    setShowCustomModal(true)
  }

  function copyPKFrom(med: Medication) {
    setCustomHalfLife(String(med.half_life_hours))
    setCustomTmax(String(med.absorption_tmax_hours))
    setShowPKHelper(false)
  }

  function saveCustom() {
    if (!customName.trim()) return
    onChange('custom:' + JSON.stringify({ name: customName.trim(), dose: customDose.trim(), frequency: customFrequency.trim(), notes: customNotes.trim() }))
    if (customDose.trim() && onDoseChange) onDoseChange(customDose.trim())
    if (onMetadataChange) {
      onMetadataChange({
        custom_half_life_hours: customHalfLife ? parseFloat(customHalfLife) : null,
        custom_tmax_hours: customTmax ? parseFloat(customTmax) : null,
      })
    }
    if (!localStorage.getItem('novura_nonfda_ack')) setShowDisclaimer(true)
    setShowCustomModal(false)
  }

  const selectedMed = !isCustom ? availableMeds.find(m => isSelected(m, value)) : null

  return (
    <div className="space-y-4">
      {/* Non-FDA disclaimer banner */}
      {showDisclaimer && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              NovuraHealth tracks medication regardless of source — we don&apos;t prescribe.
              Charts estimate levels based on published pharmacokinetic data for {selectedMed?.generic_name || 'this medication'}.
              Always consult your healthcare provider about your medication.
            </p>
          </div>
          <button onClick={dismissDisclaimer}
            className="w-full py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold cursor-pointer hover:bg-amber-200 transition-colors">
            Got it
          </button>
        </div>
      )}

      {/* FDA-Approved Medications */}
      <div>
        <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">FDA-Approved</p>
        <div className="flex flex-wrap gap-1.5">
          {fdaApproved.map(med => {
            const RouteIcon = med.route === 'oral' ? Pill : Syringe
            const sel = isSelected(med, value)
            return (
              <button key={med.id} onClick={() => selectMed(med)}
                className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${sel ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                <RouteIcon className="w-3 h-3" />
                {med.brand_names[0]}
                {isNew(med) && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#7FFFA4]/20 text-[#1F4B32]">New</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Compounded & Research */}
      {nonFda.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Compounded & Research</p>
          <div className="flex flex-wrap gap-1.5">
            {nonFda.map(med => {
              const sel = isSelected(med, value)
              return (
                <button key={med.id} onClick={() => selectMed(med)}
                  className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${sel ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                  <Syringe className="w-3 h-3" />
                  {med.brand_names[0]}
                </button>
              )
            })}
            <button onClick={openCustomModal}
              className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${isCustom || isUnknownLegacy ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
              Custom / Other
              {isCustom && customData && <span className="text-[10px]">({customData.name})</span>}
              {isUnknownLegacy && <span className="text-[10px]">({value})</span>}
            </button>
          </div>
        </div>
      )}

      {/* Coming Soon */}
      {comingSoonMeds.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Coming Soon</p>
          <div className="flex flex-wrap gap-1.5">
            {comingSoonMeds.map(med => (
              <div key={med.id} className="text-xs px-3 py-1.5 rounded-full border border-[#EAF2EB] text-[#6B7A72]/40 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {med.generic_name}
                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#EAF2EB] text-[#6B7A72]">Late 2027</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes for selected medication */}
      {selectedMed?.notes && <p className="text-[10px] text-[#6B7A72] leading-relaxed">{selectedMed.notes}</p>}
      {isCustom && customData && (
        <div className="text-[10px] text-[#6B7A72] leading-relaxed bg-[#F5F8F3] rounded-xl p-3">
          <p className="font-semibold text-[#0D1F16] mb-1">{customData.name}</p>
          {customData.dose && <p>Dose: {customData.dose}</p>}
          {customData.frequency && <p>Frequency: {customData.frequency}</p>}
          {customData.notes && <p className="mt-1">{customData.notes}</p>}
          {!medicationMetadata?.custom_half_life_hours && (
            <button onClick={openCustomModal} className="text-[#1F4B32] font-semibold mt-1 cursor-pointer hover:underline">Add PK info for chart</button>
          )}
        </div>
      )}

      {/* Custom medication modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontFamily: 'var(--font-inter)' }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCustomModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Custom Medication</h3>
              <button onClick={() => setShowCustomModal(false)} className="p-1 rounded-lg text-[#6B7A72] hover:text-[#0D1F16] cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Medication Name</label>
                <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. Compounded retatrutide, peptide, etc."
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Dose</label>
                  <input type="text" value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder="e.g. 5mg"
                    className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Frequency</label>
                  <select value={customFrequency} onChange={e => setCustomFrequency(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all bg-white">
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* PK Data (optional) */}
              <div className="border-t border-[#EAF2EB] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Pharmacokinetic Data (optional)</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#6B7A72]">Half-life (hours)</label>
                    <input type="number" value={customHalfLife} onChange={e => setCustomHalfLife(e.target.value)} placeholder="e.g. 165"
                      className="w-full mt-0.5 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40" />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6B7A72]">Time to peak (hours)</label>
                    <input type="number" value={customTmax} onChange={e => setCustomTmax(e.target.value)} placeholder="e.g. 72"
                      className="w-full mt-0.5 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40" />
                  </div>
                </div>
                <button onClick={() => setShowPKHelper(!showPKHelper)}
                  className="text-[10px] text-[#1F4B32] font-medium mt-1.5 cursor-pointer hover:underline flex items-center gap-1">
                  Don&apos;t know? Copy from a similar medication
                  <ChevronDown className={`w-3 h-3 transition-transform ${showPKHelper ? 'rotate-180' : ''}`} />
                </button>
                {showPKHelper && (
                  <div className="mt-2 bg-[#F5F8F3] rounded-xl p-2.5 space-y-1 max-h-40 overflow-y-auto">
                    {MEDICATIONS.filter(m => m.status === 'available' && m.fda_approved).map(med => (
                      <button key={med.id} onClick={() => copyPKFrom(med)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white text-xs text-[#0D1F16] cursor-pointer transition-colors flex justify-between items-center">
                        <span>{med.brand_names[0]}</span>
                        <span className="text-[9px] text-[#6B7A72]">{med.half_life_hours}h / {med.absorption_tmax_hours}h peak</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Notes (optional)</label>
                <textarea value={customNotes} onChange={e => setCustomNotes(e.target.value)} placeholder="Any context Nova should know" rows={2}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40 resize-none" />
              </div>
            </div>
            <p className="text-[10px] text-[#6B7A72] bg-[#F5F8F3] rounded-xl p-3 leading-relaxed">
              {customHalfLife && customTmax
                ? 'PK data provided — the medication level chart will render a full concentration curve.'
                : 'Without PK data, the chart will show injection timing only. You can add PK info later.'}
            </p>
            <button onClick={saveCustom} disabled={!customName.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white text-sm font-semibold cursor-pointer hover:shadow-lg transition-all disabled:opacity-50">
              Save custom medication
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
