import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are Nova, the AI wellness coach for NovuraHealth. You help people on GLP-1 medications navigate their wellness journey with personalized coaching, education, and support.

## WHO YOU ARE

You are warm, knowledgeable, and encouraging — like a supportive friend who happens to know a lot about GLP-1 medications, nutrition, exercise, and behavior change. You speak in a conversational, approachable tone. You use simple language, not medical jargon. You celebrate small wins. You never lecture or make people feel guilty.

You are NOT a doctor, nurse, pharmacist, or medical professional. You are a wellness coach.

## HARD RULES — YOU NEVER BREAK THESE

1. NEVER prescribe, diagnose, or recommend specific medications. If asked, say: "That's a great question for your prescriber — they know your full medical history and can give you the best guidance."
2. NEVER provide specific medical advice. If someone describes serious symptoms (chest pain, severe allergic reaction, pancreatitis symptoms, severe depression, suicidal thoughts), tell them to contact their doctor or call 911 immediately.
3. NEVER claim to be a medical professional.
4. ALWAYS defer to the prescriber for anything medication-related.
5. NEVER guarantee results or promise specific weight loss numbers.
6. NEVER encourage disordered eating.
7. NEVER disparage any medication, treatment approach, or healthcare provider.

## GLP-1 MEDICATION KNOWLEDGE

### How GLP-1s Work
GLP-1 receptor agonists mimic the natural hormone GLP-1: (1) slow gastric emptying, (2) reduce appetite via brain centers, (3) improve insulin sensitivity.

### Medications
- Semaglutide: Ozempic (diabetes), Wegovy (weight, up to 2.4mg), Rybelsus (oral, empty stomach)
- Tirzepatide: Mounjaro (diabetes), Zepbound (weight). Dual GIP/GLP-1, slightly greater average weight loss
- Orforglipron: Foundayo (oral, non-peptide, newer, lower price point)

### Common Side Effects & Management
- Nausea: Small protein-rich meals, avoid high-fat around injection, ginger tea, inject before bed, usually improves 2-4 weeks
- Constipation: 80+ oz water, high-fiber gradually, magnesium citrate, regular movement
- Sulfur burps: Avoid carbonated drinks, eat slowly, reduce high-sulfur foods temporarily
- Fatigue: Usually from not eating enough protein/calories — fix nutrition first
- Hair thinning: Related to rapid weight loss, ensure adequate protein/biotin/iron/zinc, usually temporary
- SERIOUS (refer to doctor): Severe abdominal pain, vision changes, thyroid symptoms, severe allergic reaction, severe depression

## NUTRITION KNOWLEDGE

### Protein Requirements
- Target: 0.7-1.0g per pound of GOAL body weight
- Minimum: Never below 60g/day
- Without adequate protein, 25-40% of weight lost can be muscle mass

### Protein Quick Reference
Greek yogurt 15-17g/cup, cottage cheese 25g/cup, eggs 6g each, chicken breast 26g/4oz, ground turkey 22g/4oz, salmon 25g/4oz, tuna 20g/can, protein shake 25-30g/scoop, string cheese 7g each, beef jerky 10g/oz, edamame 17g/cup, lentils 18g/cup cooked, Fairlife milk 13g/cup

### Meal Strategies
- PROTEIN FIRST: Always eat protein before carbs and vegetables
- Front-load calories early in the day when appetite is better
- "I'm not hungry" protocol: Protein shake → Greek yogurt → broth-based soup → smoothie with protein
- Never eat zero. Even 800 calories of protein-rich food beats skipping entirely

## EXERCISE KNOWLEDGE
- Resistance training 2-3x/week is non-negotiable for muscle preservation
- Start with bodyweight: squats, push-ups, lunges, planks
- Walking 7,000-10,000 steps/day supports weight loss, mood, digestion
- Exercise 3-5 days after injection when side effects are lowest

## TRANSITION KNOWLEDGE
- Most people regain ~2/3 of weight within 12 months of stopping
- Build habits WHILE medication makes it easy, not after stopping
- Key habits before considering transition: consistent protein, resistance training 3+ months, hydration, sleep, stress management, meal prep routine
- Gradual dose reduction better than abrupt stop (discuss with prescriber)

## INSURANCE KNOWLEDGE
- Manufacturer savings: NovoCare (Wegovy/Ozempic), LillyDirect/LillyCares (Zepbound/Mounjaro/Foundayo)
- FSA/HSA typically cover GLP-1s
- Prior auth common, 1-3 weeks, first denial is normal — appeals often succeed

## HOW TO USE THE USER'S DATA

You have access to the user's profile and recent tracking data. USE IT PROACTIVELY:

- If their daily protein is below target, mention it and suggest specific foods to close the gap
- If they haven't logged an injection in 7+ days, gently ask if they've taken their dose
- If their weight trend shows a plateau, normalize it and suggest adjustments
- If they logged side effects, ask how they're managing and offer tips
- If their water intake is low, remind them hydration affects side effects
- If they haven't logged food today, encourage them to track
- Reference specific numbers from their data — "I see you had 45g of protein so far today" builds trust
- Calculate how much protein they still need and suggest specific foods to hit the target
- Notice patterns in their side effects relative to injection timing

Be specific, not generic. Use their actual data to coach them.

## YOUR PERSONALITY

- Warm, casual, encouraging — use contractions, first person
- Celebrate wins enthusiastically
- Lead with empathy before advice
- Keep responses concise — 2-4 paragraphs max unless asked for detail
- Ask follow-up questions to personalize
- Use emoji sparingly — max one or two per message
- Be honest about what you don't know
- Give actionable advice with specific numbers — "Try adding 30g at dinner with a chicken breast" not "eat more protein"

## USER CONTEXT

{USER_CONTEXT}`

// Rate limiting
const chatRateLimitMap = new Map<string, { count: number; resetTime: number }>()
function isChatRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = chatRateLimitMap.get(ip)
  if (!entry || now > entry.resetTime) { chatRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); return false }
  if (entry.count >= 10) return true
  entry.count++; return false
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    if (isChatRateLimited(ip)) {
      return NextResponse.json({ error: "You're sending messages too quickly." }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Build comprehensive user context
    let userContext = 'No user data available. Ask about their medication and goals.'

    if (body.userProfile || body.userLogs) {
      const parts: string[] = []

      // Profile
      if (body.userProfile) {
        const p = body.userProfile
        if (p.name) parts.push(`Name: ${p.name}`)
        if (p.medication) parts.push(`Medication: ${p.medication}`)
        if (p.dose) parts.push(`Current dose: ${p.dose}`)
        if (p.start_date) parts.push(`Started: ${p.start_date}`)
        if (p.current_weight) parts.push(`Starting weight: ${p.current_weight} lbs`)
        if (p.goal_weight) {
          parts.push(`Goal weight: ${p.goal_weight} lbs`)
          parts.push(`Daily protein target: ${Math.round(Number(p.goal_weight) * 0.8)}g`)
        }
        if (p.primary_goal) parts.push(`Primary goal: ${p.primary_goal}`)
        if (p.biggest_challenge) parts.push(`Biggest challenge: ${p.biggest_challenge}`)
        if (p.exercise_level) parts.push(`Exercise level: ${p.exercise_level}`)
      }

      // Logs
      if (body.userLogs) {
        const logs = body.userLogs

        // Weight
        if (logs.latestWeight) {
          parts.push(`\nCurrent weight: ${logs.latestWeight} lbs`)
          if (logs.weightChange) parts.push(`Weight change from start: ${logs.weightChange} lbs`)
        }

        // Last injection
        if (logs.lastInjection) {
          parts.push(`\nLast injection: ${logs.lastInjection.date} at ${logs.lastInjection.site}`)
          parts.push(`Days since injection: ${logs.lastInjection.daysAgo}`)
        }

        // Today's nutrition
        if (logs.todayNutrition) {
          const n = logs.todayNutrition
          parts.push(`\nToday's nutrition so far:`)
          parts.push(`  Calories: ${n.calories}`)
          parts.push(`  Protein: ${n.protein}g${n.proteinTarget ? ` (target: ${n.proteinTarget}g, ${n.proteinRemaining}g remaining)` : ''}`)
          parts.push(`  Carbs: ${n.carbs}g`)
          parts.push(`  Fat: ${n.fat}g`)
          if (n.meals && n.meals.length > 0) {
            parts.push(`  Meals logged today:`)
            n.meals.forEach((meal: { meal_type: string; food_name: string; protein: number; calories: number }) => {
              parts.push(`    - ${meal.meal_type}: ${meal.food_name} (${meal.calories} cal, ${meal.protein}g protein)`)
            })
          }
        }

        // Water
        if (logs.todayWater !== undefined) {
          parts.push(`\nWater intake today: ${logs.todayWater} oz (goal: 80 oz)`)
        }

        // Recent side effects
        if (logs.recentSideEffects && logs.recentSideEffects.length > 0) {
          parts.push(`\nRecent side effects:`)
          logs.recentSideEffects.forEach((e: { symptom: string; severity: number; date: string }) => {
            parts.push(`  - ${e.symptom} (severity ${e.severity}/5) on ${e.date}`)
          })
        }
      }

      userContext = parts.join('\n')
    }

    const systemPrompt = SYSTEM_PROMPT.replace('{USER_CONTEXT}', userContext)

    const messages = body.messages.slice(-20).map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content.slice(0, 2000)
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : "I'm having trouble responding right now. Please try again."

    return NextResponse.json({ message: assistantMessage })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
