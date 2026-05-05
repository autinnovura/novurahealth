'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import { Utensils, Pencil, Trash2, ChevronDown, Check, ShoppingCart, X, MessageCircle, ChevronRight } from 'lucide-react'

interface Meal {
  meal_type: string
  name: string
  ingredients?: string[]
  estimated_protein?: number
  estimated_calories?: number
  prep_notes?: string
}

interface MealPlan {
  id: string
  title: string
  description?: string
  meals: Meal[]
  grocery_list?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Props {
  userId: string
  onLogFood?: (meal: Meal) => void
}

const mealIcons: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export default function ActiveMealPlan({ userId, onLogFood }: Props) {
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [allPlans, setAllPlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showGrocery, setShowGrocery] = useState(false)

  // Title/description editing
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Individual meal editing
  const [editingMealIdx, setEditingMealIdx] = useState<number | null>(null)
  const [mealDraft, setMealDraft] = useState<Meal>({ meal_type: '', name: '' })
  const [isSavingMeal, setIsSavingMeal] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('meal_plans').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      const plans = (data || []) as MealPlan[]
      setAllPlans(plans)
      setPlan(plans.find(p => p.is_active) || null)
      setLoading(false)
    }
    load()
  }, [userId])

  async function setActivePlan(id: string) {
    for (const p of allPlans) {
      if (p.is_active && p.id !== id) {
        await fetch(`/api/meal-plans/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) })
      }
    }
    await fetch(`/api/meal-plans/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) })
    const updated = allPlans.map(p => ({ ...p, is_active: p.id === id }))
    setAllPlans(updated)
    setPlan(updated.find(p => p.id === id) || null)
    setShowHistory(false)
  }

  async function deletePlan(id: string) {
    await fetch(`/api/meal-plans/${id}`, { method: 'DELETE' })
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
      await fetch(`/api/meal-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editTitle, description: editDesc }) })
      setPlan({ ...plan, title: editTitle, description: editDesc })
      setEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Individual meal edit ──────────────────────────────
  function startMealEdit(idx: number) {
    if (!plan) return
    setMealDraft({ ...plan.meals[idx] })
    setEditingMealIdx(idx)
  }

  function cancelMealEdit() {
    setEditingMealIdx(null)
  }

  async function saveMealEdit() {
    if (!plan || editingMealIdx === null) return
    setIsSavingMeal(true)
    const meals = plan.meals.map((m, i) => i === editingMealIdx ? { ...mealDraft } : m)
    try {
      await fetch(`/api/meal-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meals }) })
      setPlan({ ...plan, meals })
      setEditingMealIdx(null)
    } finally {
      setIsSavingMeal(false)
    }
  }

  async function deleteMeal(idx: number) {
    if (!plan) return
    const meals = plan.meals.filter((_, i) => i !== idx)
    await fetch(`/api/meal-plans/${plan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meals }) })
    setPlan({ ...plan, meals })
    setEditingMealIdx(null)
    toast.success('Meal removed')
  }

  if (loading) return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] border border-[#EAF2EB]">
      <div className="h-6 w-32 bg-[#EAF2EB] rounded-xl animate-pulse mb-3" />
      <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-[#F5F8F3] rounded-2xl animate-pulse" />)}</div>
    </div>
  )

  if (!plan) return (
    <div className="bg-[#F5F8F3] border border-[#EAF2EB] rounded-3xl p-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-[#EAF2EB] flex items-center justify-center mx-auto">
        <Utensils className="w-5 h-5 text-[#6B7A72]" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>No meal plan yet</h3>
        <p className="text-xs text-[#6B7A72] mt-1">Let Trish build you a plan based on your protein and calorie targets.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs mx-auto">
        <Link href="/maintenance?tab=nutrition&action=generate_daily_meal" className="flex-1 bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold text-center hover:shadow-lg transition-all">
          Daily plan
        </Link>
        <Link href="/maintenance?tab=nutrition&action=generate_weekly_meal" className="flex-1 bg-white border border-[#1F4B32] text-[#1F4B32] px-5 py-2.5 rounded-2xl text-xs font-semibold text-center hover:bg-[#F5F8F3] transition-all">
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
            <p className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Active Meal Plan</p>
            {editing ? (
              <div className="mt-1 space-y-2">
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32]" />
                <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description"
                  className="w-full px-3 py-1.5 rounded-xl border border-[#EAF2EB] text-xs text-[#0D1F16] outline-none focus:border-[#1F4B32] placeholder:text-[#6B7A72]/40" />
                <div className="flex items-center gap-2">
                  <button onClick={cancelEdit}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-[#EAF2EB] text-[#6B7A72] font-medium text-xs hover:bg-[#FAFAF7] transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={saveEdit} disabled={!titleChanged || isSaving}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-[#1F4B32] text-white font-semibold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer">
                    {isSaving ? 'Saving\u2026' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-[#0D1F16] truncate" style={{ fontFamily: 'var(--font-fraunces)' }}>{plan.title}</h2>
                {plan.description && <p className="text-xs text-[#6B7A72] mt-0.5 line-clamp-2">{plan.description}</p>}
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F8F3] hover:bg-[#EAF2EB] text-[#1F4B32] text-xs font-medium transition-colors cursor-pointer">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              {allPlans.length > 1 && (
                <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1F4B32] hover:bg-[#EAF2EB] cursor-pointer transition-all">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Plan history dropdown */}
        {showHistory && (
          <div className="mb-3 bg-[#F5F8F3] rounded-2xl p-2.5 space-y-1">
            {allPlans.map(p => (
              <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors">
                <button onClick={() => setActivePlan(p.id)} className="flex-1 text-left text-xs text-[#0D1F16] cursor-pointer flex items-center gap-2">
                  {p.is_active && <Check className="w-3 h-3 text-[#1F4B32]" />}
                  <span className={p.is_active ? 'font-semibold text-[#1F4B32]' : ''}>{p.title}</span>
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

        {/* Meals */}
        <div className="space-y-2 mt-3">
          {plan.meals.map((meal, i) => (
            <div key={i} className="bg-[#F5F8F3] rounded-2xl overflow-hidden">
              {editingMealIdx === i ? (
                /* ── Edit mode ── */
                <div className="p-3.5 space-y-3">
                  <div>
                    <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Meal type</label>
                    <div className="flex gap-1 mt-1">
                      {MEAL_TYPES.map(t => (
                        <button key={t} onClick={() => setMealDraft({ ...mealDraft, meal_type: t })}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold capitalize cursor-pointer transition-all ${mealDraft.meal_type === t ? 'bg-white shadow-sm text-[#1F4B32]' : 'text-[#6B7A72] hover:bg-white/50'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Meal name</label>
                    <input type="text" value={mealDraft.name} onChange={e => setMealDraft({ ...mealDraft, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] bg-white" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Calories</label>
                      <input type="number" value={mealDraft.estimated_calories || ''} onChange={e => setMealDraft({ ...mealDraft, estimated_calories: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] bg-white" />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Protein (g)</label>
                      <input type="number" value={mealDraft.estimated_protein || ''} onChange={e => setMealDraft({ ...mealDraft, estimated_protein: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Ingredients</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(mealDraft.ingredients || []).map((ing, j) => (
                        <span key={j} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-[10px] text-[#0D1F16] border border-[#EAF2EB]">
                          {ing}
                          <button onClick={() => setMealDraft({ ...mealDraft, ingredients: (mealDraft.ingredients || []).filter((_, k) => k !== j) })}
                            className="text-[#6B7A72] hover:text-red-500 cursor-pointer">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="Add ingredient..."
                        className="px-2 py-1 rounded-lg text-[10px] text-[#0D1F16] outline-none bg-white border border-dashed border-[#EAF2EB] focus:border-[#1F4B32] min-w-[100px] flex-1"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                            setMealDraft({ ...mealDraft, ingredients: [...(mealDraft.ingredients || []), (e.target as HTMLInputElement).value.trim()] });
                            (e.target as HTMLInputElement).value = ''
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-semibold text-[#6B7A72] uppercase tracking-wider">Prep notes</label>
                    <textarea value={mealDraft.prep_notes || ''} onChange={e => setMealDraft({ ...mealDraft, prep_notes: e.target.value })}
                      placeholder="How to make it (optional)"
                      rows={2}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] bg-white resize-none placeholder:text-[#6B7A72]/40" />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={cancelMealEdit}
                      className="flex-1 px-4 py-2.5 rounded-2xl border border-[#EAF2EB] text-[#6B7A72] font-medium text-xs hover:bg-white transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={saveMealEdit} disabled={isSavingMeal || !mealDraft.name.trim()}
                      className="flex-1 px-4 py-2.5 rounded-2xl bg-[#1F4B32] text-white font-semibold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer">
                      {isSavingMeal ? 'Saving\u2026' : 'Save'}
                    </button>
                  </div>
                  <button onClick={() => deleteMeal(i)}
                    className="w-full text-xs text-red-500 font-medium py-1.5 hover:text-red-600 cursor-pointer transition-colors">
                    Delete this meal
                  </button>
                </div>
              ) : (
                /* ── Display mode ── */
                <div className="p-3.5 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs">{mealIcons[meal.meal_type] || '🍽️'}</span>
                        <span className="text-[9px] font-semibold text-[#6B7A72] uppercase">{meal.meal_type}</span>
                      </div>
                      <p className="text-sm font-medium text-[#0D1F16]">{meal.name}</p>
                      {(meal.estimated_protein || meal.estimated_calories) && (
                        <p className="text-[10px] text-[#6B7A72] mt-0.5">
                          {meal.estimated_calories && `${meal.estimated_calories} cal`}
                          {meal.estimated_calories && meal.estimated_protein && ' · '}
                          {meal.estimated_protein && `${meal.estimated_protein}g protein`}
                        </p>
                      )}
                      {meal.prep_notes && <p className="text-[10px] text-[#6B7A72]/60 mt-0.5 italic">{meal.prep_notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      {onLogFood && (
                        <button onClick={() => onLogFood(meal)} title="Log this meal"
                          className="px-2 py-1 rounded-lg bg-[#EAF2EB] text-[#1F4B32] text-[9px] font-semibold cursor-pointer hover:bg-[#1F4B32] hover:text-white transition-all">
                          Log it
                        </button>
                      )}
                      <button onClick={() => startMealEdit(i)} title="Edit this meal"
                        className="px-2 py-1 rounded-lg bg-[#EAF2EB] text-[#1F4B32] text-[9px] font-semibold cursor-pointer hover:bg-[#1F4B32] hover:text-white transition-all">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Grocery list */}
        {plan.grocery_list && plan.grocery_list.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowGrocery(!showGrocery)}
              className="flex items-center gap-2 text-xs text-[#6B7A72] font-medium cursor-pointer hover:text-[#1F4B32] transition-colors">
              <ShoppingCart className="w-3.5 h-3.5" />
              Grocery list ({plan.grocery_list.length} items)
              <ChevronDown className={`w-3 h-3 transition-transform ${showGrocery ? 'rotate-180' : ''}`} />
            </button>
            {showGrocery && (
              <div className="mt-2 bg-[#F5F8F3] rounded-2xl p-3 space-y-1.5">
                {plan.grocery_list.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs text-[#0D1F16] cursor-pointer">
                    <input type="checkbox" className="rounded border-[#EAF2EB] text-[#1F4B32] focus:ring-[#1F4B32]" />
                    {item}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Talk to Trish CTA */}
        <div className="mt-5 pt-5 border-t border-[#EAF2EB]">
          <Link
            href="/maintenance?tab=coach&context=active_meal_plan"
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
