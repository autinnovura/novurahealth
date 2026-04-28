# NovuraHealth

**Your AI coach for the GLP-1 journey.**

NovuraHealth is a tracker and AI coach for people on GLP-1 medications (Ozempic, Wegovy, Mounjaro, Zepbound, and others). Users log their injections, nutrition, weight, water, exercise, and side effects, and an AI coach uses that data to give personalized guidance — including a tapering plan for when they're ready to come off.

> **Status:** Private beta. Not affiliated with Novo Nordisk, Eli Lilly, or any pharmaceutical manufacturer. Nothing in this app is medical advice.

---

## What it does

- **Logging** — injections (with dose + injection-site rotation), food, water, exercise, weight, and side effects.
- **AI coach** — chat that knows the user's logs, current dose, side-effect history, and goals. Uses three tiers of memory (recent messages, mid-term summary, persistent facts) to stay coherent over months.
- **Medication intelligence** — pharmacokinetic profiles and titration schedules for 9 GLP-1s, plus eligibility BMIs and FDA approval data.
- **Plans** — AI-generated meal and workout plans tailored to the user's medication phase.
- **Tapering coach** — structured wind-down for users transitioning off GLP-1s, with maintenance support afterward.
- **Readiness assessment** — quiz + scoring to gauge whether a user is ready to taper.
- **Reminders & digests** — push notifications for injection day, pre-shot prep, streak-risk warnings, and a weekly progress digest by email.
- **Data import** — paste history from other trackers; an LLM parses and saves it.
- **PWA** — installable on iOS and Android with offline-aware service worker.
- **Savings & guides** — content pages for insurance navigation and medication overviews.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, Geist + Inter + Fraunces fonts |
| Auth & DB | Supabase (SSR auth, Postgres) |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) — Claude for chat, plans, parsing |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) with sliding windows |
| Email | Resend |
| Push | `web-push` with VAPID |
| Charts | Recharts |
| Toasts / motion | Sonner, Framer Motion |
| Hosting | Vercel (with Vercel Cron) |

> **Note on Next.js 16:** This is a recent major release with breaking changes from Next 14/15. See `AGENTS.md` and `node_modules/next/dist/docs/` before touching the framework code.

## Project layout

```
src/
├── middleware.ts                  # Refreshes Supabase session on every request
└── app/
    ├── api/                       # 31 route handlers (logs, chat, plans, cron, import…)
    │   ├── chat/                  # Main AI coach
    │   ├── cron/                  # Vercel-scheduled jobs
    │   ├── import-*               # Bulk data import pipeline
    │   ├── *-logs/                # Food / water / weight / medication / etc.
    │   └── ...
    ├── components/                # Shared React components (charts, install prompts, nav)
    ├── lib/
    │   ├── auth.ts                # getAuthedUser, unauthorized, forbidden helpers
    │   ├── supabase.ts            # Browser client
    │   ├── rate-limit.ts          # Upstash sliding-window limiters
    │   ├── conversations.ts       # 3-tier chat memory
    │   ├── medications.ts         # GLP-1 PK profiles, titration, eligibility
    │   ├── push/send.ts           # Web push helper
    │   ├── email.ts               # Resend wrapper
    │   ├── dates.ts               # Timezone-safe helpers
    │   └── escape.ts              # HTML escaping for emails
    ├── (pages)                    # dashboard, chat, onboarding, stats, savings, settings,
    │                              # maintenance, login, signup, reset/update password,
    │                              # privacy, terms, guides
    └── layout.tsx
public/                            # Icons, manifest, service worker, sitemap, OG image
```

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)
- An Anthropic API key
- An Upstash Redis instance (REST API enabled)
- A Resend account (only needed if testing welcome / digest emails)
- VAPID keys for push (only needed if testing notifications) — generate with `npx web-push generate-vapid-keys`

### Environment variables

Create a `.env.local` in the project root. All variables are required for full functionality; you can omit Resend/VAPID for local-only testing of non-notification flows.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...        # server-side only, never expose

# Anthropic (chat, plans, import parsing)
ANTHROPIC_API_KEY=sk-ant-...

# Upstash Redis (rate limiting + dedup)
UPSTASH_REDIS_REST_URL=https://<region>-<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Cron auth — protects /api/cron/* endpoints
CRON_SECRET=<random-long-string>

# Resend (welcome email + weekly digest)
RESEND_API_KEY=re_...

# Web Push (VAPID)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...               # same as VAPID_PUBLIC_KEY, exposed to browser
```

> **TODO:** ship a `.env.example` at the repo root so contributors don't have to dig through this list.

### Install & run

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm run start        # serve the build
npm run lint         # eslint
```

### Database

Schema lives in Supabase. Tables include `users`, `food_logs`, `water_logs`, `weight_logs`, `medication_logs`, `exercise_logs`, `side_effect_logs`, `meal_plans`, `workout_plans`, `conversations`, `messages`, `user_facts`, `reminder_log`, `push_subscriptions`, `waitlist`, and `glp1_knowledge`.

> **TODO:** check migrations into a `supabase/migrations/` folder so the schema is reproducible.

## Scheduled jobs (Vercel Cron)

Configured in `vercel.json`:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/injection-reminders` | every 5 min | Send push reminders when an injection is due |
| `/api/cron/pre-shot-reminders`  | hourly | Reminders the day before injection day |
| `/api/cron/streak-risk-check`   | daily 18:00 UTC | Warn users about to break a logging streak |
| `/api/cron/weekly-digest`       | Sun 20:00 UTC | Email weekly progress summary |
| `/api/cron/cleanup`             | daily 03:00 UTC | Housekeeping (expired sessions, stale rows) |

All cron endpoints check a bearer token against `CRON_SECRET`. To trigger manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/weekly-digest
```

## Deployment

Designed for Vercel. Push to the `main` branch deploys to production. Every PR gets a preview URL.

Required setup on Vercel:

1. Connect the GitHub repo.
2. Add every environment variable from the list above to Project → Settings → Environment Variables.
3. Vercel Cron picks up `vercel.json` automatically on first deploy.
4. Point the production domain (`novurahealth.com`) at the Vercel project.

## Safety, privacy, and compliance

This app handles **sensitive health data** — medication doses, injection logs, weight, side effects. A few non-negotiables:

- Auth is required on every API route that touches user data. Server-side, that's `getAuthedUser()` from `lib/auth.ts`.
- The Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) is server-only. Never import it into client components.
- Rate limiting is applied at the route level for chat (30/min), import (5/10min), and standard endpoints (60/min).
- The app explicitly does **not** provide medical advice. The chat system prompt and UI both make this clear; if you change them, preserve that disclaimer.
- HIPAA: NovuraHealth is a consumer wellness app, not a covered entity. If that ever changes (e.g., partnership with a clinic), the data flows here will need a BAA-compliant rework.

## Known gaps / on the roadmap

- `.env.example` file (see above)
- Zod validation on POST bodies for `/api/chat`, `/api/readiness-assessment`, and the import routes
- Automated tests (unit tests for auth helpers, dedup logic, cron idempotency; integration tests for log mutation)
- `supabase/migrations/` checked in for schema reproducibility
- An `audit_logs` table for delete/modify trails on health data
- An `OPERATIONS.md` runbook (env setup, manual cron triggers, common incidents)

## Contributing

Currently a closed, single-founder project. If that changes, contributors should:

1. Read `AGENTS.md` first — it has Next.js 16 quirks that bite if you skip them.
2. Open a PR against `main`; preview deploys are automatic.
3. Don't touch the medication data in `lib/medications.ts` without a citation to a primary source (FDA label or manufacturer prescribing information).

## License

No license declared yet — code is **all rights reserved** until a license file is added.

---

© NovuraHealth. Not affiliated with Novo Nordisk A/S, Eli Lilly and Company, or any other pharmaceutical manufacturer. Trademarks belong to their respective owners.
