'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import { Dumbbell, Pencil, Trash2, ChevronDown, Check, X, MessageCircle, ChevronRight, Plus } from 'lucide-react'

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

interface WorkoutPlan {
  id: string
  title: string
  description?: string
  days_per_week?: number
  workouts: WorkoutDay[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Props {
  userId: string
  onLogExercise?: (day: WorkoutDay) => void
}

export default function ActiveWorkoutPlan({ userId, onLogExercise }: Props) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [allPlans, setAllPlans] = useState<WorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  // Title/description editing
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Day editing
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null)
  const [dayDraft, setDayDraft] = useState<WorkoutDay>({ day: '', focus: '', exercises: [] })
  const [isSavingDay, setIsSavingDay] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('workout_plans').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      const plans = (data || []) as WorkoutPlan[]
      setAllPlans(plans)
      setPlan(plans.find(p => p.is_active) || null)
      setLoading(false)
    }
    load()
  }, [userId])

  async function setActivePlan(id: string) {
    for (const p of allPlans) {
      if (p.is_active && p.id !== id) {
        await fetch(`/api/workout-plans/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) })
      }
    }
    await fetch(`/api/workout-plans/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) })
    const updated = allPlans.map(p => ({ ...p, is_active: p.id === id }))
    setAllPlans(updated)
    setPlan(updated.find(p => p.id === id) || null)
    setShowHistory(false)
  }

  async function deletePlan(id: string) {
    await fetch(`/api/workout-plans/${id}`, { method: 'DELETE' })
    const updated = allPlans.filter(p => p.id !== id)
    setAllPlans(updated)
    if (plan?.id === id) setPlan(updated.find(p => p.is_active) || null)
    toast.success('Plan deleted')
  }

  // ── Title/description edit ────────────────────────────
  function startEdit() {
    if (!plan) return
    setEditTitle(plan.title)
    setEditDesc(plan.description || '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  const titleChanged = plan && (editTitle !== plan.title || editDesc !== (plan.description || ''))

  async function saveEdit() {
    if (!plan || !titleChanged) return
    setIsSaving(true)
    try {
      await fetch(`/api/workout-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editTitle, description: editDesc }) })
      setPlan({ ...plan, title: editTitle, description: editDesc })
      setEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Day editing ───────────────────────────────────────
  function startDayEdit(idx: number) {
    if (!plan) return
    const day = plan.workouts[idx]
    setDayDraft({ ...day, exercises: day.exercises.map(e => ({ ...e })) })
    setEditingDayIdx(idx)
    setExpandedDay(idx)
  }

  function cancelDayEdit() {
    setEditingDayIdx(null)
  }

  function updateExercise(exIdx: number, field: keyof Exercise, value: string | number | undefined) {
    setDayDraft({
      ...dayDraft,
      exercises: dayDraft.exercises.map((ex, i) => i === exIdx ? { ...ex, [field]: value } : ex),
    })
  }

  function removeExercise(exIdx: number) {
    setDayDraft({ ...dayDraft, exercises: dayDraft.exercises.filter((_, i) => i !== exIdx) })
  }

  function addExercise() {
    setDayDraft({ ...dayDraft, exercises: [...dayDraft.exercises, { name: '', sets: 3, reps: '10' }] })
  }

  async function saveDayEdit() {
    if (!plan || editingDayIdx === null) return
    setIsSavingDay(true)
    const workouts = plan.workouts.map((d, i) => i === editingDayIdx ? { ...dayDraft } : d)
    try {
      await fetch(`/api/workout-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workouts }) })
      setPlan({ ...plan, workouts })
      setEditingDayIdx(null)
    } finally {
      setIsSavingDay(false)
    }
  }

  async function deleteDay(idx: number) {
    if (!plan) return
    const workouts = plan.workouts.filter((_, i) => i !== idx)
    await fetch(`/api/workout-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workouts }) })
    setPlan({ ...plan, workouts })
    setEditingDayIdx(null)
    setExpandedDay(null)
    toast.success('Day removed')
  }

  if (loading) return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
      <div className="h-6 w-32 bg-[#EAF2EB] rounded-xl animate-pulse mb-3" />
      <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-[#F5F8F3] rounded-2xl animate-pulse" />)}</div>
    </div>
  )

  if (!plan) return (
    <div className="bg-[#F5F8F3] border border-[#EAF2EB] rounded-3xl p-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-[#EAF2EB] flex items-center justify-center mx-auto">
        <Dumbbell className="w-5 h-5 text-[#6B7A72]" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>No workout plan yet</h3>
        <p className="text-xs text-[#6B7A72] mt-1">Let Trish build you one based on your fitness level and goals.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs mx-auto">
        <Link href="/maintenance?tab=coach&action=generate_daily_workout" className="flex-1 bg-gradient-to-r from-[#4A90D9] to-[#5AA0E9] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold text-center hover:shadow-lg transition-all">
          Today&apos;s workout
        </Link>
        <Link href="/maintenance?tab=coach&action=generate_weekly_workout" className="flex-1 bg-white border border-[#4A90D9] text-[#4A90D9] px-5 py-2.5 rounded-2xl text-xs font-semibold text-center hover:bg-[#EDF5FC] transition-all">
          Weekly plan
        </Link>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB] overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Active Workout Plan</p>
            {editing ? (
              <div className="mt-1 space-y-2">
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#4A90D9]" />
                <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description"
                  className="w-full px-3 py-1.5 rounded-xl border border-[#EAF2EB] text-xs text-[#0D1F16] outline-none focus:border-[#4A90D9] placeholder:text-[#6B7A72]/40" />
                <div className="flex items-center gap-2">
                  <button onClick={cancelEdit}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-[#EAF2EB] text-[#6B7A72] font-medium text-xs hover:bg-[#FAFAF7] transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={saveEdit} disabled={!titleChanged || isSaving}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-[#4A90D9] text-white font-semibold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer">
                    {isSaving ? 'Saving\u2026' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-[#0D1F16] truncate" style={{ fontFamily: 'var(--font-fraunces)' }}>{plan.title}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {plan.days_per_week && <span className="text-xs text-[#6B7A72]">{plan.days_per_week}x per week</span>}
                  {plan.description && <span className="text-xs text-[#6B7A72]">· {plan.description}</span>}
                </div>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDF5FC] hover:bg-[#D6E9F8] text-[#4A90D9] text-xs font-medium transition-colors cursor-pointer">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              {allPlans.length > 1 && (
                <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#4A90D9] hover:bg-[#EDF5FC] cursor-pointer transition-all">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Plan history */}
        {showHistory && (
          <div className="mb-3 bg-[#F5F8F3] rounded-2xl p-2.5 space-y-1">
            {allPlans.map(p => (
              <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors">
                <button onClick={() => setActivePlan(p.id)} className="flex-1 text-left text-xs text-[#0D1F16] cursor-pointer flex items-center gap-2">
                  {p.is_active && <Check className="w-3 h-3 text-[#4A90D9]" />}
                  <span className={p.is_active ? 'font-semibold text-[#4A90D9]' : ''}>{p.title}</span>
                </button>
                {!p.is_active && (
                  <button onClick={() => deletePlan(p.id)} className="p-1 rounded text-[#6B7A72] hover:text-red-500 cursor-pointer transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Workout days */}
        <div className="space-y-2 mt-3">
          {plan.workouts.map((day, i) => (
            <div key={i} className="bg-[#F5F8F3] rounded-2xl overflow-hidden">
              {editingDayIdx === i ? (
                /* ── Day edit mode ── */
                <div className="p-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Day</label>
                      <input type="text" value={dayDraft.day} onChange={e => setDayDraft({ ...dayDraft, day: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#4A90D9] bg-white" />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Focus</label>
                      <input type="text" value={dayDraft.focus} onChange={e => setDayDraft({ ...dayDraft, focus: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#4A90D9] bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Duration (min)</label>
                    <input type="number" value={dayDraft.duration_minutes || ''} onChange={e => setDayDraft({ ...dayDraft, duration_minutes: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#4A90D9] bg-white" />
                  </div>

                  {/* Exercises */}
                  <div>
                    <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider mb-2 block">Exercises</label>
                    <div className="space-y-2">
                      {dayDraft.exercises.map((ex, j) => (
                        <div key={j} className="bg-white rounded-xl p-3 border border-[#EAF2EB] space-y-2">
                          <div className="flex items-center gap-2">
                            <input type="text" value={ex.name} onChange={e => updateExercise(j, 'name', e.target.value)} placeholder="Exercise name"
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#EAF2EB] text-xs text-[#0D1F16] outline-none focus:border-[#4A90D9]" />
                            <button onClick={() => removeExercise(j)} className="p-1 text-[#6B7A72] hover:text-red-500 cursor-pointer transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[8px] text-[#6B7A72] uppercase">Sets</label>
                              <input type="number" value={ex.sets || ''} onChange={e => updateExercise(j, 'sets', e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full mt-0.5 px-2 py-1 rounded-lg border border-[#EAF2EB] text-[10px] text-[#0D1F16] outline-none focus:border-[#4A90D9]" />
                            </div>
                            <div>
                              <label className="text-[8px] text-[#6B7A72] uppercase">Reps</label>
                              <input type="text" value={ex.reps || ''} onChange={e => updateExercise(j, 'reps', e.target.value)}
                                className="w-full mt-0.5 px-2 py-1 rounded-lg border border-[#EAF2EB] text-[10px] text-[#0D1F16] outline-none focus:border-[#4A90D9]" />
                            </div>
                            <div>
                              <label className="text-[8px] text-[#6B7A72] uppercase">Notes</label>
                              <input type="text" value={ex.notes || ''} onChange={e => updateExercise(j, 'notes', e.target.value)}
                                className="w-full mt-0.5 px-2 py-1 rounded-lg border border-[#EAF2EB] text-[10px] text-[#0D1F16] outline-none focus:border-[#4A90D9]" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={addExercise}
                      className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold text-[#4A90D9] cursor-pointer hover:text-[#3A7BC8] transition-colors">
                      <Plus className="w-3 h-3" /> Add exercise
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={cancelDayEdit}
                      className="flex-1 px-4 py-2.5 rounded-2xl border border-[#EAF2EB] text-[#6B7A72] font-medium text-xs hover:bg-white transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={saveDayEdit} disabled={isSavingDay || !dayDraft.day.trim()}
                      className="flex-1 px-4 py-2.5 rounded-2xl bg-[#4A90D9] text-white font-semibold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer">
                      {isSavingDay ? 'Saving\u2026' : 'Save'}
                    </button>
                  </div>
                  <button onClick={() => deleteDay(i)}
                    className="w-full text-xs text-red-500 font-medium py-1.5 hover:text-red-600 cursor-pointer transition-colors">
                    Delete this day
                  </button>
                </div>
              ) : (
                /* ── Day display mode ── */
                <>
                  <button
                    onClick={() => setExpandedDay(expandedDay === i ? null : i)}
                    className="w-full p-3.5 flex items-center justify-between cursor-pointer text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#0D1F16]">{day.day}</span>
                        <span className="text-[10px] text-[#4A90D9] font-semibold bg-[#EDF5FC] px-1.5 py-0.5 rounded">{day.focus}</span>
                      </div>
                      <p className="text-[10px] text-[#6B7A72] mt-0.5">{day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}{day.duration_minutes ? ` · ~${day.duration_minutes}min` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {onLogExercise && (
                        <button onClick={e => { e.stopPropagation(); onLogExercise(day) }}
                          className="px-2 py-1 rounded-lg bg-[#EDF5FC] text-[#4A90D9] text-[9px] font-semibold cursor-pointer hover:bg-[#4A90D9] hover:text-white transition-all">
                          Log it
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); startDayEdit(i) }}
                        className="px-2 py-1 rounded-lg bg-[#EDF5FC] text-[#4A90D9] text-[9px] font-semibold cursor-pointer hover:bg-[#4A90D9] hover:text-white transition-all">
                        Edit
                      </button>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#6B7A72] transition-transform ${expandedDay === i ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {expandedDay === i && (
                    <div className="px-3.5 pb-3.5 space-y-1.5 border-t border-[#EAF2EB]">
                      {day.exercises.map((ex, j) => (
                        <div key={j} className="flex items-center justify-between py-1.5">
                          <div>
                            <p className="text-xs font-medium text-[#0D1F16]">{ex.name}</p>
                            <p className="text-[10px] text-[#6B7A72]">
                              {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ''}
                              {ex.notes ? (ex.sets ? ` · ${ex.notes}` : ex.notes) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Talk to Trish CTA */}
        <div className="mt-5 pt-5 border-t border-[#EAF2EB]">
          <Link
            href="/maintenance?tab=coach&context=active_workout_plan"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-br from-[#F5F8F3] to-white border border-[#EAF2EB] hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C4742B] to-[#D4843B] flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-[#0D1F16]">Want changes?</div>
                <div className="text-[10px] text-[#6B7A72]">Talk to Trish about adjustments or a new plan</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B7A72]" />
          </Link>
        </div>
      </div>
    </div>
  )
}
