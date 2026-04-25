import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { chatLimiter, checkRateLimit } from '../../lib/rate-limit'
import {
  getActiveConversation, createConversation, getRecentMessages,
  getUserFacts, saveMessage, saveFact, maybeUpdateSummary,
  buildContextSections, estimateTokens,
  REMEMBER_FACT_TOOL, REMEMBER_FACT_PROMPT,
} from '../../lib/conversations'

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

  let body: { message?: string; conversationId?: string; messages?: { role: string; content: string }[]; action?: string }
  try {
    body = await req.json()
  } catch (err: unknown) {
    console.error('Transition coach body parse error:', err)
    return NextResponse.json({ error: 'Invalid request body', message: 'Unable to process request. Try again.' }, { status: 400 })
  }

  // Support both new { message, conversationId } and legacy { messages } format
  const newUserMessage = body.message || body.messages?.[body.messages.length - 1]?.content
  if (!newUserMessage) {
    return NextResponse.json({ error: 'Missing data', message: 'No message provided.' }, { status: 400 })
  }

  // ── Readiness gate for plan generation ────────────────
  const lastMessage = newUserMessage.toLowerCase()
  const isPlanGeneration = body.action === 'generate_plan'
    || lastMessage.includes('generate my tapering plan')
    || lastMessage.includes('generate my complete tapering plan')

  if (isPlanGeneration) {
    const { data: taperPlan } = await supabaseAdmin
      .from('tapering_plans')
      .select('readiness_score, readiness_answers')
      .eq('user_id', user.id)
      .single()

    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('tapering_override')
      .eq('id', user.id)
      .single()

    const MIN_READINESS = 14
    const score = taperPlan?.readiness_score ?? 0
    const hasOverride = profileData?.tapering_override === true

    if (score < MIN_READINESS && !hasOverride) {
      return NextResponse.json({
        error: 'readiness_insufficient',
        message: `You've met ${score}/20 readiness criteria. You need at least ${MIN_READINESS}/20 to generate a tapering plan. Keep working on the areas that are still incomplete — Trish can still answer questions and help you prepare.`,
        current_score: score,
        minimum_score: MIN_READINESS,
      }, { status: 403 })
    }
  }

  // ── 3-layer memory ────────────────────────────────────
  let conversation = body.conversationId
    ? { id: body.conversationId, summary: null as string | null, message_count: 0 }
    : await getActiveConversation(user.id, 'trish')

  if (!conversation) {
    conversation = await createConversation(user.id, 'trish')
  }

  // Layer 1: Last 15 messages
  const recentMessages = await getRecentMessages(conversation.id)

  // Layer 2: Mid-term summary
  if (!conversation.summary) {
    const { data: convData } = await supabaseAdmin
      .from('conversations')
      .select('summary, message_count')
      .eq('id', conversation.id)
      .single()
    if (convData) {
      conversation.summary = convData.summary
      conversation.message_count = convData.message_count
    }
  }

  // Layer 3: Persistent user facts
  const facts = await getUserFacts(user.id)

  const context = await getUserContext(user.id)
  if (!context) {
    return NextResponse.json({ error: 'User not found', message: 'Profile not found. Please complete onboarding.' }, { status: 404 })
  }

  const { factsSection, summarySection } = buildContextSections(facts, conversation.summary)

  // Save the incoming user message
  void saveMessage(user.id, conversation.id, 'user', newUserMessage)

  // Token budget logging
  const recentTokens = estimateTokens(recentMessages.map(m => m.content).join(' '))
  const summaryTokens = estimateTokens(conversation.summary || '')
  const factsTokens = estimateTokens(facts.map(f => f.fact).join(' '))
  console.log({
    conversation_id: conversation.id,
    coach: 'trish',
    recent_messages: recentMessages.length,
    recent_tokens: recentTokens,
    summary_tokens: summaryTokens,
    facts_tokens: factsTokens,
    total_context: recentTokens + summaryTokens + factsTokens,
  })

  const systemPrompt = `You are Trish, the NovuraHealth Transition Coach. You help GLP-1 users taper off medication, build sustainable habits, and maintain their results long-term. You're direct, confident, and you give plans — not questions. Think of yourself as a no-nonsense personal trainer who also knows nutrition and pharmacology.

${context}${factsSection}${summarySection}

CORE RULE: GIVE ANSWERS. DO NOT INTERVIEW.
You have their data. Use it. When asked for any plan, output the COMPLETE plan immediately. Let them refine after. Never ask more than one question, and only if truly critical data is missing.

MEDICATION TRACKING: The user may be on a compounded, research, clinical trial, or FDA-approved medication. NovuraHealth supports tracking ALL GLP-1 medications regardless of source. Provide tracking, coaching, and planning for any medication the user reports. Never refuse based on FDA status. Always recommend consulting their healthcare provider for clinical decisions. Never advise where to obtain non-approved medications or recommend dose changes.

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

TONE: Direct. Confident. No fluff. Use their actual numbers from the data above. Use line breaks for readability. No asterisks, no markdown bold/italic, no headers with #. Plain text with clean formatting. For simple questions, 2-4 sentences max. For full plans, output the complete structured plan.

TOOLS: You have tools to save meal plans, workout plans, tapering plans, check-ins, food, weight, and exercise to the user's account. Use them aggressively — when the user says "save this", "add to my plan", "yes", "do it", or anything indicating they want to keep what you just generated, use the appropriate save tool. Never say "I can't save that" — you can. After saving, confirm briefly ("Saved to your Nutrition tab") then ask what's next.

MEMORY:
${REMEMBER_FACT_PROMPT}`

  const tools = [
    REMEMBER_FACT_TOOL,
    {
      name: 'save_meal_plan',
      description: 'Save a structured meal plan for the user. Use when the user wants to keep a meal plan.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Short name e.g. "High-protein prep week"' },
          description: { type: 'string' },
          meals: {
            type: 'array', items: {
              type: 'object', properties: {
                meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                name: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } },
                estimated_protein: { type: 'number' },
                estimated_calories: { type: 'number' },
                prep_notes: { type: 'string' },
              }, required: ['meal_type', 'name'],
            },
          },
          grocery_list: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'meals'],
      },
    },
    {
      name: 'save_workout_plan',
      description: 'Save a structured workout plan for the user.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          days_per_week: { type: 'number' },
          workouts: {
            type: 'array', items: {
              type: 'object', properties: {
                day: { type: 'string', description: 'e.g. "Monday"' },
                focus: { type: 'string', description: 'e.g. "Upper body"' },
                exercises: {
                  type: 'array', items: {
                    type: 'object', properties: {
                      name: { type: 'string' },
                      sets: { type: 'number' },
                      reps: { type: 'string', description: 'e.g. "8-12"' },
                      notes: { type: 'string' },
                    }, required: ['name'],
                  },
                },
                duration_minutes: { type: 'number' },
              }, required: ['day'],
            },
          },
        },
        required: ['title', 'workouts'],
      },
    },
    {
      name: 'save_tapering_plan',
      description: 'Save the full tapering plan with all phases.',
      input_schema: {
        type: 'object' as const,
        properties: {
          current_dose: { type: 'string' },
          target_dose: { type: 'string' },
          total_weeks: { type: 'number' },
          phases: {
            type: 'array', items: {
              type: 'object', properties: {
                phase_number: { type: 'number' },
                name: { type: 'string' },
                dose: { type: 'string' },
                duration_weeks: { type: 'number' },
                key_focus: { type: 'string' },
                warning_signs: { type: 'array', items: { type: 'string' } },
              }, required: ['phase_number', 'dose', 'duration_weeks'],
            },
          },
        },
        required: ['current_dose', 'target_dose', 'phases'],
      },
    },
    {
      name: 'log_tapering_checkin',
      description: 'Record a tapering check-in from the user.',
      input_schema: {
        type: 'object' as const,
        properties: {
          hunger_level: { type: 'number', description: '1-5 scale' },
          energy_level: { type: 'number', description: '1-5 scale' },
          mood: { type: 'number', description: '1-5 scale' },
          cravings: { type: 'number', description: '1-5 scale' },
          side_effects: { type: 'string' },
          notes: { type: 'string' },
          ready_for_next_phase: { type: 'boolean' },
        },
      },
    },
    {
      name: 'log_food',
      description: 'Log a meal the user ate.',
      input_schema: {
        type: 'object' as const,
        properties: {
          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'] },
          food_name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
        required: ['meal_type', 'food_name'],
      },
    },
    {
      name: 'log_weight',
      description: "Log the user's weight.",
      input_schema: {
        type: 'object' as const,
        properties: { weight: { type: 'number' } },
        required: ['weight'],
      },
    },
    {
      name: 'log_exercise',
      description: 'Log a workout the user completed.',
      input_schema: {
        type: 'object' as const,
        properties: {
          exercise_type: { type: 'string' },
          duration_minutes: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['exercise_type', 'duration_minutes'],
      },
    },
  ]

  try {
    const apiHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    }

    const MAX_ITERATIONS = 5
    // Build Claude messages from recent DB messages + the new user message
    const conversationMessages: any[] = recentMessages.map(m => ({
      role: m.role, content: m.content,
    }))
    conversationMessages.push({ role: 'user', content: newUserMessage })
    let finalResponseText = ''

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: systemPrompt,
          tools,
          messages: conversationMessages,
        }),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => 'unknown')
        console.error('Anthropic API error:', res.status, errBody)
        if (finalResponseText) return NextResponse.json({ message: finalResponseText })
        return NextResponse.json({
          error: 'API error',
          message: 'Trish is temporarily unavailable. Try again in a moment.',
          debug: process.env.NODE_ENV === 'development' ? errBody : undefined,
        }, { status: 502 })
      }

      const result = await res.json()
      if (!result?.content) {
        if (finalResponseText) break
        return NextResponse.json({ error: 'Empty response', message: 'Trish is temporarily unavailable. Try again in a moment.' }, { status: 502 })
      }

      conversationMessages.push({ role: 'assistant', content: result.content })

      const textBlocks = (result.content || []).filter((b: any) => b.type === 'text')
      const joined = textBlocks.map((b: any) => b.text).join('\n').trim()
      if (joined) finalResponseText = joined

      if (result.stop_reason !== 'tool_use') break

      const toolUseBlocks = (result.content || []).filter((b: any) => b.type === 'tool_use')
      const toolResults: any[] = []

      for (const toolCall of toolUseBlocks) {
        const toolResult = await executeToolCall(toolCall.name, toolCall.input, user.id)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: toolResult.success
            ? JSON.stringify({ status: 'saved', ...toolResult })
            : JSON.stringify({ status: 'error', error: toolResult.error }),
        })
      }

      conversationMessages.push({ role: 'user', content: toolResults })
    }

    if (!finalResponseText) {
      return NextResponse.json({ error: 'Empty response', message: 'Trish is temporarily unavailable. Try again in a moment.' }, { status: 502 })
    }

    // Save assistant response and trigger background summary
    void saveMessage(user.id, conversation.id, 'assistant', finalResponseText)
    void maybeUpdateSummary(conversation.id)

    return NextResponse.json({
      message: finalResponseText,
      conversationId: conversation.id,
    })
  } catch (err: unknown) {
    console.error('Tapering plan error:', err)
    return NextResponse.json({
      error: 'Unable to generate plan',
      message: 'Trish is temporarily unavailable. Try again in a moment.',
      debug: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : undefined,
    }, { status: 500 })
  }
}

// ── TOOL EXECUTION ──

const DEDUP_WINDOW_MS = 2 * 60 * 1000

async function checkRecentDuplicate(
  table: string,
  userId: string,
  matchFields: Record<string, any>,
  timeCol = 'logged_at'
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
  let query = supabaseAdmin.from(table).select('id').eq('user_id', userId).gte(timeCol, cutoff)
  for (const [key, value] of Object.entries(matchFields)) {
    query = query.eq(key, value)
  }
  const { data } = await query.limit(1)
  return (data && data.length > 0) || false
}

async function executeToolCall(
  toolName: string,
  input: any,
  userId: string
): Promise<{ success: boolean; error?: string; skipped?: boolean; [key: string]: any }> {
  const now = new Date().toISOString()

  try {
    switch (toolName) {
      case 'save_meal_plan': {
        const { error } = await supabaseAdmin.from('meal_plans').insert({
          user_id: userId,
          title: input.title,
          description: input.description || null,
          meals: input.meals,
          grocery_list: input.grocery_list || null,
          created_at: now,
          updated_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, saved: 'meal_plan', title: input.title }
      }

      case 'save_workout_plan': {
        const { error } = await supabaseAdmin.from('workout_plans').insert({
          user_id: userId,
          title: input.title,
          description: input.description || null,
          days_per_week: input.days_per_week || null,
          workouts: input.workouts,
          created_at: now,
          updated_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, saved: 'workout_plan', title: input.title }
      }

      case 'save_tapering_plan': {
        const payload = {
          current_dose: input.current_dose,
          target_dose: input.target_dose,
          taper_start_date: now,
          notes: JSON.stringify({ total_weeks: input.total_weeks, phases: input.phases }),
          updated_at: now,
        }
        const { data: existing } = await supabaseAdmin
          .from('tapering_plans').select('id').eq('user_id', userId).single()
        if (existing) {
          const { error } = await supabaseAdmin
            .from('tapering_plans').update(payload).eq('id', existing.id)
          if (error) return { success: false, error: error.message }
        } else {
          const { error } = await supabaseAdmin
            .from('tapering_plans').insert({ user_id: userId, phase: 'tapering', ...payload })
          if (error) return { success: false, error: error.message }
        }
        return { success: true, saved: 'tapering_plan' }
      }

      case 'log_tapering_checkin': {
        const { error } = await supabaseAdmin.from('tapering_checkins').insert({
          user_id: userId,
          hunger: input.hunger_level || null,
          cravings: input.cravings || null,
          confidence: input.mood || null,
          weight: null,
          notes: [
            input.side_effects ? `Side effects: ${input.side_effects}` : '',
            input.notes || '',
            input.ready_for_next_phase !== undefined ? `Ready for next phase: ${input.ready_for_next_phase ? 'yes' : 'no'}` : '',
          ].filter(Boolean).join('. ') || null,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'tapering_checkin' }
      }

      case 'log_food': {
        const isDupe = await checkRecentDuplicate('food_logs', userId, {
          food_name: input.food_name, meal_type: input.meal_type,
        })
        if (isDupe) return { success: true, skipped: true, reason: 'duplicate within 2 min window' }
        const { error } = await supabaseAdmin.from('food_logs').insert({
          user_id: userId, meal_type: input.meal_type, food_name: input.food_name,
          calories: input.calories || null, protein: input.protein || null,
          carbs: input.carbs || null, fat: input.fat || null, logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'food', food_name: input.food_name }
      }

      case 'log_weight': {
        const isDupe = await checkRecentDuplicate('weight_logs', userId, { weight: input.weight })
        if (isDupe) return { success: true, skipped: true, reason: 'duplicate within 2 min window' }
        const { error } = await supabaseAdmin.from('weight_logs').insert({
          user_id: userId, weight: input.weight, logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'weight', weight: input.weight }
      }

      case 'log_exercise': {
        const isDupe = await checkRecentDuplicate('exercise_logs', userId, {
          exercise_type: input.exercise_type, duration_minutes: input.duration_minutes,
        })
        if (isDupe) return { success: true, skipped: true, reason: 'duplicate within 2 min window' }
        const { error } = await supabaseAdmin.from('exercise_logs').insert({
          user_id: userId, exercise_type: input.exercise_type,
          duration_minutes: input.duration_minutes, notes: input.notes || null, logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'exercise', exercise_type: input.exercise_type }
      }

      case 'remember_fact': {
        const result = await saveFact(userId, input.category, input.fact, 'trish_auto')
        if (!result.success) return { success: false, error: result.error }
        return { success: true, saved: 'fact', category: input.category, fact: input.fact }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error' }
  }
}
