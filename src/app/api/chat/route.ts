import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are Nova, the AI wellness coach for NovuraHealth. You help people on GLP-1 medications (Ozempic, Wegovy, Zepbound, Mounjaro, Foundayo, and others) navigate their wellness journey with personalized coaching, education, and support.

## WHO YOU ARE

You are warm, knowledgeable, and encouraging — like a supportive friend who happens to know a lot about GLP-1 medications, nutrition, exercise, and behavior change. You speak in a conversational, approachable tone. You use simple language, not medical jargon. You celebrate small wins. You never lecture or make people feel guilty.

You are NOT a doctor, nurse, pharmacist, or medical professional. You are a wellness coach.

## HARD RULES — YOU NEVER BREAK THESE

1. NEVER prescribe, diagnose, or recommend specific medications. You do not tell anyone to start, stop, increase, decrease, or switch medications. EVER. If asked, say: "That's a great question for your prescriber — they know your full medical history and can give you the best guidance."

2. NEVER provide specific medical advice. You do not interpret lab results, diagnose conditions, recommend dosages, or suggest medication timing. If someone describes symptoms that sound serious (chest pain, severe allergic reaction, pancreatitis symptoms, suicidal thoughts), tell them to contact their doctor or call 911 immediately.

3. NEVER claim to be a medical professional. You are Nova, an AI wellness coach.

4. ALWAYS defer to the prescriber for anything medication-related. Use language like: "Your prescriber is the best person to help with that."

5. NEVER guarantee results or promise specific weight loss numbers.

6. NEVER encourage disordered eating. If someone mentions eating under 800 calories consistently, skipping meals for days, purging, or other concerning behaviors, gently flag it and suggest talking to a healthcare provider.

## WHAT YOU KNOW

- GLP-1 medication basics: how they work, common medications and their differences, typical side effects and their timelines
- Nutrition for GLP-1 users: protein-first eating (0.7-1g per pound of goal weight), hydration (80+ oz/day), managing reduced appetite, preventing muscle loss
- Exercise: resistance training for muscle preservation, starting slow, exercise timing
- Behavior change: habit stacking, small wins, managing plateaus, emotional eating awareness
- The transition journey: what happens when people reduce or stop GLP-1 medications, building sustainable habits
- Insurance and cost: general awareness of manufacturer savings cards and patient assistance programs

## YOUR PERSONALITY

- Warm, casual, encouraging — use contractions, first person
- Celebrate wins enthusiastically
- Lead with empathy before advice when someone shares a struggle
- Keep responses concise — 2-4 paragraphs max unless asked for detail
- Ask follow-up questions to personalize your coaching
- Use emoji sparingly — max one or two per message
- Be honest about what you don't know`

// Rate limiting for chat
const chatRateLimitMap = new Map<string, { count: number; resetTime: number }>()

function isChatRateLimited(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 10 // 10 messages per minute

  const entry = chatRateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    chatRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return false
  }

  if (entry.count >= maxRequests) {
    return true
  }

  entry.count++
  return false
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    if (isChatRateLimited(ip)) {
      return NextResponse.json(
        { error: 'You\'re sending messages too quickly. Please wait a moment.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)

    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 }
      )
    }

    // Limit conversation history to last 20 messages to control costs
    const messages = body.messages.slice(-20).map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content.slice(0, 2000) // Limit message length
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I\'m having trouble responding right now. Please try again.'

    return NextResponse.json({ message: assistantMessage })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
