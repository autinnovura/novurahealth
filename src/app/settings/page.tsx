'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import DataImport from '../components/DataImport'

interface Profile {
  name: string; medication: string; dose: string; start_date: string
  current_weight: string; goal_weight: string; primary_goal: string
  biggest_challenge: string; exercise_level: string
  protein_target_g?: number | null; water_target_oz?: number | null
  injection_day?: string | null; injection_time?: string | null
}

const MEDICATIONS = ['Semaglutide (Ozempic)', 'Semaglutide (Wegovy)', 'Tirzepatide (Mounjaro)', 'Tirzepatide (Zepbound)', 'Liraglutide (Saxenda)', 'Dulaglutide (Trulicity)', 'Other']
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
    await supabase.from('profiles').update({
      name, medication, dose, start_date: startDate,
      current_weight: currentWeight, goal_weight: goalWeight,
      primary_goal: primaryGoal, exercise_level: exerciseLevel,
      protein_target_g: proteinTargetG ? parseInt(proteinTargetG) : null,
      water_target_oz: waterTargetOz ? parseInt(waterTargetOz) : null,
      injection_day: injectionDay || null,
      injection_time: injectionTime || null,
    }).eq('id', userId)
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
    // Sign out and redirect — actual deletion would need a server-side function
    await supabase.auth.signOut()
    router.push('/')
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

  if (loading) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-20">
      {/* Header */}
      <header className="bg-[#2D5A3D] px-5 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-white font-semibold text-lg tracking-tight">Settings</h1>
        </div>
      </header>

      {/* Section tabs */}
      <div className="bg-white border-b border-[#E8E8E4] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          {([
            { id: 'profile' as const, label: 'Profile' },
            { id: 'account' as const, label: 'Account' },
            { id: 'preferences' as const, label: 'Data' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${activeSection === tab.id ? 'text-[#2D5A3D] border-b-2 border-[#2D5A3D]' : 'text-[#B0B0A8] hover:text-[#6B6B65]'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════ PROFILE ══════════ */}
        {activeSection === 'profile' && (<>
          {/* Personal info */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">Personal Info</h2>
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Email</label>
              <div className="mt-1 px-3 py-2.5 rounded-lg bg-[#F5F5F2] text-sm text-[#6B6B65]">{email}</div>
            </div>
          </div>

          {/* Medication */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">Medication</h2>
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Current Medication</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {MEDICATIONS.map(m => (
                  <button key={m} onClick={() => setMedication(m)}
                    className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${medication === m ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{m}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Dose</label>
                <input type="text" autoComplete="off" value={dose} onChange={e => setDose(e.target.value)} placeholder="e.g. 0.5mg"
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Injection Day</label>
                <select value={injectionDay} onChange={e => setInjectionDay(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] bg-white">
                  <option value="">Not set</option>
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Injection Time</label>
                <select value={injectionTime} onChange={e => setInjectionTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] bg-white">
                  <option value="">Not set</option>
                  {INJECTION_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">Goals</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Current Weight (lbs)</label>
                <input type="number" autoComplete="off" value={currentWeight} onChange={e => setCurrentWeight(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]"/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Goal Weight (lbs)</label>
                <input type="number" autoComplete="off" value={goalWeight} onChange={e => setGoalWeight(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D]"/>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Primary Goal</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setPrimaryGoal(g)}
                    className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${primaryGoal === g ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Exercise Level</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXERCISE_LEVELS.map(l => (
                  <button key={l} onClick={() => setExerciseLevel(l)}
                    className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${exerciseLevel === l ? 'border-[#2D5A3D] bg-[#E8F0EB] text-[#2D5A3D] font-semibold' : 'border-[#EDEDEA] text-[#8B8B83]'}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Targets */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">Daily Targets</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Protein Target (g)</label>
                <input type="number" autoComplete="off" value={proteinTargetG} onChange={e => setProteinTargetG(e.target.value)}
                  placeholder={goalWeight ? String(Math.round((parseFloat(goalWeight) / 2.205) * 1.4)) : '100'}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
                <p className="text-[9px] text-[#B0B0A8] mt-1">Leave blank to auto-calculate</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Water Target (oz)</label>
                <input type="number" autoComplete="off" value={waterTargetOz} onChange={e => setWaterTargetOz(e.target.value)}
                  placeholder="80"
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
                <p className="text-[9px] text-[#B0B0A8] mt-1">Default: 80 oz</p>
              </div>
            </div>
          </div>

          {/* Save */}
          <button onClick={saveProfile} disabled={saving}
            className={`w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${saved ? 'bg-[#E8F0EB] text-[#2D5A3D]' : 'bg-[#2D5A3D] text-white hover:bg-[#3A7A52]'} disabled:opacity-50`}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </>)}

        {/* ══════════ ACCOUNT ══════════ */}
        {activeSection === 'account' && (<>
          {/* Password */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-[#1E1E1C]">Password</h2>
              {!showPasswordChange && (
                <button onClick={() => setShowPasswordChange(true)}
                  className="text-xs font-semibold text-[#2D5A3D] cursor-pointer hover:text-[#3A7A52]">Change</button>
              )}
            </div>
            {showPasswordChange ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters"
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#B0B0A8] uppercase tracking-wider">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                    className="w-full mt-1 px-3 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#1E1E1C] outline-none focus:border-[#2D5A3D] placeholder:text-[#C5C5BE]"/>
                </div>
                {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                {passwordSuccess && <p className="text-xs text-[#2D5A3D] font-medium">✓ Password updated</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword(''); setPasswordError('') }}
                    className="flex-1 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#6B6B65] font-medium cursor-pointer hover:bg-[#F5F5F2]">Cancel</button>
                  <button onClick={changePassword} disabled={changingPassword}
                    className="flex-1 py-2.5 rounded-lg bg-[#2D5A3D] text-white text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] disabled:opacity-50">
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#8B8B83]">Last changed: Unknown</p>
            )}
          </div>

          {/* Session */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">Session</h2>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-[#1E1E1C]">Signed in as</p>
                <p className="text-xs text-[#8B8B83]">{email}</p>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
                className="px-4 py-2 rounded-lg border border-[#EDEDEA] text-sm text-[#6B6B65] font-medium cursor-pointer hover:bg-[#F5F5F2] hover:text-[#1E1E1C] transition-colors">
                Log out
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white border border-red-100 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#1E1E1C]">Delete Account</p>
                  <p className="text-xs text-[#8B8B83]">Permanently remove your account and all data</p>
                </div>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-lg border border-red-200 text-sm text-red-600 font-medium cursor-pointer hover:bg-red-50 transition-colors">
                  Delete
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-red-600">This action cannot be undone. Type <strong>DELETE</strong> to confirm.</p>
                <input type="text" autoComplete="off" value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Type DELETE"
                  className="w-full px-3 py-2.5 rounded-lg border border-red-200 text-sm text-[#1E1E1C] outline-none focus:border-red-400 placeholder:text-[#C5C5BE]"/>
                <div className="flex gap-2">
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
                    className="flex-1 py-2.5 rounded-lg border border-[#EDEDEA] text-sm text-[#6B6B65] font-medium cursor-pointer hover:bg-[#F5F5F2]">Cancel</button>
                  <button onClick={deleteAccount} disabled={deleteText !== 'DELETE'}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold cursor-pointer hover:bg-red-700 disabled:opacity-30">
                    Delete My Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* ══════════ DATA ══════════ */}
        {activeSection === 'preferences' && (<>
          {/* Import */}
          {userId && <DataImport userId={userId} />}

          {/* Export */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">Export Your Data</h2>
            <p className="text-xs text-[#8B8B83]">Download all your logs — weight, food, medication, side effects, water, check-ins, and exercise — as a JSON file.</p>
            <button onClick={exportData}
              className="w-full py-3 rounded-xl border border-[#2D5A3D] text-[#2D5A3D] text-sm font-semibold cursor-pointer hover:bg-[#E8F0EB] transition-colors">
              📥 Export All Data
            </button>
          </div>

          {/* App info */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#1E1E1C]">About</h2>
            <div className="space-y-2">
              <div className="flex justify-between py-1.5 border-b border-[#F5F5F2]">
                <span className="text-sm text-[#8B8B83]">Version</span>
                <span className="text-sm text-[#1E1E1C] font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F5F5F2]">
                <span className="text-sm text-[#8B8B83]">Account created</span>
                <span className="text-sm text-[#1E1E1C] font-medium">{startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-[#8B8B83]">Contact</span>
                <a href="mailto:support@novurahealth.com" className="text-sm text-[#2D5A3D] font-medium">support@novurahealth.com</a>
              </div>
            </div>
          </div>

          {/* Legal links */}
          <div className="bg-white border border-[#EDEDEA] rounded-xl overflow-hidden">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
            ].map((link, i) => (
              <a key={link.label} href={link.href}
                className={`flex items-center justify-between px-5 py-4 hover:bg-[#F5F5F2] transition-colors ${i > 0 ? 'border-t border-[#F5F5F2]' : ''}`}>
                <span className="text-sm text-[#1E1E1C]">{link.label}</span>
                <svg className="w-4 h-4 text-[#B0B0A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M9 5l7 7-7 7"/></svg>
              </a>
            ))}
          </div>
        </>)}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDEDEA] px-4 py-2 flex justify-around z-50">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg><span className="text-[10px] font-medium">Home</span></a>
        <a href="/maintenance" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg><span className="text-[10px] font-medium">Transition</span></a>
        <a href="/chat" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><span className="text-[10px] font-medium">Nova</span></a>
        <a href="/savings" className="flex flex-col items-center gap-0.5 text-[#B0B0A8] hover:text-[#2D5A3D] transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span className="text-[10px] font-medium">Savings</span></a>
        <a href="/settings" className="flex flex-col items-center gap-0.5 text-[#2D5A3D]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span className="text-[10px] font-semibold">Settings</span></a>
      </nav>
    </div>
  )
}
