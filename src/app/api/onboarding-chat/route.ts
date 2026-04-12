import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { step, data } = await req.json()

  const systemPrompt = `You are Nova, the warm and knowledgeable AI health coach for NovuraHealth — a GLP-1 medication companion app. You're onboarding a new user through a conversational intake.

Your personality: warm, encouraging, knowledgeable about GLP-1 medications, casual but professional. You use short sentences. You're like a supportive friend who happens to know a lot about weight management.

RULES:
- Keep responses to 1-3 short sentences MAX
- Be genuinely encouraging, not generic
- Reference what the user just told you specifically
- Transition naturally to what you'll ask next
- Never use emojis excessively (1 max per response)
- Don't be clinical or robotic
- Sound like a real person texting, not a corporate chatbot`

  const prompts: Record<string, string> = {
    welcome: `The user just signed up for NovuraHealth. Give a warm 2-sentence welcome. Introduce yourself as Nova. Say you'll help them get set up in about 60 seconds and that you'll be their coach throughout their journey.`,
    
    name: `The user just told you their name is "${data}". Acknowledge it warmly (use their name), and say you'd love to know which GLP-1 medication they're on so you can personalize their experience.`,
    
    medication: `The user is taking ${data}. Acknowledge their medication choice with something brief and relevant (you can mention one quick fact about it). Then say let's get their dose dialed in.`,
    
    dose: `The user's dose is ${data}. Acknowledge it briefly. Then ask when they started their medication (or if they're just getting started).`,
    
    start_date: `The user ${data === 'just_starting' ? 'is just getting started' : `started on ${data}`}. ${data === 'just_starting' ? "Welcome them to the beginning of their journey — it's exciting." : "Acknowledge how far they've come."} Then say let's set up their weight tracking.`,
    
    current_weight: `The user's current weight is ${data} lbs. Acknowledge it matter-of-factly (don't comment on the number itself — be sensitive). Ask what their goal weight is.`,
    
    goal_weight: `The user's current weight was mentioned before and their goal weight is ${data} lbs. Don't calculate or comment on the specific gap. Just say that's a solid target and you'll help them track progress. Ask what their main goal is with GLP-1 treatment.`,
    
    primary_goal: `The user's primary goal is: "${data}". Affirm this goal genuinely. Then ask what their biggest challenge has been so far (or what they're most worried about if they're new).`,
    
    biggest_challenge: `The user's biggest challenge is: "${data}". Show empathy and briefly reassure them — that's exactly what you're here to help with. Ask about their current exercise/activity level.`,
    
    exercise_level: `The user's exercise level is: "${data}". Acknowledge it without judgment. Then say "Alright, I've got everything I need!" and that you're excited to be their coach. Say their dashboard is ready.`,
  }

  const userPrompt = prompts[step]
  if (!userPrompt) {
    return NextResponse.json({ message: "Let's get you set up!" })
  }

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
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const result = await res.json()
    const message = result.content?.[0]?.text || "Let's keep going!"
    return NextResponse.json({ message })
  } catch {
    // Fallback responses if API fails
    const fallbacks: Record<string, string> = {
      welcome: "Hey there! I'm Nova, your GLP-1 coach. Let's get you set up — this'll take about 60 seconds.",
      name: `Great to meet you, ${data}! Which GLP-1 medication are you on?`,
      medication: `Got it — ${data}. Let's get your dose set up.`,
      dose: `${data}, noted. When did you start your medication?`,
      start_date: "Perfect. Let's set up your weight tracking.",
      current_weight: "Got it. What's your goal weight?",
      goal_weight: "Solid target. What's your main goal with GLP-1 treatment?",
      primary_goal: "Love that. What's been your biggest challenge so far?",
      biggest_challenge: "That's exactly what I'm here to help with. How active are you currently?",
      exercise_level: "Alright, I've got everything I need! Your dashboard is ready. Let's do this.",
    }
    return NextResponse.json({ message: fallbacks[step] || "Let's keep going!" })
  }
}
