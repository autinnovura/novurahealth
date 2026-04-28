# NovuraHealth — Roadmap & Status

The strategic "where are we, what's next" view of the project. Distinct from `OPERATIONS.md` (operational runbook) and `README.md` (what the project IS). Update at the end of each meaningful work session.

Last updated: 2026-04-27

---

## Where we are

Pre-launch private beta. Real infrastructure: Supabase (auth + Postgres), Vercel (host + cron), Upstash Redis (rate limit), Anthropic Claude (AI coach), Resend (email), web-push (notifications). 31 API routes, ~30 pages, PWA installable on iOS and Android. Single founder, learning to code.

## What's strong

- Auth check enforced on every protected API route (`getAuthedUser()`).
- Three-tier conversation memory (recent messages + mid-term summary + persistent user facts) in the chat coach.
- Rate limiter with sliding windows, graceful fallback when Redis is unreachable.
- Cron jobs are idempotent and bearer-token authed.
- Comprehensive GLP-1 medication reference with PK profiles, titration schedules, BMI eligibility, FDA approval data.
- Push notifications with auto-cleanup on subscription expiry (404/410).

## Recent work — 2026-04-27

- Replaced `create-next-app` boilerplate `README.md` with a real project README.
- Added `.env.example` template documenting all required env vars.
- Tweaked `.gitignore` so real env files stay ignored but `.env.example` is committed.
- Added Zod request body validation to `/api/chat` and `/api/readiness-assessment` via a shared `validateRequestBody` helper at `src/app/lib/validation.ts`.
- Wrote `OPERATIONS.md` runbook covering local dev, manual cron triggers, key rotation procedures for all 7 secrets, common incidents, and a pre-launch checklist.

---

## Open work — priority order

### 1. Urgent before launch

1. **Wire up Upstash production rate limiting.** No `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in Vercel right now → `chatLimiter` is `null` → `/api/chat` has no rate limit. A bug in the frontend or a single bad actor could spike Anthropic costs fast. ~30 min to set up.
2. **Pre-launch key rotation drill.** Rotate every secret per `OPERATIONS.md` §3 once. Establishes muscle memory and ensures launch keys are fresh.
3. **Confirm `.env.local` was never committed.** Run `git log --all --full-history -- .env.local` — output must be empty. If anything appears, treat the keys as compromised and rotate immediately.
4. **Privacy policy and terms** must be live and linked from signup before public users.

### 2. Important, not blocking

5. **Add Zod validation to remaining POST endpoints.** Chat and readiness done. Still loose: `/api/food-logs`, `/api/water-logs`, `/api/weight-logs`, `/api/medication-logs`, `/api/exercise-logs`, `/api/side-effect-logs`, `/api/meal-plans`, `/api/workout-plans`, `/api/import-*`, `/api/transition-coach`, `/api/maintenance-chat`, `/api/savings-chat`, `/api/onboarding-chat`. Pattern is now established — each one is ~5 minutes.
6. **First automated tests.** Pick the medication-logging path inside `/api/chat` — auth check, dedup window, RLS isolation. Health data regressions are catastrophic; one battery of tests pays for itself the first time it catches a bug.
7. **Track Supabase migrations in `supabase/migrations/`.** No checked-in schema today. If a schema change breaks prod, there's no rollback.
8. **`audit_logs` table.** Record every delete/modify of user health data with old → new values. If a user disputes data loss, you have a trail.

### 3. Tech debt

9. **Migrate `src/middleware.ts` → `src/proxy.ts`** for Next 16 (deprecation warning on every build). Read `node_modules/next/dist/docs/...` per `AGENTS.md` rule first.
10. **Lazy-init Supabase admin clients** so `npm run build` succeeds without env vars. Currently blocks any CI that doesn't inject secrets at build time.
11. **Drop legacy `messages` array** from the `/api/chat` schema if the frontend no longer sends that shape.
12. **Hardcoded Anthropic model names** scattered across multiple routes. Pull into a single config constant or env var so model upgrades are a one-line change.

### 4. Nice to have

- `CONTRIBUTING.md` — only matters once there's a second contributor.
- Monitoring/alerting on Anthropic 5xx rate, Supabase connection errors, Upstash unavailability (Vercel + Sentry or similar).
- Mobile-app native wrapper (Capacitor or React Native) once PWA shows traction.
- Per-user push frequency caps so reminders never feel spammy.

---

## Decisions worth remembering

- **Zod `^3.23.8`** chosen over v4 for stability with Next 16 / React 19. Reconsider when v4 is widely adopted.
- **Validation lives in `src/app/lib/validation.ts`.** `validateRequestBody(req, schema)` is the pattern — copy it for every new POST route.
- **`__` prefix on answer keys** in `/api/readiness-assessment` marks meta values excluded from scoring; schema enforces non-meta values are booleans.
- **Vercel is source of truth for env vars.** `.env.local` on each machine mirrors Vercel — not the other way around.
- **VAPID keys are NEVER rotated casually.** Rotation invalidates every existing push subscription and forces every user to re-enable notifications.
- **Health domain non-negotiable:** never refuse tracking based on FDA approval status. Compounded, research, and clinical-trial GLP-1s are all tracked. Always recommend the user consult their provider for clinical decisions; never suggest dose changes.

---

## When you come back

1. Skim "Recent work" above to remember what shipped last session.
2. Read `OPERATIONS.md` §1 to refresh on local dev.
3. Pull from `main` so you have the latest, then pick from "Urgent before launch" above.

Best single next session: **wire up Upstash** (item #1). Knocks out a real production risk in ~30 minutes.
