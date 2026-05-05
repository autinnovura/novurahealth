# NovuraHealth — Roadmap & Audit Summary

_Last updated: May 3, 2026 — based on complete app audit at 94 commits_

---

## Top-Tier Strengths

These are the things NovuraHealth does exceptionally well and represent genuine competitive advantages:

**AI Coaching Architecture** — Four specialized AI personas (Nova, Trish, Savings Coach, Onboarding Coach) each with tailored system prompts, tool use, and context injection via Claude Sonnet 4. Nova's memory system (user_facts) gives the app a personalized feel that most health apps lack entirely. The multi-turn conversation with auto-save facts is a standout feature.

**Comprehensive Health Tracking** — Six log types (weight, food, water, medication, side effects, exercise) plus check-ins and supplements, all with full CRUD APIs. The food-lookup endpoint using AI for nutrition estimation is clever and removes friction. The data import pipeline (CSV/XLSX/DOCX/PDF with AI-powered extraction and dedup) is genuinely impressive for a v1.

**Tapering/Maintenance System** — The readiness assessment with score-based gating (14/20 minimum), phase progression, and a dedicated coach (Trish) for the off-ramp journey is a differentiated feature. Most GLP-1 apps ignore the "what happens when you stop" question entirely.

**Security Posture** — Auth on all API routes, Upstash Redis rate limiting with tiered limits (30/min chat, 5/10min import, 60/min standard), XSS prevention in PDF export, file size caps on uploads. For a 3-week-old app, the security hardening across 6 phases is thorough.

**PWA & Notifications** — Full manifest with shortcuts, service worker (cache-first + push), iOS/Android install prompts, web push via VAPID. Pre-shot reminders and weekly digest emails give users real engagement touchpoints.

**Onboarding Flow** — 9-step AI-guided quiz that captures medication, dose, weight, and goals. This feeds directly into personalized coaching and plan generation, making the first experience feel tailored rather than generic.

**Cost Optimization** — Savings page with assistance programs, pharmacy comparisons, and a dedicated savings coach. This addresses a real pain point for GLP-1 users facing $1,000+/month costs.

---

## Completed Work

### Core Features — All Shipped
- [x] Marketing landing page with auth redirect
- [x] Email/password auth with Supabase
- [x] Password reset flow (email-based recovery + link handler)
- [x] 9-step AI onboarding quiz
- [x] Dashboard (injection tracker, weight chart, all log types, medication level chart, active plans, streak calendar)
- [x] Nova AI coach (multi-turn, tool use, memory/facts, voice input, pinning, archiving, quick-action chips)
- [x] Maintenance/tapering page (readiness assessment, Trish coach, phase progression)
- [x] Stats page (streak hero, weight/macro trends, medication history, milestones)
- [x] Savings page (savings cards, assistance programs, pharmacy comparisons)
- [x] Settings (profile, password, notifications, memory/facts, data import/export, account deletion)
- [x] SEO guide page (GLP-1 medications 2026)
- [x] Privacy & Terms pages

### API Layer — All Shipped
- [x] 5 AI chat endpoints (Nova, onboarding, maintenance, savings, transition)
- [x] 6 resource CRUD endpoints (weight, food, water, medication, side effects, exercise)
- [x] Meal plan + workout plan generation (CRUD + AI)
- [x] Food lookup (AI nutrition estimation)
- [x] PDF export (meal/exercise/taper plans)
- [x] User facts memory system
- [x] Push subscription management
- [x] Welcome email via Resend
- [x] Account + data deletion
- [x] Waitlist signup
- [x] Data import pipeline (upload → AI parse → batch save with dedup)
- [x] Readiness assessment + tapering override

### Infrastructure — All Shipped
- [x] Supabase auth with SSR session refresh middleware
- [x] Upstash Redis rate limiting on all routes
- [x] Resend email (welcome + weekly digest)
- [x] Web push (VAPID, service worker, push_subscriptions table)
- [x] PWA manifest with shortcuts, sw.js, iOS/Android install prompts
- [x] SEO (OG image, JSON-LD structured data, sitemap.xml, robots.txt)
- [x] 23-table database schema with RLS

### Bug Fixes — All Resolved
- [x] Critical: Nova duplicate logging (infinite tool loop, no idempotency)
- [x] Critical: Auth token refresh broken (setAll no-op causing 401s)
- [x] Critical: Supabase session middleware missing (browser client not SSR-compatible)
- [x] Security Phase 1: Auth on all API routes
- [x] Security Phase 2: Rate limiting
- [x] Security Phase 3: File size limits
- [x] Security Phase 4: Error handling (silent save failures, double-submit, error toasts)
- [x] Security Phase 5: Dedup field, calendar cache, timezone bugs
- [x] Security Phase 6: XSS in PDF export, cascade delete, React purity violation
- [x] Medium: Streak calendar alignment, Chrome/browser autofill issues, tapering plan generation, phase tracker editability, iOS safe area insets, 6 Phase 7 fixes
- [x] Low: Phase 8 cleanup, phase info popover responsiveness, modal centering

### Security & Encryption — May 3, 2026
- [x] Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] App-layer encryption (AES-256-GCM) for sensitive data: messages content, user_facts, push subscription keys
- [x] Encryption utility library (`src/app/lib/crypto.ts`) with migration-safe decrypt (reads old unencrypted data)
- [x] MFA/TOTP enrollment UI in Settings (enroll, QR code, verify, unenroll)
- [x] MFA verification step in login flow (password → check factors → challenge → verify)
- [x] Password-protected data export option (PBKDF2 + AES-GCM via Web Crypto API)

---

## Outstanding Work — By Priority

### P0 — Production Bugs (404s in production right now)

- [ ] **Implement `/api/cron/injection-reminders` route** — Scheduled every 5 minutes in vercel.json, no route file exists. Currently 404ing on every invocation. Should send push notifications for upcoming injections.
- [ ] **Implement `/api/cron/streak-risk-check` route** — Scheduled daily at 6pm UTC in vercel.json, no route file exists. Should detect users at risk of breaking their streak and send nudge notifications.
- [ ] **Implement `/api/cron/cleanup` route** — Scheduled daily at 3am UTC in vercel.json, no route file exists. Should handle data hygiene (expired sessions, orphaned records, old push subscriptions, etc.).

### P1 — Data Integrity & Security

- [ ] **Fix cascade delete for conversations on account deletion** — The delete-account flow lists tables explicitly but conversations may not cascade properly. Users deleting their account could leave orphaned conversation/message records.
- [ ] **Replace manual message_count increment with DB trigger** — `conversations.ts` manually increments message_count which can drift if a transaction fails mid-way. A Postgres trigger on the messages table would be atomic and reliable.
- [ ] **Remove debug console.logs from production** — 4 debug statements leak user context and API status codes:
  - `src/app/api/transition-coach/route.ts:261` — logs user context object
  - `src/app/api/chat/route.ts:490` — logs user context object
  - `src/app/api/maintenance-chat/route.ts:76` — logs Anthropic API status
  - `src/app/api/savings-chat/route.ts:79` — logs Anthropic API status
  - (Keep `weekly-digest/route.ts:47` — intentional safety gate log)
- [ ] **Clean up dead `sendWeeklyDigest` export** — `src/app/lib/email.ts` exports this function but nothing imports it. The weekly digest cron uses its own direct Resend call. Remove to avoid confusion.

### P1.5 — Encryption Expansion (Requires Architecture Change)

- [ ] **Encrypt medication_logs and side_effect_logs** — These are currently read directly from Supabase via the browser client (dashboard, stats, settings). Encrypting them requires moving all reads through server-side API routes first, since the decryption key can't be on the client. Affects: dashboard, stats, settings, streak calendar, weekly digest cron, chat context, transition coach context.
- [ ] **Add `DATA_ENCRYPTION_KEY` to Vercel env vars** — Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and add to Vercel project settings.
- [ ] **Run data migration for existing records** — Existing messages, user_facts, and push_subscriptions are unencrypted. Need a one-time migration script to encrypt them in place. The decrypt function handles both formats (migration-safe), but old data should be encrypted for full coverage.
- [ ] **Enable MFA in Supabase dashboard** — The enrollment UI is built, but TOTP MFA must also be enabled in the Supabase project settings (Authentication → Multi-Factor Authentication) for the API calls to work.

### P2 — Validation & Robustness

- [ ] **Add server-side validation for supplement logs** — Currently doesn't verify supplement exists in `supplements_reference` table. Users could log nonexistent supplements.
- [ ] **Add server-side validation for medication logs** — Doesn't validate medication name against the known medications list. Could accept invalid medication entries.
- [ ] **Add server-side validation for injection schedule** — No verification that `injection_day` is a valid day name or `injection_time` is a valid label. Should reject bad values.
- [ ] **Add duplicate food log prevention** — Users can log the exact same meal multiple times. Should have soft dedup (same description + timestamp within a window).

### P3 — UX Gaps

- [ ] **Add timezone selector to Settings page** — The `timezone` column exists on profiles and is used by pre-shot-reminders (defaults to `America/Chicago`), but there's no UI for users to set their timezone. Users outside Central time get wrong reminder timing.
- [ ] **Add offline data sync for PWA** — PWA caches pages but log submissions require connectivity. Queuing logs locally and syncing when back online would make the app usable on spotty connections.
- [ ] **Surface Trish coach outside maintenance page** — Two coach personas exist (Nova + Trish) but Trish is only accessible via the maintenance page. Users in active tapering might benefit from Trish being accessible from the dashboard or chat page.

### P4 — Scale & Hardening

- [ ] **Move waitlist rate limit from in-memory to Redis** — Currently uses in-memory store that resets on every deploy. Fine for now but will fail under any real traffic spike. Move to Upstash Redis like the other rate limits.
- [ ] **Add structured logging** — Replace remaining console.log/console.error calls with a structured logger (e.g., Pino) that outputs JSON for better observability in Vercel logs.
- [ ] **Add error monitoring** — No Sentry or equivalent. Production errors are only visible in Vercel function logs which are ephemeral. Critical for a health app where silent failures have real consequences.

### Future Enhancements (Not Yet Started)

- [ ] Social/OAuth login (Google, Apple) — reduce signup friction
- [ ] Photo-based food logging (snap a picture → AI estimates macros)
- [ ] Provider sharing/export (PDF summary for doctor visits)
- [ ] Community features (anonymized progress sharing, support groups)
- [ ] Apple Health / Google Fit integration
- [ ] Multi-language support
- [ ] A/B testing framework for onboarding flow optimization
- [ ] Analytics dashboard (user retention, feature adoption, churn signals)

---

## Architecture Notes

**Tech Stack:** Next.js 16.2.3 (App Router) · TypeScript 5 · React 19 · Tailwind CSS 4 · Supabase (Postgres + Auth + RLS) · Claude Sonnet 4 · Resend · web-push · Upstash Redis · Recharts 3.8 · Framer Motion 12 · Vercel

**Database:** 23 tables across user profiles, conversations/messages, 8 log types, plans (meal/workout/tapering), push subscriptions, savings profiles, reference data (GLP-1 knowledge, supplements), and waitlist.

**Deployment:** Vercel with 5 cron jobs configured (2 implemented, 3 pending).

**Dev Stats:** 94 commits across 21 days of development, single main branch, launched April 6, 2026.
