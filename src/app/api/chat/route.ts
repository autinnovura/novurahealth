import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    weekWater, meds, sideEffects, checkins, exercises,
    taperPlan, taperCheckins
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('weight_logs').select('weight, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(14),
    supabaseAdmin.from('food_logs').select('meal_type, food_name, calories, protein, carbs, fat, logged_at').eq('user_id', userId).gte('logged_at', weekAgo.toISOString()).order('logged_at', { ascending: false }),
    supabaseAdmin.from('food_logs').select('meal_type, food_name, calories, protein, carbs, fat').eq('user_id', userId).gte('logged_at', today.toISOString()),
    supabaseAdmin.from('water_logs').select('amount_oz').eq('user_id', userId).gte('logged_at', today.toISOString()),
    supabaseAdmin.from('water_logs').select('amount_oz, logged_at').eq('user_id', userId).gte('logged_at', weekAgo.toISOString()),
    supabaseAdmin.from('medication_logs').select('medication, dose, injection_site, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(8),
    supabaseAdmin.from('side_effect_logs').select('symptom, severity, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
    supabaseAdmin.from('checkin_logs').select('mood, energy, notes, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(7),
    supabaseAdmin.from('exercise_logs').select('exercise_type, duration_minutes, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
    supabaseAdmin.from('tapering_plans').select('*').eq('user_id', userId).single(),
    supabaseAdmin.from('tapering_checkins').select('*').eq('user_id', userId).order('logged_at', { ascending: false }).limit(5),
  ])

  const p = profile.data
  if (!p) return null

  // ── Compute derived insights ──────────────────────
  const weightData = weights.data || []
  const latestWeight = weightData[0]?.weight || null
  const startWeight = p.current_weight ? parseFloat(p.current_weight) : null
  const goalWeight = p.goal_weight ? parseFloat(p.goal_weight) : null
  const totalLost = startWeight && latestWeight ? Math.round((startWeight - latestWeight) * 10) / 10 : null
  const toGoal = goalWeight && latestWeight ? Math.round((latestWeight - goalWeight) * 10) / 10 : null
  const defaultProteinTarget = goalWeight ? Math.round((goalWeight / 2.205) * 1.4) : null
  const proteinTarget = p.protein_target_g || defaultProteinTarget

  // Weight trend (last 7 entries)
  let weightTrend = 'stable'
  if (weightData.length >= 3) {
    const recent = weightData.slice(0, 3).map(w => w.weight)
    const older = weightData.slice(-3).map(w => w.weight)
    const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a: number, b: number) => a + b, 0) / older.length
    if (recentAvg < olderAvg - 1) weightTrend = 'losing'
    else if (recentAvg > olderAvg + 1) weightTrend = 'gaining'
  }

  // Today's nutrition
  const todayFoodData = todayFood.data || []
  const todayCal = todayFoodData.reduce((s, f) => s + (f.calories || 0), 0)
  const todayP = todayFoodData.reduce((s, f) => s + (f.protein || 0), 0)
  const todayC = todayFoodData.reduce((s, f) => s + (f.carbs || 0), 0)
  const todayF = todayFoodData.reduce((s, f) => s + (f.fat || 0), 0)
  const todayWaterOz = (todayWater.data || []).reduce((s, w) => s + w.amount_oz, 0)

  // Weekly averages
  const weekFoodData = recentFood.data || []
  const foodDays = new Set(weekFoodData.map(f => f.logged_at.split('T')[0])).size || 1
  const weekAvgCal = Math.round(weekFoodData.reduce((s, f) => s + (f.calories || 0), 0) / foodDays)
  const weekAvgP = Math.round(weekFoodData.reduce((s, f) => s + (f.protein || 0), 0) / foodDays)
  const weekWaterData = weekWater.data || []
  const waterDays = new Set(weekWaterData.map(w => w.logged_at.split('T')[0])).size || 1
  const weekAvgWater = Math.round(weekWaterData.reduce((s, w) => s + w.amount_oz, 0) / waterDays)

  // Protein hit rate
  const dailyProtein: Record<string, number> = {}
  weekFoodData.forEach(f => {
    const day = f.logged_at.split('T')[0]
    dailyProtein[day] = (dailyProtein[day] || 0) + (f.protein || 0)
  })
  const proteinHitDays = proteinTarget ? Object.values(dailyProtein).filter(p => p >= proteinTarget).length : 0

  // Common foods
  const foodCounts: Record<string, number> = {}
  weekFoodData.forEach(f => { foodCounts[f.food_name] = (foodCounts[f.food_name] || 0) + 1 })
  const topFoods = Object.entries(foodCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => `${name} (${count}x)`)

  // Side effect patterns
  const symptomCounts: Record<string, number> = {}
  const sideEffectData = sideEffects.data || []
  sideEffectData.forEach(s => { symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1 })
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => `${s} (${c}x)`)

  // Mood/energy averages
  const checkinData = checkins.data || []
  const avgMood = checkinData.length > 0 ? Math.round(checkinData.reduce((s, c) => s + c.mood, 0) / checkinData.length * 10) / 10 : null
  const avgEnergy = checkinData.length > 0 ? Math.round(checkinData.reduce((s, c) => s + c.energy, 0) / checkinData.length * 10) / 10 : null
  const latestMood = checkinData[0] || null

  // Injection tracking
  const medData = meds.data || []
  const lastInjection = medData[0] || null
  const daysSinceInjection = lastInjection ? Math.floor((now.getTime() - new Date(lastInjection.logged_at).getTime()) / 86400000) : null
  const daysUntilInjection = daysSinceInjection !== null ? Math.max(0, 7 - daysSinceInjection) : null

  // Exercise this week
  const exerciseData = exercises.data || []
  const weekExercises = exerciseData.filter(e => new Date(e.logged_at) >= weekAgo)

  // Days on medication
  const daysOnMed = p.start_date ? Math.max(1, Math.floor((now.getTime() - new Date(p.start_date).getTime()) / 86400000)) : null

  // Tapering context
  const tp = taperPlan.data
  const tc = taperCheckins.data || []

  return `
═══ USER PROFILE ═══
Name: ${p.name}
Medication: ${p.medication} at ${p.dose}
Injection frequency: ${p.injection_frequency || 'weekly'}
Days on medication: ${daysOnMed || 'unknown'}
Start weight: ${startWeight || 'unknown'} lbs
Current weight: ${latestWeight || 'unknown'} lbs
Goal weight: ${goalWeight || 'unknown'} lbs
Total lost: ${totalLost !== null ? `${totalLost} lbs` : 'unknown'}
Remaining to goal: ${toGoal !== null ? `${toGoal} lbs` : 'unknown'}
Weight trend (2 weeks): ${weightTrend}
Protein target: ${proteinTarget || 'unknown'}g/day

═══ TODAY (${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}) ═══
Meals logged: ${todayFoodData.length} items
${todayFoodData.length > 0 ? `Foods: ${todayFoodData.map(f => `${f.food_name} (${f.calories}cal, ${f.protein}gP)`).join(', ')}` : 'No food logged yet'}
Calories: ${todayCal} | Protein: ${todayP}g${proteinTarget ? `/${proteinTarget}g (${Math.round(todayP / proteinTarget * 100)}%)` : ''} | Carbs: ${todayC}g | Fat: ${todayF}g
Water: ${todayWaterOz}/80 oz (${Math.round(todayWaterOz / 80 * 100)}%)
${proteinTarget && todayP < proteinTarget ? `Protein remaining today: ${proteinTarget - todayP}g` : ''}

═══ WEEKLY AVERAGES ═══
Avg daily calories: ${weekAvgCal}
Avg daily protein: ${weekAvgP}g${proteinTarget ? ` (target: ${proteinTarget}g)` : ''}
Protein target hit: ${proteinHitDays}/${foodDays} days
Avg daily water: ${weekAvgWater}oz
Workouts this week: ${weekExercises.length}${weekExercises.length > 0 ? ` — ${weekExercises.map(e => `${e.exercise_type} ${e.duration_minutes}min`).join(', ')}` : ''}

═══ COMMON FOODS THIS WEEK ═══
${topFoods.length > 0 ? topFoods.join(', ') : 'Not enough data yet'}

═══ WEIGHT HISTORY (last 14 entries) ═══
${weightData.length > 0 ? weightData.map(w => `${new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${w.weight} lbs`).join(' | ') : 'No weight entries yet'}

═══ INJECTION HISTORY ═══
Last injection: ${lastInjection ? `${lastInjection.injection_site} on ${new Date(lastInjection.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${daysSinceInjection}d ago)` : 'None logged'}
Next injection: ${daysUntilInjection !== null ? daysUntilInjection === 0 ? 'TODAY' : `in ${daysUntilInjection} days` : 'unknown'}
Recent sites: ${medData.slice(0, 4).map(m => m.injection_site).filter(Boolean).join(' → ') || 'none'}

═══ SIDE EFFECTS ═══
${topSymptoms.length > 0 ? `Most common: ${topSymptoms.join(', ')}` : 'None reported'}
${sideEffectData.length > 0 ? `Recent: ${sideEffectData.slice(0, 3).map(s => `${s.symptom} (${s.severity}/5) on ${new Date(s.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`).join(', ')}` : ''}

═══ MOOD & ENERGY ═══
${avgMood !== null ? `Avg mood: ${avgMood}/5 | Avg energy: ${avgEnergy}/5` : 'No check-ins yet'}
${latestMood ? `Latest: mood ${latestMood.mood}/5, energy ${latestMood.energy}/5${latestMood.notes ? ` — "${latestMood.notes}"` : ''}` : ''}

═══ EXERCISE (last 10) ═══
${exerciseData.length > 0 ? exerciseData.map(e => `${e.exercise_type} ${e.duration_minutes}min (${new Date(e.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`).join(', ') : 'No exercise logged'}

═══ TAPERING STATUS ═══
${tp ? `Phase: ${tp.phase} | Readiness: ${tp.readiness_score ?? 'not assessed'}% | Stability streak: ${tp.stability_streak_days} days` : 'Not exploring tapering yet'}
${tc.length > 0 ? `Latest tapering check-in: hunger ${tc[0].hunger}/5, cravings ${tc[0].cravings}/5, confidence ${tc[0].confidence}/5` : ''}
`.trim()
}

export async function POST(req: NextRequest) {
  const { messages, userId } = await req.json()
  if (!userId || !messages?.length) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  // Pull all user context
  const context = await getUserContext(userId)
  if (!context) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const systemPrompt = `You are Nova, the AI health coach inside NovuraHealth — a GLP-1 medication companion app. You have deep access to the user's personal health data and use it proactively to give highly specific, actionable coaching.

${context}

═══ YOUR COACHING APPROACH ═══

1. DATA-DRIVEN: Always reference their actual numbers. Don't say "try to eat more protein" — say "You're at 42g protein today, ${context.includes('Protein remaining') ? 'need about 50g more' : 'keep pushing'}. A chicken breast would get you to 70g."

2. PATTERN RECOGNITION: Spot trends they might miss.
   - "Your nausea entries spike on injection days — try injecting at night instead of morning"
   - "You've averaged 1,400 cal this week vs 1,800 last week — appetite suppression is kicking in, but watch your protein"
   - "You've skipped exercise the last 4 days — even a 15-min walk helps"

3. PROACTIVE ALERTS (mention these naturally when relevant):
   - If protein is under 50% of target: flag it
   - If water is under 40oz today: nudge them
   - If weight is trending up for 5+ days: address it directly
   - If injection is due today/tomorrow: remind them
   - If they haven't logged food today: ask about it
   - If mood/energy is declining over 3+ check-ins: check in on them

4. PERSONALIZED SUGGESTIONS:
   - Base meal suggestions on foods they ACTUALLY eat (reference their common foods)
   - Adjust advice based on their specific medication and dose
   - Factor in their exercise habits and level
   - Consider their reported side effects when suggesting foods

5. TONE:
   - Talk like a real person texting. Short sentences. No fluff.
   - 1-3 sentences for simple questions. 4-5 max for complex ones.
   - NEVER use bullet points, numbered lists, or markdown formatting
   - NEVER use ** bold **, headers, or structured formatting
   - NO emojis unless the user uses them first
   - NO exclamation marks more than once per message
   - Don't say "Great question!" or "Absolutely!" or "I'd love to help!"
   - Don't say "Here's what I recommend:" — just say it
   - Write like you're texting a friend, not writing a blog post
   - Use contractions (you're, don't, can't, it's)
   - Be direct. "You need 48g more protein. Chicken and a yogurt would do it." Not "I'd suggest considering incorporating a lean protein source such as chicken breast alongside a dairy option like Greek yogurt to help you reach your daily protein goals!"

6. CLINICAL KNOWLEDGE:
   - GLP-1 medications: mechanisms, side effects, interactions, tapering
   - Protein: 0.8g per lb of goal weight is the target
   - Water: 80oz/day minimum, more important on GLP-1s due to GI effects
   - Common side effects and evidence-based management strategies
   - Never diagnose or prescribe — always defer to their doctor for medical decisions
   - When discussing side effects, suggest management strategies AND recommend discussing with provider if severe

7. MEAL PLANNING & RECIPES:
   - If the user asks for a meal plan, create a personalized daily or weekly plan based on their protein target, calorie needs, medication side effects, and food preferences from their food_logs
   - Base protein targets on their profile data. If they have a custom protein_target_g, use that. Otherwise calculate from their goal_weight using 1.2-1.6 g/kg/day
   - Prioritize protein-dense, GLP-1 friendly foods (easy on the stomach, smaller portions, high protein per calorie)
   - If they ask for a recipe, give the full recipe with ingredients and steps. Keep it concise — not a cooking blog post. Format as:
     [Recipe name]
     [Protein/calories per serving]
     Ingredients: list them
     Steps: numbered, brief
   - Adjust meal plans for common GLP-1 issues: low appetite days (liquid/soft options), nausea days (bland/cool foods), high energy days (more substantial meals)
   - If asked 'what should I eat', reference their recent food_logs to avoid repetition and suggest something they haven't had recently

8. WHAT NOT TO DO:
   - Never give a generic response when you have their data
   - Never say "I don't have access to your data" — you do
   - Never be preachy or lecture-y about healthy habits
   - Don't repeat the same advice — vary your suggestions
   - Don't over-celebrate trivial things`

  try {
    console.log('CHAT ENV CHECK:', {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 10),
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: messages.slice(-20),
      }),
    })

    console.log('ANTHROPIC RESPONSE STATUS:', res.status)
    if (!res.ok) {
      const errorBody = await res.text()
      console.error('ANTHROPIC ERROR:', errorBody)
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }

    const result = await res.json()
    const reply = result.content?.[0]?.text
    if (!reply) {
      console.error('ANTHROPIC EMPTY REPLY:', JSON.stringify(result))
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }
    return NextResponse.json({ message: reply })
  } catch (error) {
    console.error('CHAT ROUTE ERROR:', error)
    return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
  }
}
