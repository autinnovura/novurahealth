'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import DataImport from '../components/DataImport'
import BottomNav from '../components/BottomNav'
import { ArrowLeft, ChevronRight, Download, Shield, AlertTriangle, User, Lock, Database, Syringe, Pill } from 'lucide-react'
import { getMedicationChoices, findMedicationByLabel } from '../lib/medications'

interface Profile {
  name: string; medication: string; dose: string; start_date: string
  current_weight: string; goal_weight: string; primary_goal: string
  biggest_challenge: string; exercise_level: string
  protein_target_g?: number | null; water_target_oz?: number | null
  injection_day?: string | null; injection_time?: string | null
}

const { available: MED_CHOICES } = getMedicationChoices()
const MEDICATIONS = [...MED_CHOICES.map(m => m.label), 'Other']
const GOALS = ['Lose weight', 'Manage blood sugar', 'Reduce appetite', 'Improve health markers', 'Other']
const EXERCISE_LEVELS = ['Sedentary', 'Light (1-2x/week)', 'Moderate (3-4x/week)', 'Active (5+/week)']
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const INJECTION_TIMES = ['Morning', 'Afternoon', 'Evening', 'Night']

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Editable profile fields
  const [name, setName] = useState('')
  const [medication, setMedication] = useState('')
  const [dose, setDose] = useState('')
  const [startDate, setStartDate] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [exerciseLevel, setExerciseLevel] = useState('')
  const [proteinTargetG, setProteinTargetG] = useState('')
  const [waterTargetOz, setWaterTargetOz] = useState('')
  const [injectionDay, setInjectionDay] = useState('')
  const [injectionTime, setInjectionTime] = useState('')

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Active section
  const [activeSection, setActiveSection] = useState<'profile' | 'account' | 'preferences'>('profile')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setEmail(user.email || '')

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) {
        setProfile(p)
        setName(p.name || '')
        setMedication(p.medication || '')
        setDose(p.dose || '')
        setStartDate(p.start_date || '')
        setCurrentWeight(p.current_weight || '')
        setGoalWeight(p.goal_weight || '')
        setPrimaryGoal(p.primary_goal || '')
        setExerciseLevel(p.exercise_level || '')
        setProteinTargetG(p.protein_target_g ? String(p.protein_target_g) : '')
        setWaterTargetOz(p.water_target_oz ? String(p.water_target_oz) : '')
        setInjectionDay(p.injection_day || '')
        setInjectionTime(p.injection_time || '')
      }
      setLoading(false)
    }
    init()
  }, [router])

  async function saveProfile() {
    if (!userId) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      name, medication, dose, start_date: startDate,
      current_weight: currentWeight, goal_weight: goalWeight,
      primary_goal: primaryGoal, exercise_level: exerciseLevel,
      protein_target_g: proteinTargetG ? parseInt(proteinTargetG) : null,
      water_target_oz: waterTargetOz ? parseInt(waterTargetOz) : null,
      injection_day: injectionDay || null,
      injection_time: injectionTime || null,
    }).eq('id', userId)
    if (error) {
      toast.error('Failed to save: ' + error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function changePassword() {
    setPasswordError('')
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) { setPasswordError(error.message); return }
    setPasswordSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => { setPasswordSuccess(false); setShowPasswordChange(false) }, 2000)
  }

  async function deleteAccount() {
    if (deleteText !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error || 'Failed to delete account')
        setDeleting(false)
        return
      }
      toast.success('Account deleted')
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      toast.error('Failed to delete account')
      setDeleting(false)
    }
  }

  async function exportData() {
    if (!userId) return
    const [weights, meds, foods, effects, water, checkins, exercises] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('medication_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('food_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('side_effect_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('water_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('checkin_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
      supabase.from('exercise_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
    ])
    const data = {
      exported_at: new Date().toISOString(),
      profile: { name, email, medication, dose, start_date: startDate, current_weight: currentWeight, goal_weight: goalWeight },
      weight_logs: weights.data || [],
      medication_logs: meds.data || [],
      food_logs: foods.data || [],
      side_effect_logs: effects.data || [],
      water_logs: water.data || [],
      checkin_logs: checkins.data || [],
      exercise_logs: exercises.data || [],
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `novura-export-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="w-full max-w-2xl mx-auto px-4 space-y-4">
        <div className="h-16 bg-[#EAF2EB] rounded-3xl animate-pulse" />
        <div className="h-10 bg-[#EAF2EB] rounded-2xl animate-pulse" />
        <div className="h-48 bg-[#EAF2EB] rounded-3xl animate-pulse" />
        <div className="h-48 bg-[#EAF2EB] rounded-3xl animate-pulse" />
        <div className="h-32 bg-[#EAF2EB] rounded-3xl animate-pulse" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: 'var(--font-inter)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 py-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-all duration-300 cursor-pointer">
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-white font-semibold text-xl tracking-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>Settings</h1>
        </div>
      </header>

      {/* Section tabs */}
      <div className="bg-white/80 backdrop-blur-md border-b border-[#EAF2EB] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'profile' as const, label: 'Profile', icon: User },
            { id: 'account' as const, label: 'Account', icon: Lock },
            { id: 'preferences' as const, label: 'Data', icon: Database },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              className={`flex-1 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${activeSection === tab.id ? 'text-[#1F4B32] border-b-2 border-[#7FFFA4]' : 'text-[#6B7A72] hover:text-[#0D1F16]'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ PROFILE ══════════ */}
        {activeSection === 'profile' && (<>
          {/* Personal info */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Personal Info</h2>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Email</label>
              <div className="mt-1 px-3 py-2.5 rounded-2xl bg-[#F5F8F3] text-sm text-[#6B7A72]">{email}</div>
            </div>
          </div>

          {/* Medication */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Medication</h2>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Current Medication</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {MEDICATIONS.map(m => {
                  const medInfo = MED_CHOICES.find(c => c.label === m)
                  const RouteIcon = medInfo?.route === 'oral' ? Pill : Syringe
                  return (
                    <button key={m} onClick={() => setMedication(m)}
                      className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${medication === m ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>
                      {medInfo && <RouteIcon className="w-3 h-3" />}
                      {m}
                      {medInfo?.isNew && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#7FFFA4]/20 text-[#1F4B32]">New</span>}
                    </button>
                  )
                })}
              </div>
              {findMedicationByLabel(medication)?.notes && (
                <p className="text-[10px] text-[#6B7A72] mt-2 leading-relaxed">{findMedicationByLabel(medication)!.notes}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Dose</label>
                <input type="text" autoComplete="off" value={dose} onChange={e => setDose(e.target.value)} placeholder="e.g. 0.5mg"
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/40"/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Injection Day</label>
                <select value={injectionDay} onChange={e => setInjectionDay(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 bg-white">
                  <option value="">Not set</option>
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Injection Time</label>
                <select value={injectionTime} onChange={e => setInjectionTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 bg-white">
                  <option value="">Not set</option>
                  {INJECTION_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Goals</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Current Weight (lbs)</label>
                <input type="number" autoComplete="off" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Goal Weight (lbs)</label>
                <input type="number" autoComplete="off" value={goalWeight} onChange={e => setGoalWeight(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300"/>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Primary Goal</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setPrimaryGoal(g)}
                    className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 ${primaryGoal === g ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Exercise Level</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXERCISE_LEVELS.map(l => (
                  <button key={l} onClick={() => setExerciseLevel(l)}
                    className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all duration-300 ${exerciseLevel === l ? 'border-[#1F4B32] bg-[#EAF2EB] text-[#1F4B32] font-semibold' : 'border-[#EAF2EB] text-[#6B7A72]'}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Targets */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Daily Targets</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Protein Target (g)</label>
                <input type="number" autoComplete="off" value={proteinTargetG} onChange={e => setProteinTargetG(e.target.value)}
                  placeholder={goalWeight ? String(Math.round((parseFloat(goalWeight) / 2.205) * 1.4)) : '100'}
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/40"/>
                <p className="text-[9px] text-[#6B7A72] mt-1">Leave blank to auto-calculate</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Water Target (oz)</label>
                <input type="number" autoComplete="off" value={waterTargetOz} onChange={e => setWaterTargetOz(e.target.value)}
                  placeholder="80"
                  className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/40"/>
                <p className="text-[9px] text-[#6B7A72] mt-1">Default: 80 oz</p>
              </div>
            </div>
          </div>

          {/* Save */}
          <button onClick={saveProfile} disabled={saving}
            className={`w-full py-3.5 rounded-2xl text-sm font-semibold cursor-pointer transition-all duration-300 ${saved ? 'bg-[#EAF2EB] text-[#1F4B32]' : 'bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white hover:shadow-lg'} disabled:opacity-50`}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </>)}

        {/* ══════════ ACCOUNT ══════════ */}
        {activeSection === 'account' && (<>
          {/* Password */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Password</h2>
              {!showPasswordChange && (
                <button onClick={() => setShowPasswordChange(true)}
                  className="text-xs font-semibold text-[#1F4B32] cursor-pointer hover:text-[#2D6B45] transition-all duration-300">Change</button>
              )}
            </div>
            {showPasswordChange ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters"
                    className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/40"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#6B7A72] uppercase tracking-wider">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                    className="w-full mt-1 px-3 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#0D1F16] outline-none focus:border-[#1F4B32] transition-all duration-300 placeholder:text-[#6B7A72]/40"/>
                </div>
                {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                {passwordSuccess && <p className="text-xs text-[#1F4B32] font-medium">✓ Password updated</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword(''); setPasswordError('') }}
                    className="flex-1 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#6B7A72] font-medium cursor-pointer hover:bg-[#F5F8F3] transition-all duration-300">Cancel</button>
                  <button onClick={changePassword} disabled={changingPassword}
                    className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white text-sm font-semibold cursor-pointer hover:shadow-lg transition-all duration-300 disabled:opacity-50">
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#6B7A72]">Last changed: Unknown</p>
            )}
          </div>

          {/* Session */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Session</h2>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-[#0D1F16]">Signed in as</p>
                <p className="text-xs text-[#6B7A72]">{email}</p>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
                className="px-4 py-2 rounded-2xl border border-[#EAF2EB] text-sm text-[#6B7A72] font-medium cursor-pointer hover:bg-[#F5F8F3] hover:text-[#0D1F16] transition-all duration-300">
                Log out
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white border border-red-100/20 rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-red-600" style={{ fontFamily: 'var(--font-fraunces)' }}>Danger Zone</h2>
            </div>
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#0D1F16]">Delete Account</p>
                  <p className="text-xs text-[#6B7A72]">Permanently remove your account and all data</p>
                </div>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-2xl border border-red-200 text-sm text-red-600 font-medium cursor-pointer hover:bg-red-50 transition-all duration-300">
                  Delete
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-red-600">This action cannot be undone. Type <strong>DELETE</strong> to confirm.</p>
                <input type="text" autoComplete="off" value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Type DELETE"
                  className="w-full px-3 py-2.5 rounded-2xl border border-red-200 text-sm text-[#0D1F16] outline-none focus:border-red-400 transition-all duration-300 placeholder:text-[#6B7A72]/40"/>
                <div className="flex gap-2">
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
                    className="flex-1 py-2.5 rounded-2xl border border-[#EAF2EB] text-sm text-[#6B7A72] font-medium cursor-pointer hover:bg-[#F5F8F3] transition-all duration-300">Cancel</button>
                  <button onClick={deleteAccount} disabled={deleteText !== 'DELETE' || deleting}
                    className="flex-1 py-2.5 rounded-2xl bg-red-600 text-white text-sm font-semibold cursor-pointer hover:bg-red-700 transition-all duration-300 disabled:opacity-30">
                    {deleting ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* ══════════ DATA ══════════ */}
        {activeSection === 'preferences' && (<>
          {/* Import */}
          {userId && <DataImport />}

          {/* Export */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>Export Your Data</h2>
            <p className="text-xs text-[#6B7A72]">Download all your logs — weight, food, medication, side effects, water, check-ins, and exercise — as a JSON file.</p>
            <button onClick={exportData}
              className="w-full py-3.5 rounded-2xl border border-[#1F4B32] text-[#1F4B32] text-sm font-semibold cursor-pointer hover:bg-[#EAF2EB] transition-all duration-300 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" strokeWidth={1.5} />
              Export All Data
            </button>
          </div>

          {/* App info */}
          <div className="bg-[#F5F8F3] border border-[#EAF2EB] rounded-3xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-[#0D1F16]" style={{ fontFamily: 'var(--font-fraunces)' }}>About</h2>
            <div className="space-y-2">
              <div className="flex justify-between py-4 border-b border-[#F5F8F3]">
                <span className="text-sm text-[#6B7A72]">Version</span>
                <span className="text-sm text-[#0D1F16] font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between py-4 border-b border-[#F5F8F3]">
                <span className="text-sm text-[#6B7A72]">Account created</span>
                <span className="text-sm text-[#0D1F16] font-medium">{startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
              </div>
              <div className="flex justify-between py-4">
                <span className="text-sm text-[#6B7A72]">Contact</span>
                <a href="mailto:support@novurahealth.com" className="text-sm text-[#1F4B32] font-medium">support@novurahealth.com</a>
              </div>
            </div>
          </div>

          {/* Legal links */}
          <div className="bg-white border border-[#EAF2EB] rounded-3xl shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)] overflow-hidden">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
            ].map((link, i) => (
              <a key={link.label} href={link.href}
                className={`flex items-center justify-between px-6 py-4 hover:bg-[#F5F8F3] transition-all duration-300 ${i > 0 ? 'border-t border-[#F5F8F3]' : ''}`}>
                <span className="text-sm text-[#0D1F16]">{link.label}</span>
                <ChevronRight className="w-4 h-4 text-[#6B7A72]" strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </>)}
      </div>

      <BottomNav />
    </div>
  )
}
