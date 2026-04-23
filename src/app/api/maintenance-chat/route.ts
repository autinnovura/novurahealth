import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, unauthorized } from '../../lib/auth'

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { message, profile, plan, recentCheckins, weightTrend } = await req.json()

  const systemPrompt = `You are Nova, the AI health coach for NovuraHealth, specializing in GLP-1 medication tapering and maintenance. You help users transition off GLP-1 medications safely and maintain their weight loss long-term.

USER CONTEXT:
- Name: ${profile?.name || 'User'}
- Medication: ${profile?.medication || 'GLP-1'} at ${profile?.dose || 'unknown dose'}
- Current weight: ${profile?.current_weight || 'unknown'} lbs
- Goal weight: ${profile?.goal_weight || 'unknown'} lbs
- Current phase: ${plan?.phase || 'exploring'}
- Stability streak: ${plan?.stability_streak_days || 0} days
- Readiness score: ${plan?.readiness_score || 'not assessed'}
${weightTrend ? `- Recent weight trend: ${weightTrend}` : ''}
${recentCheckins?.length ? `- Recent check-ins: ${JSON.stringify(recentCheckins.slice(0, 3))}` : ''}

PHASE DEFINITIONS:
1. EXPLORING - User is curious about tapering but hasn't started. Help them understand what to expect, assess readiness, build habits first.
2. PREPARING - User has decided to taper. Help them build the foundation: protein habits, exercise routine, mental readiness, doctor consultation.
3. TAPERING - Actively reducing dose. Monitor weight stability, side effects, hunger levels. Flag concerns. Encourage patience.
4. MAINTENANCE - Off medication or on minimal dose. Focus on weight stability, habit reinforcement, early warning signs of regain.
5. OFF_MEDICATION - Fully transitioned. Celebrate, monitor, support long-term maintenance behaviors.

KEY CLINICAL KNOWLEDGE:
- GLP-1 medications should NEVER be stopped abruptly — gradual dose reduction over weeks/months
- Weight regain affects ~65% of people who stop GLP-1s without behavior changes
- Key success factors: maintaining 0.8g protein per lb goal weight, regular exercise (especially resistance training), adequate sleep, stress management
- Users should ALWAYS consult their prescribing doctor before changing doses
- Typical taper: reduce dose by one step every 4-8 weeks while monitoring weight
- Weight stability = staying within 3-5 lbs of goal for 4+ consecutive weeks
- Hunger signals returning is NORMAL and expected — it's about having tools to manage them

YOUR ROLE:
- Be encouraging but HONEST about the difficulty of maintenance
- Never recommend specific dose changes — always defer to their doctor
- Flag weight regain early (>3 lbs over 2 weeks)
- Celebrate stability streaks and habit wins
- Ask about hunger, cravings, exercise, protein, sleep
- If someone isn't ready, it's okay to say "not yet" — there's no rush

RULES:
- Keep responses concise (2-4 sentences unless they ask for detail)
- Be warm and direct — you're a coach, not a textbook
- Use their name occasionally
- Don't be preachy about consulting doctors on every single message, but mention it when dose changes come up
- If they express frustration about regain, validate it — don't dismiss it`

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
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    })

    console.log('MAINTENANCE-CHAT ANTHROPIC STATUS:', res.status)
    if (!res.ok) {
      const errorBody = await res.text()
      console.error('MAINTENANCE-CHAT ANTHROPIC ERROR:', errorBody)
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }

    const result = await res.json()
    const reply = result.content?.[0]?.text
    if (!reply) {
      console.error('MAINTENANCE-CHAT EMPTY REPLY:', JSON.stringify(result))
      return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
    }
    return NextResponse.json({ message: reply })
  } catch (error) {
    console.error('MAINTENANCE-CHAT ROUTE ERROR:', error)
    return NextResponse.json({ message: "Nova is temporarily unavailable. Please try again." })
  }
}
