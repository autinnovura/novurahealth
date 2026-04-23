import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { chatLimiter, checkRateLimit } from '../../lib/rate-limit'

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { success: allowed } = await checkRateLimit(chatLimiter, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
  }

  const { step, data } = await req.json()

  const systemPrompt = `You are Nova, the AI health coach for NovuraHealth. You're onboarding a new user.

CRITICAL RULES:
- MAX 1 sentence acknowledging what they said
- MAX 1 sentence transitioning to the next question
- NEVER more than 2 sentences total
- Be warm but FAST — like a quick text, not a paragraph
- No filler words, no fluff, no "that's wonderful" or "absolutely"
- 1 emoji max per response, only if natural`

  const prompts: Record<string, string> = {
    welcome: `Welcome a new user in exactly 2 short sentences. Introduce yourself as Nova and say this takes 60 seconds.`,
    name: `User's name is "${data}". Greet them by name (1 sentence) and ask which GLP-1 med they're on (1 sentence).`,
    medication: `User takes ${data}. Acknowledge briefly and ask their current dose.`,
    dose: `User's dose is ${data}. Got it. Ask when they started (or if they're just beginning).`,
    start_date: `User ${data === 'just_starting' ? 'is just starting' : `started ${data}`}. One quick acknowledgment. Ask current weight.`,
    current_weight: `User weighs ${data}. Don't comment on the number. Ask goal weight.`,
    goal_weight: `Goal weight is ${data}. Say solid goal. Ask their main reason for taking GLP-1.`,
    primary_goal: `Goal is "${data}". Quick affirmation. Ask biggest challenge so far.`,
    biggest_challenge: `Challenge is "${data}". Brief empathy. Ask activity level.`,
    exercise_level: `Activity: "${data}". Say "All set! Your dashboard is ready." Keep it to 1-2 sentences max.`,
  }

  const userPrompt = prompts[step]
  if (!userPrompt) return NextResponse.json({ message: "Let's get you set up!" })

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
        max_tokens: 80,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    const result = await res.json()
    return NextResponse.json({ message: result.content?.[0]?.text || "Let's keep going!" })
  } catch {
    const fallbacks: Record<string, string> = {
      welcome: "Hey! I'm Nova, your GLP-1 coach. Let's get you set up — 60 seconds.",
      name: `Hey ${data}! Which GLP-1 are you on?`,
      medication: `${data}, got it. What dose are you on?`,
      dose: `${data}, noted. When did you start?`,
      start_date: "Got it. What's your current weight?",
      current_weight: "Logged. What's your goal weight?",
      goal_weight: "Solid target. What's your main goal with GLP-1?",
      primary_goal: "Makes sense. What's been your biggest challenge?",
      biggest_challenge: "That's what I'm here for. How active are you?",
      exercise_level: "All set! Your dashboard is ready 🌿",
    }
    return NextResponse.json({ message: fallbacks[step] || "Let's keep going!" })
  }
}
