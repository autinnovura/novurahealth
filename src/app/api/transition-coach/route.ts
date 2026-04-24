import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { chatLimiter, checkRateLimit } from '../../lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function getUserContext(userId: string) {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const monthAgo = new Date(now.getTime() - 30 * 86400000)

  const [
    profile, weights, recentFood, todayFood, todayWater,
    meds, sideEffects, checkins, exercises,
    taperPlan, taperCheckins
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('weight_logs').select('weight, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(30),
    supabaseAdmin.from('food_logs').select('meal_type, food_name, calories, protein, carbs, fat, logged_at').eq('user_id', userId).gte('logged_at', weekAgo.toISOString()).order('logged_at', { ascending: false }),
    supabaseAdmin.from('food_logs').select('meal_type, food_name, calories, protein, carbs, fat').eq('user_id', userId).gte('logged_at', today.toISOString()),
    supabaseAdmin.from('water_logs').select('amount_oz').eq('user_id', userId).gte('logged_at', today.toISOString()),
    supabaseAdmin.from('medication_logs').select('medication, dose, injection_site, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(20),
    supabaseAdmin.from('side_effect_logs').select('symptom, severity, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
    supabaseAdmin.from('checkin_logs').select('mood, energy, notes, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(7),
    supabaseAdmin.from('exercise_logs').select('exercise_type, duration_minutes, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(14),
    supabaseAdmin.from('tapering_plans').select('*').eq('user_id', userId).single(),
    supabaseAdmin.from('tapering_checkins').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(14),
  ])

  const p = profile.data
  if (!p) return null

  const weightData = weights.data || []
  const latestWeight = weightData[0]?.weight || null
  const startWeight = p.current_weight ? parseFloat(p.current_weight) : null
  const goalWeight = p.goal_weight ? parseFloat(p.goal_weight) : null
  const totalLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const toGoal = goalWeight && latestWeight ? Math.round((latestWeight - goalWeight) * 10) / 10 : null
  const goalWeightKg = goalWeight ? Math.round(goalWeight / 2.205) : null
  const proteinTarget = p.protein_target_g || (goalWeightKg ? Math.round(goalWeightKg * 1.4) : null)

  let weightTrend = 'stable'
  if (weightData.length >= 6) {
    const recent = weightData.slice(0, 3).map((w: { weight: number }) => w.weight)
    const older = weightData.slice(-3).map((w: { weight: number }) => w.weight)
    const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a: number, b: number) => a + b, 0) / older.length
    if (recentAvg < olderAvg - 1) weightTrend = 'losing'
    else if (recentAvg > olderAvg + 1) weightTrend = 'gaining'
  }

  const todayFoodData = todayFood.data || []
  const todayCal = todayFoodData.reduce((s: number, f: { calories: number }) => s + (f.calories || 0), 0)
  const todayP = todayFoodData.reduce((s: number, f: { protein: number }) => s + (f.protein || 0), 0)
  const todayWaterOz = (todayWater.data || []).reduce((s: number, w: { amount_oz: number }) => s + w.amount_oz, 0)

  const weekFoodData = recentFood.data || []
  const foodDays = new Set(weekFoodData.map((f: { logged_at: string }) => f.logged_at.split('T')[0])).size || 1
  const weekAvgCal = Math.round(weekFoodData.reduce((s: number, f: { calories: number }) => s + (f.calories || 0), 0) / foodDays)
  const weekAvgP = Math.round(weekFoodData.reduce((s: number, f: { protein: number }) => s + (f.protein || 0), 0) / foodDays)

  const foodCounts: Record<string, number> = {}
  weekFoodData.forEach((f: { food_name: string }) => { foodCounts[f.food_name] = (foodCounts[f.food_name] || 0) + 1 })
  const topFoods = Object.entries(foodCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => `${name} (${count}x)`)

  const symptomCounts: Record<string, number> = {}
  const sideEffectData = sideEffects.data || []
  sideEffectData.forEach((s: { symptom: string }) => { symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1 })
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => `${s} (${c}x)`)

  const medData = meds.data || []
  const lastInjection = medData[0] || null
  const daysSinceInjection = lastInjection ? Math.floor((now.getTime() - new Date(lastInjection.logged_at).getTime()) / 86400000) : null
  const daysOnMed = p.start_date ? Math.max(1, Math.floor((now.getTime() - new Date(p.start_date).getTime()) / 86400000)) : null

  const exerciseData = exercises.data || []
  const weekExercises = exerciseData.filter((e: { logged_at: string }) => new Date(e.logged_at) >= weekAgo)

  const tp = taperPlan.data
  const tc = taperCheckins.data || []

  const checkinData = checkins.data || []
  const avgMood = checkinData.length > 0 ? Math.round(checkinData.reduce((s: number, c: { mood: number }) => s + c.mood, 0) / checkinData.length * 10) / 10 : null
  const avgEnergy = checkinData.length > 0 ? Math.round(checkinData.reduce((s: number, c: { energy: number }) => s + c.energy, 0) / checkinData.length * 10) / 10 : null

  return `
USER PROFILE:
Name: ${p.name}
Medication: ${p.medication} at ${p.dose}
Days on medication: ${daysOnMed || 'unknown'}
Start weight: ${startWeight || 'unknown'} lbs
Current weight: ${latestWeight || 'unknown'} lbs
Goal weight: ${goalWeight || 'unknown'} lbs (${goalWeightKg || '?'}kg)
Total lost: ${totalLost !== null ? `${totalLost} lbs` : 'unknown'}
Remaining to goal: ${toGoal !== null ? `${toGoal} lbs` : 'unknown'}
Weight trend (2 weeks): ${weightTrend}
Protein target: ${proteinTarget || 'unknown'}g/day
Exercise level: ${p.exercise_level || 'unknown'}

TODAY:
Calories: ${todayCal} | Protein: ${todayP}g${proteinTarget ? `/${proteinTarget}g` : ''} | Water: ${todayWaterOz}oz

WEEKLY AVERAGES:
Avg daily calories: ${weekAvgCal} | Avg daily protein: ${weekAvgP}g
Workouts this week: ${weekExercises.length}${weekExercises.length > 0 ? ` — ${weekExercises.map((e: { exercise_type: string; duration_minutes: number }) => `${e.exercise_type} ${e.duration_minutes}min`).join(', ')}` : ''}

COMMON FOODS THIS WEEK: ${topFoods.length > 0 ? topFoods.join(', ') : 'Not enough data'}

WEIGHT HISTORY (last 30): ${weightData.length > 0 ? weightData.map((w: { weight: number; logged_at: string }) => `${new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${w.weight}`).join(' | ') : 'None'}

INJECTION HISTORY: Last: ${lastInjection ? `${lastInjection.dose} at ${lastInjection.injection_site} (${daysSinceInjection}d ago)` : 'None logged'}
Dose history: ${medData.slice(0, 8).map((m: { dose: string; logged_at: string }) => `${m.dose} on ${new Date(m.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`).join(', ') || 'none'}

SIDE EFFECTS: ${topSymptoms.length > 0 ? topSymptoms.join(', ') : 'None reported'}

MOOD/ENERGY: ${avgMood !== null ? `Avg mood: ${avgMood}/5, energy: ${avgEnergy}/5` : 'No data'}

EXERCISE (last 14): ${exerciseData.length > 0 ? exerciseData.map((e: { exercise_type: string; duration_minutes: number; logged_at: string }) => `${e.exercise_type} ${e.duration_minutes}min (${new Date(e.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`).join(', ') : 'None'}

TAPERING STATUS: ${tp ? `Phase: ${tp.phase} | Readiness: ${tp.readiness_score ?? 'not assessed'}% | Stability streak: ${tp.stability_streak_days || 0} days` : 'Not started'}
${tc.length > 0 ? `Recent tapering check-ins: ${tc.slice(0, 5).map((c: { hunger: number; cravings: number; confidence: number; weight: number; logged_at: string }) => `${new Date(c.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: hunger ${c.hunger}/5, cravings ${c.cravings}/5, confidence ${c.confidence}/5${c.weight ? `, ${c.weight}lbs` : ''}`).join(' | ')}` : ''}
`.trim()
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { success: allowed } = await checkRateLimit(chatLimiter, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', message: 'Too many requests. Please slow down and try again.' }, { status: 429 })
  }

  let body: { messages?: { role: string; content: string }[] }
  try {
    body = await req.json()
  } catch (err: unknown) {
    console.error('Transition coach body parse error:', err)
    return NextResponse.json({ error: 'Invalid request body', message: 'Unable to process request. Try again.' }, { status: 400 })
  }

  const { messages } = body
  if (!messages?.length) {
    return NextResponse.json({ error: 'Missing data', message: 'No message provided.' }, { status: 400 })
  }

  const context = await getUserContext(user.id)
  if (!context) {
    return NextResponse.json({ error: 'User not found', message: 'Profile not found. Please complete onboarding.' }, { status: 404 })
  }

  const systemPrompt = `You are Trish, the NovuraHealth Transition Coach. You help GLP-1 users taper off medication, build sustainable habits, and maintain their results long-term. You're direct, confident, and you give plans — not questions. Think of yourself as a no-nonsense personal trainer who also knows nutrition and pharmacology.

${context}

CORE RULE: GIVE ANSWERS. DO NOT INTERVIEW.
You have their data. Use it. When asked for any plan, output the COMPLETE plan immediately. Let them refine after. Never ask more than one question, and only if truly critical data is missing.

WHAT YOU DO:

TAPERING PLANS — When asked, generate a full personalized plan using their actual data:

[Name]'s TAPERING PLAN
Current: [medication] [dose] since [date]
Weight: [current] → Goal: [goal] ([X] lbs lost so far)

Phase 1 (Weeks 1-4): Stay at [current dose]
- Lock in habits before any changes
- Protein: [X]g/day (based on 1.4g/kg of goal weight)
- Exercise: [their current routine or recommended]
- Weekly weigh-in day: [day]

Phase 2 (Weeks 5-8): Reduce to [next dose down]
- Expect: appetite may increase 20-30%
- Red flag: >3lbs gain over 2 weeks = pause
- Keep protein at [X]g minimum

Phase 3 (Weeks 9-12): Reduce to [lowest dose]
- Monitor: hunger 1-5, weight trend, energy
- If stable after 4 weeks: move to Phase 4
- If struggling: stay here 4 more weeks

Phase 4 (Weeks 13-16): Discontinue
- Weigh daily first 2 weeks
- Track all food
- Protein [X]g, exercise 4x/week
- >5lbs sustained gain: discuss maintenance dose with doctor

Maintenance (Ongoing):
- Weekly weigh-ins
- Protein [X]g/day
- Exercise 3-4x/week
- Sleep 7+ hours

MEAL PLANS — When asked, generate a full daily or weekly plan:

[Name]'s MEAL PLAN — [X]g protein, ~[X] calories

BREAKFAST (30g protein):
2 eggs scrambled with spinach
1 cup Greek yogurt with berries
→ 310 cal, 32g protein

LUNCH (35g protein):
6oz grilled chicken breast
Mixed greens with olive oil
1/2 cup brown rice
→ 420 cal, 38g protein

SNACK (15g protein):
Protein shake (1 scoop whey + water)
→ 130 cal, 25g protein

DINNER (30g protein):
5oz salmon
Roasted broccoli, sweet potato
→ 450 cal, 33g protein

TOTAL: ~1,310 cal, 128g protein

Rules for meals:
- Always hit protein target. Every meal is protein-first.
- Check their food_logs to know what they actually like and eat
- Nausea days: soft, bland, cold (yogurt, shakes, crackers)
- Low appetite: calorie-dense protein (nuts, cheese, shakes)
- Be specific: "6oz chicken breast (38g protein)" not "a lean protein"

RECIPES — When asked, give the full recipe immediately:
[Name] — [X] servings, [X]g protein per serving
Ingredients:
- each item with amount
Steps:
1. step
2. step
3. step
Prep: [X] min | Cook: [X] min

EXERCISE PLANS — When asked, generate a full weekly plan:

[Name]'s EXERCISE PLAN — [Level]

Monday - Upper Body (45 min)
Bench press or push-ups: 3x10
Dumbbell rows: 3x12
Overhead press: 3x10
Bicep curls: 2x12

Tuesday - Walk (30 min)

Wednesday - Lower Body (45 min)
Squats: 3x10
Lunges: 3x10 each
Romanian deadlifts: 3x10
Calf raises: 3x15

Thursday - Rest

Friday - Full Body (40 min)
Deadlifts: 3x8
Pull-ups or lat pulldown: 3x10
Planks: 3x30sec

Saturday - Cardio (30 min)
Sunday - Rest

Scale to their level: Beginner (bodyweight only), Intermediate (dumbbells), Advanced (barbell)

TONE: Direct. Confident. No fluff. Use their actual numbers from the data above. Use line breaks for readability. No asterisks, no markdown bold/italic, no headers with #. Plain text with clean formatting. For simple questions, 2-4 sentences max. For full plans, output the complete structured plan.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: messages.slice(-20),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'unknown')
      console.error('Anthropic API error:', res.status, errBody)
      return NextResponse.json({
        error: 'API error',
        message: 'Trish is temporarily unavailable. Try again in a moment.',
        debug: process.env.NODE_ENV === 'development' ? errBody : undefined,
      }, { status: 502 })
    }

    const result = await res.json()
    const reply = result.content?.[0]?.text
    if (!reply) {
      console.error('Anthropic API returned empty content:', JSON.stringify(result))
      return NextResponse.json({
        error: 'Empty response',
        message: 'Trish is temporarily unavailable. Try again in a moment.',
      }, { status: 502 })
    }
    return NextResponse.json({ message: reply })
  } catch (err: unknown) {
    console.error('Tapering plan error:', err)
    return NextResponse.json({
      error: 'Unable to generate plan',
      message: 'Trish is temporarily unavailable. Try again in a moment.',
      debug: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : undefined,
    }, { status: 500 })
  }
}
