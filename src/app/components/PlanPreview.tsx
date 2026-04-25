'use client'

import { useState } from 'react'
import { X, Plus, RefreshCw, Trash2, ChevronDown } from 'lucide-react'

interface Meal {
  meal_type: string
  name: string
  ingredients?: string[]
  estimated_protein?: number
  estimated_calories?: number
  prep_notes?: string
}

interface Exercise {
  name: string
  sets?: number
  reps?: string
  notes?: string
}

interface WorkoutDay {
  day: string
  focus: string
  exercises: Exercise[]
  duration_minutes?: number
}

interface PlanPreviewProps {
  type: 'meal_plan' | 'workout_plan'
  data: {
    title: string
    description?: string | null
    meals?: Meal[]
    grocery_list?: string[]
    days_per_week?: number | null
    workouts?: WorkoutDay[]
  }
  onSave: (data: any) => void
  onDiscard: () => void
  onRegenerate: () => void
  isRegenerating?: boolean
  isSaving?: boolean
}

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export default function PlanPreview({ type, data: initialData, onSave, onDiscard, onRegenerate, isRegenerating, isSaving }: PlanPreviewProps) {
  const [data, setData] = useState(initialData)
  const [editingField, setEditingField] = useState<string | null>(null)

  function updateField(field: string, value: any) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  // ── Meal helpers ──
  function updateMeal(idx: number, updates: Partial<Meal>) {
    const meals = [...(data.meals || [])]
    meals[idx] = { ...meals[idx], ...updates }
    updateField('meals', meals)
  }

  function removeMeal(idx: number) {
    updateField('meals', (data.meals || []).filter((_, i) => i !== idx))
  }

  function addMeal() {
    updateField('meals', [...(data.meals || []), { meal_type: 'lunch', name: '', estimated_protein: 0, estimated_calories: 0 }])
  }

  // ── Workout helpers ──
  function updateWorkout(idx: number, updates: Partial<WorkoutDay>) {
    const workouts = [...(data.workouts || [])]
    workouts[idx] = { ...workouts[idx], ...updates }
    updateField('workouts', workouts)
  }

  function removeWorkout(idx: number) {
    updateField('workouts', (data.workouts || []).filter((_, i) => i !== idx))
  }

  function addWorkout() {
    updateField('workouts', [...(data.workouts || []), { day: 'New Day', focus: '', exercises: [] }])
  }

  function updateExercise(dayIdx: number, exIdx: number, updates: Partial<Exercise>) {
    const workouts = [...(data.workouts || [])]
    const exercises = [...workouts[dayIdx].exercises]
    exercises[exIdx] = { ...exercises[exIdx], ...updates }
    workouts[dayIdx] = { ...workouts[dayIdx], exercises }
    updateField('workouts', workouts)
  }

  function removeExercise(dayIdx: number, exIdx: number) {
    const workouts = [...(data.workouts || [])]
    workouts[dayIdx] = { ...workouts[dayIdx], exercises: workouts[dayIdx].exercises.filter((_, i) => i !== exIdx) }
    updateField('workouts', workouts)
  }

  function addExercise(dayIdx: number) {
    const workouts = [...(data.workouts || [])]
    workouts[dayIdx] = { ...workouts[dayIdx], exercises: [...workouts[dayIdx].exercises, { name: '', sets: 3, reps: '10' }] }
    updateField('workouts', workouts)
  }

  return (
    <div className="bg-gradient-to-br from-white to-[#F5F8F3] border-2 border-[#7FFFA4] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.12)] overflow-hidden">
      <div className="p-5">
        {/* Preview banner */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#1F4B32] bg-[#7FFFA4]/30 px-2.5 py-1 rounded-full">
            Preview — not yet saved
          </span>
          <button onClick={onDiscard} className="text-xs text-[#6B7A72] cursor-pointer hover:text-[#0D1F16] transition-colors">
            Discard
          </button>
        </div>

        {/* Title */}
        {editingField === 'title' ? (
          <input type="text" value={data.title} onChange={e => updateField('title', e.target.value)}
            onBlur={() => setEditingField(null)} autoFocus
            className="w-full text-xl font-semibold text-[#0D1F16] bg-transparent border-b-2 border-[#1F4B32] outline-none pb-1 mb-1"
            style={{ fontFamily: 'var(--font-fraunces)' }} />
        ) : (
          <h2 onClick={() => setEditingField('title')}
            className="text-xl font-semibold text-[#0D1F16] cursor-pointer hover:text-[#1F4B32] transition-colors mb-1"
            style={{ fontFamily: 'var(--font-fraunces)' }}>
            {data.title || 'Untitled Plan'}
          </h2>
        )}

        {/* Description */}
        {editingField === 'description' ? (
          <input type="text" value={data.description || ''} onChange={e => updateField('description', e.target.value)}
            onBlur={() => setEditingField(null)} autoFocus placeholder="Add description..."
            className="w-full text-sm text-[#6B7A72] bg-transparent border-b border-[#EAF2EB] outline-none pb-1 mb-4 placeholder:text-[#6B7A72]/40" />
        ) : (
          <p onClick={() => setEditingField('description')}
            className="text-sm text-[#6B7A72] cursor-pointer hover:text-[#0D1F16] transition-colors mb-4">
            {data.description || 'Click to add description...'}
          </p>
        )}

        {/* ── Meal plan content ── */}
        {type === 'meal_plan' && (
          <div className="space-y-2.5 mb-4">
            {(data.meals || []).map((meal, i) => (
              <div key={i} className="bg-white rounded-2xl p-3.5 border border-[#EAF2EB] group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <select value={meal.meal_type} onChange={e => updateMeal(i, { meal_type: e.target.value })}
                        className="text-[9px] font-bold uppercase text-[#1F4B32] bg-[#EAF2EB] px-2 py-0.5 rounded border-0 outline-none cursor-pointer">
                        {mealTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <input type="text" value={meal.name} onChange={e => updateMeal(i, { name: e.target.value })}
                      placeholder="Meal name..."
                      className="w-full text-sm font-medium text-[#0D1F16] bg-transparent outline-none placeholder:text-[#6B7A72]/40" />
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1">
                        <label className="text-[9px] text-[#6B7A72]">Cal</label>
                        <input type="number" value={meal.estimated_calories || ''} onChange={e => updateMeal(i, { estimated_calories: parseInt(e.target.value) || 0 })}
                          className="w-14 text-xs text-[#0D1F16] bg-[#F5F8F3] rounded px-1.5 py-0.5 outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[9px] text-[#6B7A72]">Protein</label>
                        <input type="number" value={meal.estimated_protein || ''} onChange={e => updateMeal(i, { estimated_protein: parseInt(e.target.value) || 0 })}
                          className="w-14 text-xs text-[#0D1F16] bg-[#F5F8F3] rounded px-1.5 py-0.5 outline-none" />
                        <span className="text-[9px] text-[#6B7A72]">g</span>
                      </div>
                    </div>
                    <input type="text" value={meal.prep_notes || ''} onChange={e => updateMeal(i, { prep_notes: e.target.value })}
                      placeholder="Prep notes..." className="w-full text-[10px] text-[#6B7A72] bg-transparent outline-none italic placeholder:text-[#6B7A72]/30" />
                  </div>
                  <button onClick={() => removeMeal(i)} className="p-1 rounded-lg text-[#6B7A72]/30 hover:text-red-500 cursor-pointer transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addMeal} className="w-full py-2.5 rounded-2xl border border-dashed border-[#EAF2EB] text-xs text-[#6B7A72] cursor-pointer hover:border-[#1F4B32] hover:text-[#1F4B32] transition-all flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" /> Add meal
            </button>
          </div>
        )}

        {/* ── Workout plan content ── */}
        {type === 'workout_plan' && (
          <div className="space-y-2.5 mb-4">
            {(data.workouts || []).map((day, di) => (
              <div key={di} className="bg-white rounded-2xl border border-[#EAF2EB] overflow-hidden group">
                <div className="p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <input type="text" value={day.day} onChange={e => updateWorkout(di, { day: e.target.value })}
                        className="text-sm font-medium text-[#0D1F16] bg-transparent outline-none w-24" />
                      <input type="text" value={day.focus} onChange={e => updateWorkout(di, { focus: e.target.value })}
                        placeholder="Focus area..."
                        className="text-[10px] text-[#4A90D9] font-semibold bg-[#EDF5FC] px-1.5 py-0.5 rounded outline-none placeholder:text-[#4A90D9]/40" />
                      <div className="flex items-center gap-1 ml-auto">
                        <input type="number" value={day.duration_minutes || ''} onChange={e => updateWorkout(di, { duration_minutes: parseInt(e.target.value) || undefined })}
                          placeholder="min" className="w-10 text-[10px] text-[#6B7A72] bg-[#F5F8F3] rounded px-1 py-0.5 outline-none text-center" />
                        <span className="text-[9px] text-[#6B7A72]">min</span>
                      </div>
                    </div>
                    <button onClick={() => removeWorkout(di)} className="p-1 rounded-lg text-[#6B7A72]/30 hover:text-red-500 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {day.exercises.map((ex, ei) => (
                      <div key={ei} className="flex items-center gap-2 py-1 group/ex">
                        <input type="text" value={ex.name} onChange={e => updateExercise(di, ei, { name: e.target.value })}
                          placeholder="Exercise name" className="flex-1 text-xs text-[#0D1F16] bg-transparent outline-none placeholder:text-[#6B7A72]/40" />
                        <input type="number" value={ex.sets || ''} onChange={e => updateExercise(di, ei, { sets: parseInt(e.target.value) || undefined })}
                          placeholder="3" className="w-8 text-[10px] text-center text-[#0D1F16] bg-[#F5F8F3] rounded px-1 py-0.5 outline-none" />
                        <span className="text-[9px] text-[#6B7A72]">x</span>
                        <input type="text" value={ex.reps || ''} onChange={e => updateExercise(di, ei, { reps: e.target.value })}
                          placeholder="10" className="w-12 text-[10px] text-center text-[#0D1F16] bg-[#F5F8F3] rounded px-1 py-0.5 outline-none" />
                        <button onClick={() => removeExercise(di, ei)} className="p-0.5 text-[#6B7A72]/20 hover:text-red-500 cursor-pointer opacity-0 group-hover/ex:opacity-100 transition-all">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addExercise(di)} className="text-[10px] text-[#6B7A72] cursor-pointer hover:text-[#1F4B32] transition-colors flex items-center gap-0.5 mt-1">
                      <Plus className="w-3 h-3" /> Add exercise
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addWorkout} className="w-full py-2.5 rounded-2xl border border-dashed border-[#EAF2EB] text-xs text-[#6B7A72] cursor-pointer hover:border-[#1F4B32] hover:text-[#1F4B32] transition-all flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" /> Add workout day
            </button>
          </div>
        )}

        {/* ── Grocery list (meal plans only) ── */}
        {type === 'meal_plan' && (data.grocery_list || []).length > 0 && (
          <div className="mb-4 bg-white rounded-2xl p-3.5 border border-[#EAF2EB]">
            <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2">Grocery List</p>
            <div className="space-y-1">
              {(data.grocery_list || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2 group/item">
                  <input type="text" value={item}
                    onChange={e => {
                      const list = [...(data.grocery_list || [])]
                      list[i] = e.target.value
                      updateField('grocery_list', list)
                    }}
                    className="flex-1 text-xs text-[#0D1F16] bg-transparent outline-none" />
                  <button onClick={() => updateField('grocery_list', (data.grocery_list || []).filter((_, j) => j !== i))}
                    className="p-0.5 text-[#6B7A72]/20 hover:text-red-500 cursor-pointer opacity-0 group-hover/item:opacity-100 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2.5">
          <button onClick={onRegenerate} disabled={isRegenerating}
            className="flex-1 py-3 rounded-2xl border border-[#EAF2EB] text-sm font-semibold text-[#1F4B32] cursor-pointer hover:bg-[#EAF2EB] transition-all disabled:opacity-30 flex items-center justify-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button onClick={() => onSave(data)} disabled={isSaving}
            className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white text-sm font-semibold cursor-pointer hover:shadow-lg transition-all disabled:opacity-30">
            {isSaving ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
