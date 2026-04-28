# Operations Runbook

The "what to do when" guide for NovuraHealth. Stick to it on stressful days so muscle memory beats panic. Last reviewed: 2026-04-27.

---

## 1. Run locally

Prereqs: Node 20+, a populated `.env.local` (copy from `.env.example`).

```bash
npm install
npm run dev          # http://localhost:3000
```

Other commands worth knowing:

```bash
npm run build        # production build — run before pushing risky changes
npm run lint         # eslint
```

If `npm run dev` boots but pages 500 immediately, the most common cause is a missing or wrong env var. Check the server log for `process.env.X is undefined` style errors first.

---

## 2. Trigger a cron job manually

Every `/api/cron/*` route requires a bearer token equal to `CRON_SECRET`. To fire one by hand:

```bash
# Local
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly-digest

# Production
curl -H "Authorization: Bearer $CRON_SECRET" https://novurahealth.com/api/cron/weekly-digest
```

Schedules (from `vercel.json`):

| Path | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/injection-reminders` | every 5 min | Push when an injection is due |
| `/api/cron/pre-shot-reminders`  | hourly | Day-before injection reminders |
| `/api/cron/streak-risk-check`   | daily 18:00 | Warn before a logging streak breaks |
| `/api/cron/weekly-digest`       | Sun 20:00 | Email weekly progress summary |
| `/api/cron/cleanup`             | daily 03:00 | Housekeeping |

To verify Vercel actually fired one: **Vercel dashboard → Project → Logs → filter on the path**. Expect a 200 response within seconds.

---

## 3. Rotate keys

Why you'd rotate: pre-launch hygiene, suspected leak, employee/contractor offboarding, or a routine quarterly cycle.

> **Order matters.** For each key: (1) generate new value at the source, (2) add to `.env.local` AND Vercel project env vars (Production + Preview + Development), (3) redeploy or restart, (4) verify the app still works, (5) revoke the old key.
>
> Skipping step 4 is how outages happen.

### Supabase service role key

1. Supabase dashboard → **Project Settings → API** → click "Generate new service role JWT".
2. Update `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel.
3. Trigger a Vercel redeploy (push any commit, or **Deployments → ⋮ → Redeploy**).
4. Verify: log in to the app and load the dashboard. Server-side queries (chat, logs, plans) all use this key.
5. **There is no "old" version to revoke** — Supabase replaces it on rotation. Done.

### Supabase anon / publishable keys

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is meant to be exposed to the browser, but rotate it if you have any reason to believe RLS rules were bypassed or misconfigured at any point.

1. Supabase dashboard → **Project Settings → API** → rotate anon key.
2. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and Vercel.
3. Redeploy.
4. Verify: signup/login flow and any client-side Supabase call (e.g., the homepage's `supabase.auth.getUser()`).

### Anthropic API key

1. https://console.anthropic.com → **API Keys** → "Create Key" with a sensible name (`novura-prod-2026-04`).
2. Update `ANTHROPIC_API_KEY` in Vercel and `.env.local`.
3. Redeploy.
4. Verify: send any chat message — should get a coach reply within a few seconds.
5. **Revoke the old key** in the Anthropic console.

### Upstash Redis token

1. Upstash console → your DB → **REST API** → "Reset Token".
2. Update `UPSTASH_REDIS_REST_TOKEN` in Vercel and `.env.local`.
3. Redeploy.
4. Verify: hit any rate-limited endpoint (chat is easiest). Old token stops working immediately, so a successful chat reply confirms the new token is loaded.

### Resend API key

1. https://resend.com/api-keys → "Create API Key" with sending domain access.
2. Update `RESEND_API_KEY` in Vercel and `.env.local`.
3. Redeploy.
4. Verify: trigger `/api/cron/weekly-digest` manually (see §2) and confirm the digest email lands.
5. **Delete the old key** in Resend.

### Web Push (VAPID)

⚠️ **Rotating VAPID keys invalidates every existing push subscription.** Users will need to re-enable notifications. Don't rotate casually.

If you must:

```bash
npx web-push generate-vapid-keys
```

1. Update `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, AND `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel and `.env.local`.
2. Redeploy.
3. In SQL: clear `push_subscriptions` for affected users (or all users — old endpoints will fail anyway).
4. Send a notice to users that they need to re-enable push.

### Cron secret

Used to authenticate Vercel Cron requests to `/api/cron/*`.

```bash
# Generate a fresh secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

1. Update `CRON_SECRET` in Vercel.
2. Redeploy.
3. Verify each cron path manually with a curl using the new secret. Vercel Cron uses the env var automatically.

---

## 4. Common incidents

### Chat returns "Nova is temporarily unavailable"

Almost always one of: Anthropic API outage, expired/wrong `ANTHROPIC_API_KEY`, or hit rate limit on Anthropic's side.

1. Check Anthropic status: https://status.anthropic.com
2. Check Vercel logs for the chat route — look for `ANTHROPIC ERROR:` lines.
3. If keys look healthy, try a curl directly to `https://api.anthropic.com/v1/messages` from your machine to isolate (network vs key vs Anthropic).

### Rate limiter rejecting all chat requests

Upstash is unreachable → `checkRateLimit` returns false to fail closed. Check:

1. Upstash dashboard for instance health.
2. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel match what Upstash shows.
3. If Upstash is down, decide: temporarily disable rate limiting (push a hot fix that returns `success: true` from `checkRateLimit`) vs. ride it out. Don't ride it out — the chat endpoint is your most expensive route.

### Cron job not firing

1. Vercel → Project → **Logs** → filter on the cron path. No logs at all = Vercel Cron isn't scheduled. Confirm `vercel.json` is in the repo root and the latest deploy succeeded.
2. Logs showing 401 = `CRON_SECRET` mismatch between Vercel env vars and the cron header. Vercel sets the header automatically from the env var, so this is almost always a typo or a stale env var on a recent deploy.

### "I think a key leaked"

Assume the worst and rotate that key now (§3). Don't wait to confirm.

After rotating:

1. Check git history for the leaked value: `git log -p | grep -F 'leaked-prefix-here'`. If found, force-push history rewrite is messy — the saner move is treat the secret as compromised and stay rotated.
2. Check Anthropic / Supabase / Upstash / Resend dashboards for unfamiliar usage spikes since the suspected leak.
3. Document what happened in a one-pager so it doesn't repeat.

### Database query returns empty / wrong data

Don't trust client-side caching. Open the Supabase **Table Editor**, query the table directly (with the user's ID), and compare against what the app shows. If the row is missing in the table, look at the most recent insert/upsert in your code path — RLS misconfig is the usual culprit.

---

## 5. Pre-launch checklist

Before public beta:

- [ ] Rotate every key in §3 once, so launch keys are fresh and the rotation muscle memory is established.
- [ ] Confirm `.env.local` is NOT in `git status` and NOT in any commit (`git log --all --full-history -- .env.local` should return empty).
- [ ] Add Zod validation to every POST endpoint that accepts user data (currently done: `/api/chat`, `/api/readiness-assessment`).
- [ ] Add at least one automated test on the medication-logging flow.
- [ ] Verify each cron job runs successfully in production (manually trigger §2).
- [ ] Confirm Supabase RLS policies are enabled on every table that holds user data.
- [ ] Set up alerting for: Anthropic 5xx rate, Supabase connection errors, Upstash unavailability.
- [ ] Privacy policy and terms of use are live and linked from signup.
- [ ] `audit_logs` table created and populated on every delete/modify of user health data.
