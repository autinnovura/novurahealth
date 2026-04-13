'use client'

import { useState, useRef } from 'react'

interface ImportResult {
  success: boolean
  message: string
  data?: any
  counts?: Record<string, number>
}

export default function DataImport({ userId, onImportComplete }: { userId: string; onImportComplete?: () => void }) {
  const [step, setStep] = useState<'idle' | 'parsing' | 'preview' | 'saving' | 'done'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setStep('parsing')
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('image', file)
    formData.append('userId', userId)

    try {
      const res = await fetch('/api/import-parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success) {
        setResult(data)
        setStep('preview')
      } else {
        setError(data.message || "Couldn't read that image. Try a clearer screenshot.")
        setStep('idle')
      }
    } catch {
      setError('Something went wrong. Try again.')
      setStep('idle')
    }
  }

  async function confirmImport() {
    if (!result?.data) return
    setStep('saving')

    try {
      const res = await fetch('/api/import-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data: result.data }),
      })
      const data = await res.json()
      setSavedMessage(data.message || 'Data imported.')
      setStep('done')
      onImportComplete?.()
    } catch {
      setError('Failed to save data. Try again.')
      setStep('preview')
    }
  }

  function reset() {
    setStep('idle')
    setResult(null)
    setError('')
    setSavedMessage('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#E8F0EB] flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2D5A3D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1E1E1C]">Import from Screenshot</h3>
          <p className="text-[10px] text-[#B0B0A8]">Upload a photo of your old tracker, spreadsheet, or app</p>
        </div>
      </div>

      {step === 'idle' && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">
              Upload Screenshot
            </button>
            <button onClick={() => { if (fileRef.current) { fileRef.current.setAttribute('capture', 'environment'); fileRef.current.click(); fileRef.current.removeAttribute('capture') }}}
              className="px-4 bg-[#F5F5F2] text-[#6B6B65] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#EDEDEA] transition-colors">
              Camera
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </>
      )}

      {step === 'parsing' && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B6B65]">Reading your data...</p>
        </div>
      )}

      {step === 'preview' && result && (
        <div className="space-y-3">
          <p className="text-sm text-[#1E1E1C] font-medium">{result.message}</p>

          <div className="grid grid-cols-3 gap-2">
            {result.counts && Object.entries(result.counts).map(([key, count]) => (
              count > 0 && (
                <div key={key} className="bg-[#E8F0EB] rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#2D5A3D]">{count}</p>
                  <p className="text-[9px] text-[#2D5A3D]/70 uppercase font-semibold">{key}</p>
                </div>
              )
            ))}
          </div>

          {/* Preview details */}
          <div className="max-h-40 overflow-y-auto bg-[#F5F5F2] rounded-lg p-3 space-y-1">
            {result.data.weight_logs?.map((w: any, i: number) => (
              <p key={`w${i}`} className="text-xs text-[#6B6B65]">Weight: {w.weight}{w.unit || 'lbs'} on {w.date}</p>
            ))}
            {result.data.food_logs?.map((f: any, i: number) => (
              <p key={`f${i}`} className="text-xs text-[#6B6B65]">Food: {f.food_name} {f.calories ? `(${f.calories} cal` : ''}{f.protein ? `, ${f.protein}g protein` : ''}{f.calories ? ')' : ''} on {f.date}</p>
            ))}
            {result.data.medication_logs?.map((m: any, i: number) => (
              <p key={`m${i}`} className="text-xs text-[#6B6B65]">Med: {m.medication} {m.dose} on {m.date}</p>
            ))}
            {result.data.water_logs?.map((w: any, i: number) => (
              <p key={`wl${i}`} className="text-xs text-[#6B6B65]">Water: {w.amount_oz}oz on {w.date}</p>
            ))}
            {result.data.side_effect_logs?.map((s: any, i: number) => (
              <p key={`s${i}`} className="text-xs text-[#6B6B65]">Side effect: {s.symptom} ({s.severity}/5) on {s.date}</p>
            ))}
            {result.data.exercise_logs?.map((e: any, i: number) => (
              <p key={`e${i}`} className="text-xs text-[#6B6B65]">Exercise: {e.exercise_type} {e.duration_min ? `(${e.duration_min}min)` : ''} on {e.date}</p>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={confirmImport}
              className="flex-1 bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors">
              Import All
            </button>
            <button onClick={reset}
              className="px-4 bg-[#F5F5F2] text-[#6B6B65] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#EDEDEA] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B6B65]">Saving to your account...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <div className="bg-[#E8F0EB] rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2D5A3D] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#2D5A3D] font-medium">{savedMessage}</p>
          </div>
          <button onClick={reset}
            className="w-full bg-[#F5F5F2] text-[#6B6B65] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#EDEDEA] transition-colors">
            Import More
          </button>
        </div>
      )}
    </div>
  )
}
