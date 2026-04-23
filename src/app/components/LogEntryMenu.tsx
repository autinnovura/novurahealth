'use client'

import { useState } from 'react'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'datetime-local' | 'select' | 'severity'
  options?: string[]
}

interface LogEntryMenuProps {
  logType: string
  logId: string
  fields: FieldDef[]
  currentValues: Record<string, any>
  onUpdate: () => void
}

const API_MAP: Record<string, string> = {
  weight_logs: 'weight-logs',
  food_logs: 'food-logs',
  water_logs: 'water-logs',
  side_effect_logs: 'side-effect-logs',
  exercise_logs: 'exercise-logs',
  medication_logs: 'medication-logs',
}

export default function LogEntryMenu({ logType, logId, fields, currentValues, onUpdate }: LogEntryMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, any>>({})

  const apiPath = API_MAP[logType] || logType

  function openEdit() {
    const initial: Record<string, any> = {}
    for (const f of fields) {
      if (f.type === 'datetime-local' && currentValues[f.key]) {
        initial[f.key] = new Date(currentValues[f.key]).toISOString().slice(0, 16)
      } else {
        initial[f.key] = currentValues[f.key] ?? ''
      }
    }
    setValues(initial)
    setEditing(true)
    setShowMenu(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this entry?')) return
    setShowMenu(false)
    const res = await fetch(`/api/${apiPath}/${logId}`, { method: 'DELETE' })
    if (res.ok) onUpdate()
  }

  async function handleSave() {
    const body: Record<string, any> = {}
    for (const f of fields) {
      const v = values[f.key]
      if (f.type === 'datetime-local' && v) {
        body[f.key] = new Date(v).toISOString()
      } else if (f.type === 'number' && v !== '' && v !== undefined) {
        body[f.key] = Number(v)
      } else if (f.type === 'severity') {
        body[f.key] = Number(v) || currentValues[f.key]
      } else {
        body[f.key] = v
      }
    }

    const res = await fetch(`/api/${apiPath}/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setEditing(false)
      onUpdate()
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F5F5F2] cursor-pointer text-[#B0B0A8] hover:text-[#6B6B65] transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-8 bg-white border border-[#EDEDEA] rounded-lg shadow-lg z-10 overflow-hidden">
            <button onClick={openEdit} className="w-full px-4 py-2.5 text-xs text-[#1E1E1C] hover:bg-[#F5F5F2] text-left cursor-pointer flex items-center gap-2 whitespace-nowrap">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit
            </button>
            <button onClick={handleDelete} className="w-full px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 text-left cursor-pointer flex items-center gap-2 whitespace-nowrap">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={e => { if (e.target === e.currentTarget) setEditing(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-[#1E1E1C]">Edit Entry</h2>
              <button onClick={() => setEditing(false)} className="text-[#B0B0A8] hover:text-[#1E1E1C] cursor-pointer text-lg">✕</button>
            </div>
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">{f.label}</label>
                {f.type === 'select' && f.options ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {f.options.map(opt => (
                      <button key={opt} onClick={() => setValues({ ...values, [f.key]: opt })}
                        className={`text-xs px-3 py-2 rounded-lg border cursor-pointer capitalize ${values[f.key] === opt ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : f.type === 'severity' ? (
                  <div className="flex gap-2 mt-1">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setValues({ ...values, [f.key]: n })}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold cursor-pointer ${n <= (values[f.key] || 0) ? 'bg-[#C4742B] text-white' : 'bg-[#F5F5F2] text-[#C5C5BE]'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type={f.type}
                    autoComplete="off"
                    value={values[f.key] ?? ''}
                    onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]"
                  />
                )}
              </div>
            ))}
            <button onClick={handleSave} className="w-full bg-[#2D5A3D] text-white py-3 rounded-lg text-sm font-semibold cursor-pointer">Save Changes</button>
          </div>
        </div>
      )}
    </>
  )
}
