'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import { Dumbbell, Pencil, Trash2, ChevronDown, Check, X } from 'lucide-react'

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
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

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

  async function removeDay(idx: number) {
    if (!plan) return
    const workouts = plan.workouts.filter((_, i) => i !== idx)
    await fetch(`/api/workout-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workouts }) })
    setPlan({ ...plan, workouts })
  }

  async function saveEdit() {
    if (!plan) return
    await fetch(`/api/workout-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editTitle, description: editDesc }) })
    setPlan({ ...plan, title: editTitle, description: editDesc })
    setEditing(false)
  }

  function startEdit() {
    if (!plan) return
    setEditTitle(plan.title)
    setEditDesc(plan.description || '')
    setEditing(true)
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
        <p className="text-xs text-[#6B7A72] mt-1">Ask Trish to build you one based on your fitness level and goals.</p>
      </div>
      <Link href="/maintenance" className="inline-block bg-gradient-to-r from-[#4A90D9] to-[#5AA0E9] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold hover:shadow-lg transition-all">
        Talk to Trish
      </Link>
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
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-[10px] text-[#6B7A72] cursor-pointer">Cancel</button>
                  <button onClick={saveEdit} className="text-[10px] text-[#4A90D9] font-semibold cursor-pointer">Save</button>
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
              <button onClick={startEdit} className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#4A90D9] hover:bg-[#EDF5FC] cursor-pointer transition-all">
                <Pencil className="w-3.5 h-3.5" />
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
                  <button onClick={() => removeDay(i)} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-500 cursor-pointer transition-colors mt-1">
                    <X className="w-3 h-3" /> Remove day
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
