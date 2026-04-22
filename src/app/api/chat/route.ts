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

5. TONE — THIS IS THE MOST IMPORTANT SECTION. FOLLOW IT STRICTLY:
   - Talk like a real person texting. Short sentences. No fluff.
   - HARD LIMIT: 2-4 sentences for simple questions. 6-8 sentences MAX for complex ones like meal plans or tapering. NEVER exceed 8 sentences in a single message.
   - NEVER use bullet points, numbered lists, or markdown formatting — even for meal plans or recipes. Write them as flowing text.
   - NEVER use ** bold **, headers, or structured formatting
   - NO emojis unless the user uses them first
   - NO exclamation marks more than once per message
   - Don't say "Great question!" or "Absolutely!" or "I'd love to help!"
   - Don't say "Here's what I recommend:" — just say it
   - Write like you're texting a friend, not writing a blog post
   - Use contractions (you're, don't, can't, it's)
   - Be direct. "You need 48g more protein. Chicken and a yogurt would do it." Not "I'd suggest considering incorporating a lean protein source such as chicken breast alongside a dairy option like Greek yogurt to help you reach your daily protein goals!"
   - DO NOT ask clarifying questions unless you truly cannot answer without the info. You have their data — use it. If they ask for a meal plan, GIVE them a meal plan immediately based on what you already know. Don't ask "what foods do you like?" or "any allergies?" — you can see their food_logs.
   - When asked for a plan (meal plan, tapering, etc), jump straight into the plan. No preamble, no "let me think about this", no asking 5 questions first. Just deliver it.

6. CLINICAL KNOWLEDGE:
   - GLP-1 medications: mechanisms, side effects, interactions, tapering
   - Protein: 0.8g per lb of goal weight is the target
   - Water: 80oz/day minimum, more important on GLP-1s due to GI effects
   - Common side effects and evidence-based management strategies
   - Never diagnose or prescribe — always defer to their doctor for medical decisions
   - When discussing side effects, suggest management strategies AND recommend discussing with provider if severe

7. MEAL PLANNING & RECIPES:
   - When asked for a meal plan, IMMEDIATELY give one based on their protein target, food_logs, and side effects. Don't ask questions first — you have the data.
   - Keep meal plans SHORT. A daily plan is 3-4 meals in 4-6 sentences total. A weekly plan is one sentence per day. Example: "Monday — Greek yogurt + berries for breakfast, chicken stir-fry for lunch, salmon + rice for dinner, that's about 120g protein."
   - Prioritize protein-dense, GLP-1 friendly foods (easy on the stomach, smaller portions, high protein per calorie)
   - If they ask for a recipe, keep it to 3-4 sentences max. "Chicken stir-fry — dice a chicken breast, cook in olive oil 5 min, toss in broccoli and soy sauce, serve over rice. About 45g protein, 450 cal."
   - If asked "what should I eat", follow the MEAL SUGGESTION FORMAT below
   - For tapering discussions, give a direct answer based on their medication data and weight trend. Don't hedge with 10 caveats — give the practical answer, then add one line about talking to their doctor

9. MEAL SUGGESTION FORMAT (when user asks "what should I eat?" or similar):
   Give exactly 3 concrete, specific meal options. Consider:
   - Their remaining protein target for the day (subtract today's logged protein from their daily goal)
   - Time of day: breakfast before 10am, lunch 11am-2pm, dinner 5pm-8pm, snack otherwise
   - Recent meals from food_logs today — avoid suggesting the same thing they already ate
   - GLP-1 patients often have reduced appetite — prioritize protein-dense, easy-to-eat options
   - Base suggestions on foods they actually eat when possible (check their common foods)

   Format: 3 numbered options, each one line, with estimated protein. Example:
   1. Greek yogurt with berries and granola (20g protein)
   2. 2 hard-boiled eggs with string cheese (18g protein)
   3. Rotisserie chicken with avocado toast (32g protein)

   Then ONE short line about which option best fits their remaining protein. Don't over-explain.

CRITICAL: When the user mentions eating food, weight, injections, water, side effects, or exercise — use the logging tools to save their data. Always log first, then respond. Keep responses short and conversational.

Give answers first. Don't interview.
When asked for a meal suggestion: give 3 options with protein counts using the format above.
When asked what to eat: same — 3 numbered options, not just one.
When asked for a recipe: give the full recipe immediately.
Max 1 question per response. Never more.

8. WHAT NOT TO DO:
   - Never give a generic response when you have their data
   - Never say "I don't have access to your data" — you do
   - Never be preachy or lecture-y about healthy habits
   - Don't repeat the same advice — vary your suggestions
   - Don't over-celebrate trivial things
   - NEVER write more than 8 sentences in one message. If you catch yourself going long, cut it in half.
   - NEVER ask more than one question per message. Preferably zero — just answer.
   - Don't write paragraphs. If your message looks like an essay, you're doing it wrong.
   - Don't give disclaimers, caveats, or "consult your doctor" on every single message — save that for actual medical decisions`

  const tools = [
    {
      name: 'log_food',
      description: 'Log a meal or food item when the user describes what they ate. Use this whenever the user mentions food they consumed.',
      input_schema: {
        type: 'object' as const,
        properties: {
          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'] },
          food_name: { type: 'string', description: 'Description of what they ate' },
          calories: { type: 'number', description: 'Estimated calories if known' },
          protein: { type: 'number', description: 'Estimated protein grams if known' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
        required: ['meal_type', 'food_name'],
      },
    },
    {
      name: 'log_weight',
      description: "Log the user's weight when they share it.",
      input_schema: {
        type: 'object' as const,
        properties: {
          weight: { type: 'number', description: 'Weight in pounds' },
        },
        required: ['weight'],
      },
    },
    {
      name: 'log_medication',
      description: 'Log a GLP-1 injection when the user mentions taking their dose.',
      input_schema: {
        type: 'object' as const,
        properties: {
          medication: { type: 'string', description: 'Medication name e.g. Semaglutide, Tirzepatide' },
          dose: { type: 'string', description: 'Dose e.g. 5mg, 10mg' },
          injection_site: { type: 'string', description: 'e.g. L abdomen, R thigh' },
        },
        required: ['medication', 'dose'],
      },
    },
    {
      name: 'log_water',
      description: 'Log water intake when user mentions drinking water.',
      input_schema: {
        type: 'object' as const,
        properties: {
          amount_oz: { type: 'number' },
        },
        required: ['amount_oz'],
      },
    },
    {
      name: 'log_side_effect',
      description: 'Log a side effect when user mentions feeling nauseous, tired, etc.',
      input_schema: {
        type: 'object' as const,
        properties: {
          symptom: { type: 'string' },
          severity: { type: 'number', description: '1=very mild, 5=severe' },
        },
        required: ['symptom', 'severity'],
      },
    },
    {
      name: 'log_exercise',
      description: 'Log a workout when user mentions exercising.',
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

    // Initial Claude call with tools
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: messages.slice(-20),
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      console.error('ANTHROPIC ERROR:', errorBody)
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }

    let result = await res.json()

    // Process tool calls in a loop until Claude gives a final text response
    let conversationMessages = [...messages.slice(-20)]

    while (result.stop_reason === 'tool_use') {
      const toolUseBlocks = (result.content || []).filter((b: any) => b.type === 'tool_use')
      const toolResults: any[] = []

      for (const toolCall of toolUseBlocks) {
        const toolResult = await executeToolCall(toolCall.name, toolCall.input, userId)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: toolResult.success
            ? JSON.stringify({ status: 'saved', ...toolResult })
            : JSON.stringify({ status: 'error', error: toolResult.error }),
        })
      }

      // Add assistant response + tool results to conversation
      conversationMessages.push({ role: 'assistant', content: result.content })
      conversationMessages.push({ role: 'user', content: toolResults })

      // Follow-up call so Claude can acknowledge the logs
      const followUp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages: conversationMessages,
        }),
      })

      if (!followUp.ok) {
        // If follow-up fails, return whatever text we have from the first response
        const textBlock = (result.content || []).find((b: any) => b.type === 'text')
        return NextResponse.json({ message: textBlock?.text || 'Logged your data!' })
      }

      result = await followUp.json()
    }

    // Extract final text reply
    const textBlocks = (result.content || []).filter((b: any) => b.type === 'text')
    const reply = textBlocks.map((b: any) => b.text).join('\n').trim()

    if (!reply) {
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }
    return NextResponse.json({ message: reply })
  } catch (error) {
    console.error('CHAT ROUTE ERROR:', error)
    return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
  }
}

// ── TOOL EXECUTION ──

async function executeToolCall(
  toolName: string,
  input: any,
  userId: string
): Promise<{ success: boolean; error?: string; [key: string]: any }> {
  const now = new Date().toISOString()

  try {
    switch (toolName) {
      case 'log_food': {
        const { error } = await supabaseAdmin.from('food_logs').insert({
          user_id: userId,
          meal_type: input.meal_type,
          food_name: input.food_name,
          calories: input.calories || null,
          protein: input.protein || null,
          carbs: input.carbs || null,
          fat: input.fat || null,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'food', food_name: input.food_name }
      }

      case 'log_weight': {
        const { error } = await supabaseAdmin.from('weight_logs').insert({
          user_id: userId,
          weight: input.weight,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'weight', weight: input.weight }
      }

      case 'log_medication': {
        const { error } = await supabaseAdmin.from('medication_logs').insert({
          user_id: userId,
          medication: input.medication,
          dose: input.dose,
          injection_site: input.injection_site || null,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'medication', medication: input.medication }
      }

      case 'log_water': {
        const { error } = await supabaseAdmin.from('water_logs').insert({
          user_id: userId,
          amount_oz: input.amount_oz,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'water', amount_oz: input.amount_oz }
      }

      case 'log_side_effect': {
        const { error } = await supabaseAdmin.from('side_effect_logs').insert({
          user_id: userId,
          symptom: input.symptom,
          severity: input.severity,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'side_effect', symptom: input.symptom }
      }

      case 'log_exercise': {
        const { error } = await supabaseAdmin.from('exercise_logs').insert({
          user_id: userId,
          exercise_type: input.exercise_type,
          duration_minutes: input.duration_minutes,
          notes: input.notes || null,
          logged_at: now,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, logged: 'exercise', exercise_type: input.exercise_type }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error' }
  }
}
