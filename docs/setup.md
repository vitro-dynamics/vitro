# Setup Checklist

Everything you need to obtain and configure before deploying vitro. Work through this top to bottom on first setup.

---

## 1. GitHub

- [ ] Create repo at github.com (or use the existing one)
- [ ] Add `PROMOTE_TOKEN` repository secret
  - Go to repo → Settings → Secrets and variables → Actions
  - Create a fine-grained PAT with **Contents: Read and Write** on `staging` and `production` branches
  - This is what `release.yml` uses to promote releases — `GITHUB_TOKEN` can't push to protected branches
- [ ] Set branch protection on `main`:
  - Require pull request
  - Require status checks: `quality / Lint & Typecheck`, `codeql / CodeQL`, `trivy / Trivy Container Scan (api/web/marketing)`
- [ ] Create protected branches `staging` and `production` (Railway watches these)
- [ ] Allow the `github-actions[bot]` to push to `staging` and `production`

---

## 2. Railway

- [ ] Create a Railway account at [railway.app](https://railway.app)
- [ ] Install Railway CLI: `npm install -g @railway/cli`
- [ ] Log in: `railway login`
- [ ] Run provisioning script from repo root:
  ```bash
  pnpm infra:init
  ```
  This creates the project, three environments (dev/staging/production), Postgres, and service shells.
  Variable references (`DATABASE_URL`, `VALKEY_URL`, `AWS_*`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `VITE_API_URL`) are wired automatically.
- [ ] Complete the manual steps printed by the script — in the Railway dashboard:
  - **Add Valkey**: New → Database → Add a Template → Valkey
  - **Add Bucket**: New → Database → Bucket
  - Connect GitHub repo to each service
  - Set branch tracking: dev → `main`, staging → `staging`, production → `production`
  - Enable **Wait for CI** on PR environments and `dev`; leave disabled on `staging` and `production`
  - Enable **PR Environments** at the project level

---

## 3. Better Auth secrets

Generate one secret per environment — they must be different:

```bash
openssl rand -hex 32   # dev
openssl rand -hex 32   # staging
openssl rand -hex 32   # production
```

Set on each environment's API service in Railway.
**Use variable references** (not hardcoded URLs) so PR environments work automatically:

| Variable | Value |
|---|---|
| `BETTER_AUTH_SECRET` | 32-byte hex string (unique per env, see below) |
| `BETTER_AUTH_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
| `TRUSTED_ORIGINS` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |

And on the web service build args:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |

---

## 4. Resend (email)

- [ ] Create account at [resend.com](https://resend.com)
- [ ] Add your sending domain: Resend → Domains → Add Domain
- [ ] Add DNS records Resend provides (SPF, DKIM, DMARC) — your DNS provider
- [ ] Wait for domain verification (usually < 10 min)
- [ ] Create an API key: Resend → API Keys → Create API Key
- [ ] (Optional) Set up inbound webhook for bounces/complaints:
  - Webhook URL: `https://api.example.com/webhooks/resend`
  - Events to subscribe: `email.bounced`, `email.complained`, `email.delivered`

Set on API service in Railway:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | `re_...` from Resend dashboard |
| `RESEND_FROM_EMAIL` | `notifications@yourdomain.com` (must match verified domain) |

---

## 5. Stripe Connect (payments)

- [ ] Create a Stripe account at [stripe.com](https://stripe.com)
- [ ] Complete identity verification (required for payouts)
- [ ] Enable Connect: Dashboard → Settings → Connect settings → Enable Connect
- [ ] Register your Connect platform:
  - Dashboard → Connect → Settings → Platform profile
  - Set redirect URI: `https://api.example.com/stripe/oauth/callback`
- [ ] Get credentials:
  - `STRIPE_SECRET_KEY` — Dashboard → Developers → API keys → Secret key
  - `STRIPE_CONNECT_CLIENT_ID` — Dashboard → Connect → Settings → Client ID (starts with `ca_`)
- [ ] Create a webhook endpoint:
  - Dashboard → Developers → Webhooks → Add endpoint
  - URL: `https://api.example.com/webhooks/stripe`
  - Events to listen for:
    - `invoice.payment_failed`
    - `invoice.payment_succeeded`
    - `account.updated` (Connect — seller onboarding)
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
  - Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`

Set on API service in Railway:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (use `sk_test_...` for dev/staging) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from webhook endpoint |
| `STRIPE_CONNECT_CLIENT_ID` | `ca_...` |

> Use separate Stripe accounts for test and production, or use test mode keys for dev/staging and live keys for production. Never mix.

---

## 6. Bird (SMS — formerly MessageBird)

- [ ] Create account at [bird.com](https://bird.com)
- [ ] Create a Workspace
- [ ] Create an SMS channel:
  - Channels → SMS → Create channel
  - Purchase or port a phone number, or configure a shared sender ID
- [ ] Get credentials from the channel settings:

| Variable | Where to find it |
|---|---|
| `BIRD_ACCESS_KEY` | Workspace → Settings → Access Keys → Create key |
| `BIRD_WORKSPACE_ID` | Workspace → Settings → Workspace ID |
| `BIRD_SMS_CHANNEL_ID` | Channels → your SMS channel → Channel ID |

> Phone numbers sent to this channel must be E.164 format (`+15551234567`).
> The "from" number is configured on the channel — not in the API payload.

---

## 7. DNS + Railway custom domains

### Adding a custom domain in Railway

For each service that needs a public domain (api, web, marketing):
1. Railway dashboard → service → **Settings** → **Networking** → **Add custom domain**
2. Enter your domain (e.g. `api.example.com`)
3. Copy the **CNAME target** Railway gives you (something like `vitro-api-production.up.railway.app`)
4. Go to your DNS provider, add a `CNAME` record pointing your domain at that target
5. Railway provisions an SSL certificate automatically once DNS propagates (~1–10 min)

- [ ] `example.com` → marketing (production)
- [ ] `app.example.com` → web (production)
- [ ] `api.example.com` → api (production)
- [ ] `app-staging.example.com` → web (staging)
- [ ] `api-staging.example.com` → api (staging)

> SSL certificates are provisioned automatically by Railway once DNS propagates.
> You do **not** need to set up custom domains for PR environments — they use
> Railway’s auto-generated `*.up.railway.app` URLs.

### PR environment compatibility

PR environments get unique auto-generated URLs per service per PR. Use Railway’s
**variable references** so env vars automatically pick up the right URL in every
environment, including PR envs — no manual updates needed when a PR is opened.

In each service’s Variables tab, set these instead of hardcoding URLs:

**API service variables:**
```
BETTER_AUTH_URL    = https://${{api.RAILWAY_PUBLIC_DOMAIN}}
TRUSTED_ORIGINS    = https://${{web.RAILWAY_PUBLIC_DOMAIN}}
```

**Web service build args (Railway → Settings → Build):**
```
VITE_API_URL       = https://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

Railway evaluates `${{service.VARIABLE}}` per-environment at deploy time. In a
PR env, `${{api.RAILWAY_PUBLIC_DOMAIN}}` resolves to the PR env’s API URL;
in production it resolves to the production API URL. No per-environment
overrides needed.

> `RAILWAY_PUBLIC_DOMAIN` is set automatically by Railway on every service.
> You reference it from another service as `${{service-name.RAILWAY_PUBLIC_DOMAIN}}`.
> The service name is the slug you see in the Railway dashboard (e.g. `api`, `web`).

---

## 8. Expo / EAS Build (mobile)

- [ ] Create an Expo account at [expo.dev](https://expo.dev)
- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Log in: `eas login`
- [ ] From `apps/mobile/`, initialise EAS:
  ```bash
  pnpm --filter @app/mobile exec eas build:configure
  ```
  This creates `eas.json`. Commit it.
- [ ] Run your first development build to verify the setup:
  ```bash
  pnpm --filter @app/mobile exec eas build --profile development --platform ios
  ```

---

## 9. Apple Developer (iOS)

- [ ] Enroll at [developer.apple.com](https://developer.apple.com) — $99/year
- [ ] Create an App ID:
  - Certificates, Identifiers & Profiles → Identifiers → +
  - Bundle ID: `com.vitro.app` (must match `app.json`)
- [ ] EAS handles provisioning profiles and certificates automatically when you run `eas build`
- [ ] For App Store submission: create an app record in App Store Connect

---

## 10. Google Play (Android)

- [ ] Create a developer account at [play.google.com/console](https://play.google.com/console) — $25 one-time
- [ ] Create a new app in Play Console
- [ ] Package name: `com.vitro.app` (must match `app.json`)
- [ ] EAS handles the Android keystore automatically when you run `eas build`
- [ ] For Play Store submission: use `eas submit --platform android`

---

## 11. Final smoke test

After deploying to production:

- [ ] `https://api.example.com/health` returns `{ "status": "ok" }`
- [ ] `https://app.example.com` loads without errors
- [ ] Sign up with a new account — verification email arrives
- [ ] Sign in — session persists across page refreshes
- [ ] Password reset email arrives
- [ ] SSE connection is visible in DevTools → Network → `/api/events` (persistent connection)
- [ ] Stripe Connect onboarding flow loads (when payments are live)
- [ ] SMS sends when user opts in and a notification triggers (when SMS is live)
- [ ] iOS build installs and runs on a real device
- [ ] Android build installs and runs on a real device

---

## Env var summary

All vars in one place for reference. Validated at API boot by Arktype (`apps/api/src/lib/env.ts`).

```
# Required at all times
DATABASE_URL              Railway private URL (auto-set by infra:init)
VALKEY_URL                Railway private URL (auto-set by infra:init)
BETTER_AUTH_SECRET        openssl rand -hex 32 — unique per environment
BETTER_AUTH_URL           https://api[...].example.com
TRUSTED_ORIGINS           https://app[...].example.com
RESEND_API_KEY            re_...
RESEND_FROM_EMAIL         notifications@example.com

# Required when payments go live
STRIPE_SECRET_KEY         sk_live_... / sk_test_...
STRIPE_WEBHOOK_SECRET     whsec_...
STRIPE_CONNECT_CLIENT_ID  ca_...

# Required when SMS goes live
BIRD_ACCESS_KEY
BIRD_WORKSPACE_ID
BIRD_SMS_CHANNEL_ID

# Web app (build-time — set as Railway service variable)
VITE_API_URL              https://api[...].example.com
```
