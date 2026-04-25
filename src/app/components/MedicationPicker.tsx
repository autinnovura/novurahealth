'use client'

import { useState } from 'react'
import { Syringe, Pill, AlertTriangle, X, Clock } from 'lucide-react'
import {
  getAvailableMedications, getComingSoonMedications, getRestrictedMedications,
  type Medication,
} from '../lib/medications'

interface MedicationPickerProps {
  value: string
  onChange: (medication: string) => void
  onDoseChange?: (dose: string) => void
}

const availableMeds = getAvailableMedications()
const comingSoonMeds = getComingSoonMedications()
const restrictedMeds = getRestrictedMedications()

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

export default function MedicationPicker({ value, onChange, onDoseChange }: MedicationPickerProps) {
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [restrictedWarning, setRestrictedWarning] = useState<Medication | null>(null)
  const [customName, setCustomName] = useState('')
  const [customDose, setCustomDose] = useState('')
  const [customFrequency, setCustomFrequency] = useState('')
  const [customNotes, setCustomNotes] = useState('')

  const isCustom = value.startsWith('custom:')
  const customData = isCustom ? parseCustomMed(value) : null
  const isUnknownLegacy = !!value && !isCustom && ![...availableMeds, ...restrictedMeds].some(m => isSelected(m, value))

  function isSelected(med: Medication, v: string): boolean {
    return med.brand_names.some(b => b === v) || med.id === v || med.generic_name === v
  }

  function selectRestricted(med: Medication) { setRestrictedWarning(med) }

  function confirmRestricted() {
    if (restrictedWarning) { onChange(restrictedWarning.brand_names[0]); setRestrictedWarning(null) }
  }

  function openCustomModal() {
    if (customData) { setCustomName(customData.name); setCustomDose(customData.dose); setCustomFrequency(customData.frequency); setCustomNotes(customData.notes) }
    else { setCustomName(''); setCustomDose(''); setCustomFrequency(''); setCustomNotes('') }
    setShowCustomModal(true)
  }

  function saveCustom() {
    if (!customName.trim()) return
    onChange('custom:' + JSON.stringify({ name: customName.trim(), dose: customDose.trim(), frequency: customFrequency.trim(), notes: customNotes.trim() }))
    if (customDose.trim() && onDoseChange) onDoseChange(customDose.trim())
    setShowCustomModal(false)
  }

  const selectedMed = !isCustom ? [...availableMeds, ...restrictedMeds].find(m => isSelected(m, value)) : null

  return (
    <div className="space-y-4">
      {/* Currently Approved */}
      <div>
        <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Currently Approved</p>
        <div className="flex flex-wrap gap-1.5">
          {availableMeds.map(med => {
            const RouteIcon = med.route === 'oral' ? Pill : Syringe
            const sel = isSelected(med, value)
            return (
              <button key={med.id} onClick={() => onChange(med.brand_names[0])}
                className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${sel ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                <RouteIcon className="w-3 h-3" />
                {med.brand_names[0]}
                {isNew(med) && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#7FFFA4]/20 text-[#1F4B32]">New</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Other Options */}
      <div>
        <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Other Options</p>
        <div className="flex flex-wrap gap-1.5">
          {restrictedMeds.map(med => {
            const sel = isSelected(med, value)
            return (
              <button key={med.id} onClick={() => selectRestricted(med)}
                className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${sel ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                <AlertTriangle className="w-3 h-3" />
                {med.brand_names[0]}
              </button>
            )
          })}
          <button onClick={openCustomModal}
            className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${isCustom || isUnknownLegacy ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
            Custom / Other
            {(isCustom && customData) && <span className="text-[10px]">({customData.name})</span>}
            {isUnknownLegacy && <span className="text-[10px]">({value})</span>}
          </button>
        </div>
      </div>

      {/* Coming Soon */}
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

      {/* Notes for selected medication */}
      {selectedMed?.notes && <p className="text-[10px] text-[#6B7A72] leading-relaxed">{selectedMed.notes}</p>}
      {isCustom && customData && (
        <div className="text-[10px] text-[#6B7A72] leading-relaxed bg-[#F5F8F3] rounded-xl p-3">
          <p className="font-semibold text-[#0D1F16] mb-1">{customData.name}</p>
          {customData.dose && <p>Dose: {customData.dose}</p>}
          {customData.frequency && <p>Frequency: {customData.frequency}</p>}
          {customData.notes && <p className="mt-1">{customData.notes}</p>}
        </div>
      )}

      {/* Restricted warning modal */}
      {restrictedWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontFamily: 'var(--font-inter)' }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRestrictedWarning(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Important Notice</h3>
            </div>
            <p className="text-sm text-[#6B7A72] leading-relaxed">{restrictedWarning.notes}</p>
            <div className="flex gap-2">
              <button onClick={() => setRestrictedWarning(null)}
                className="flex-1 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#6B7A72] font-medium cursor-pointer hover:bg-[#F5F8F3] transition-all">Cancel</button>
              <button onClick={confirmRestricted}
                className="flex-1 py-2.5 rounded-2xl bg-amber-500 text-white text-sm font-semibold cursor-pointer hover:bg-amber-600 transition-all">I understand</button>
            </div>
          </div>
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
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Dose</label>
                <input type="text" value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder="e.g. 5mg"
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Frequency</label>
                <input type="text" value={customFrequency} onChange={e => setCustomFrequency(e.target.value)} placeholder="e.g. Weekly, daily"
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Notes (optional)</label>
                <textarea value={customNotes} onChange={e => setCustomNotes(e.target.value)} placeholder="Any context Nova should know" rows={3}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all placeholder:text-[#6B7A72]/40 resize-none" />
              </div>
            </div>
            <p className="text-[10px] text-[#6B7A72] bg-[#F5F8F3] rounded-xl p-3 leading-relaxed">
              Custom medications won&apos;t have pharmacokinetic chart data. You can still track injections and doses manually.
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
