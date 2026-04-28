@AGENTS.md

# Project memory — NovuraHealth

This file is auto-loaded by Claude tools (Cowork, Claude Code, Claude Desktop) any time they open this folder. Keep it accurate, keep it short, link out to the deeper docs.

## What this project is

**NovuraHealth** — an AI-powered companion app for people on GLP-1 medications (Ozempic, Wegovy, Mounjaro, Zepbound, and others). Users log injections, food, water, weight, exercise, and side effects. An AI coach ("Nova") uses that data to give personalized guidance, including a tapering plan for users wanting to come off.

Live at https://novurahealth.com. Pre-launch private beta.

## Who's building it

**Austin** — solo founder, currently learning to code. Hands-on background, fast learner, entrepreneurial. Talk to Austin like a mentor would: be direct, explain WHY something matters, don't over-jargon, give concrete next steps. He's capable of more than a beginner — but he doesn't yet have years of pattern-recognition, so spell out things experienced devs would assume.

## Key docs to read before substantive work

- `README.md` — what the project is, full feature list, stack, getting started.
- `ROADMAP.md` — current state, prioritized open work, decisions worth remembering. **Read this first when picking up new work.**
- `OPERATIONS.md` — runbook for local dev, manual cron triggers, key rotation, common incidents. **Read this when troubleshooting or doing anything ops-flavored.**
- `AGENTS.md` — short note on Next.js 16 quirks (this is a recent breaking version; verify behavior against `node_modules/next/dist/docs/` rather than from training data).

## Stack at a glance

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (auth + Postgres) · Anthropic SDK (Claude) · Upstash Redis (rate limit) · Resend (email) · web-push (VAPID) · Recharts · Vercel hosting + Vercel Cron.

## Conventions established in this codebase

### Auth
Every protected API route starts with:
```ts
const user = await getAuthedUser()
if (!user) return unauthorized()
```
`getAuthedUser` and the `unauthorized` / `forbidden` helpers live in `src/app/lib/auth.ts`. **Never** skip the auth check on a route that touches user data.

### Request body validation
Use Zod via the shared helper:
```ts
import { validateRequestBody } from '../../lib/validation'

const bodySchema = z.object({ ... })

const validated = await validateRequestBody(req, bodySchema)
if (!validated.success) return validated.response
const body = validated.data
```
Pattern is established in `/api/chat` and `/api/readiness-assessment`. Apply to every new POST route — don't trust raw `req.json()`.

### Rate limiting
`src/app/lib/rate-limit.ts` exports `chatLimiter`, `importLimiter`, `standardLimiter`. Limiters are `null` when Upstash env vars are missing — `checkRateLimit` returns success in that case (fail-open). Production must always have Upstash configured (see ROADMAP item #1).

### Supabase admin client
Routes that need to bypass RLS create `supabaseAdmin` at module level using `SUPABASE_SERVICE_ROLE_KEY`. **Server-side only.** Never import the service-role-keyed client into a client component or any file under a `'use client'` directive.

### Conversation memory
Three layers in chat:
1. Last 15 messages (full text)
2. Mid-term summary (auto-generated from older messages)
3. Persistent user facts (saved via the `remember_fact` tool)
See `src/app/lib/conversations.ts`. Don't add a fourth layer without thinking carefully about token budget.

### Tool-use (chat)
The chat route runs a tool-use loop: model calls a tool → we execute → we feed result back → repeat up to 5 iterations. Tools include `log_food`, `log_weight`, `log_medication`, `log_water`, `log_side_effect`, `log_exercise`, `log_supplement`, `remember_fact`. Each log tool dedups against a 2-minute window to prevent double-logging.

### Cron jobs
All `/api/cron/*` endpoints check a bearer token equal to `CRON_SECRET`. Schedule lives in `vercel.json`. To add a cron, add to `vercel.json` AND write the route handler.

### Env vars
`Vercel project settings` is the source of truth. `.env.local` on any machine mirrors Vercel — never the reverse. `.env.example` is committed and documents every required variable.

## Hard rules — health domain

- **Never refuse tracking based on FDA approval status.** Compounded, research, and clinical-trial GLP-1s are all tracked.
- **Never recommend a dose change.** That's between the user and their provider.
- **Never invent medications, approval dates, or pharmacokinetic data.** If unsure, say so.
- **Never strip the "not medical advice" framing** from chat system prompts or UI.
- **Sensitive data:** medication doses, injection logs, weight, side effects, mood. Treat all of it like PHI — never log to console in plaintext, never expose in error responses, never share between users.

## Tone for the chat coach (Nova)

If you're modifying the system prompt in `/api/chat`: short, direct, conversational. Texting-a-friend style. NO bullet points, NO markdown, NO emojis unless the user uses them. Hard cap of 8 sentences per reply. Give answers, not interviews. Reference the user's actual data — never generic advice.

## Things to NOT touch without good reason

- `src/app/lib/medications.ts` — sourced from FDA labels and prescribing information. Changes need a citation.
- The 3-tier memory architecture in `lib/conversations.ts` — works well, breaking it is expensive.
- The hardcoded values in `getUserContext()` — they're tuned (e.g., last 14 weights, last 7 check-ins). Bumping them costs tokens.

## Updating this file

When you add a new convention, decision, or hard rule that future sessions should know about, append it here. When something becomes stale, update or remove it. Treat CLAUDE.md as the project's working brain.
