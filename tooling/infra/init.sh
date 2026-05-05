#!/usr/bin/env bash
# tooling/infra/init.sh — Provision a fresh Railway project for this monorepo.
#
# Idempotent: safe to re-run. Skips anything that already exists.
#
# Prerequisites:
#   npm install -g @railway/cli
#   git remote add origin <your-repo>   # repo must exist on GitHub
#
# Authentication:
#   railway login
#
# Usage:
#   pnpm infra:init [project-name]      # defaults to current directory name

set -euo pipefail

PROJECT_NAME="${1:-${PWD##*/}}"
ENVIRONMENTS=("dev" "staging" "production")
SERVICES=("api" "web" "marketing")

# ---------- preflight ----------

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "✗ missing: $1" >&2; exit 1; }
}
require railway
require git

if ! railway whoami >/dev/null 2>&1; then
  echo "✗ not logged in. Run: railway login" >&2
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "✗ run from repo root (no .git/ found)" >&2
  exit 1
fi

echo "→ Provisioning Railway project: $PROJECT_NAME"

# ---------- project ----------
# Railway CLI v4 stores the project link in ~/.railway/config.json (keyed by
# absolute path), NOT in .railway/config.json inside the repo.

_project_linked() {
  local cfg="$HOME/.railway/config.json"
  [ -f "$cfg" ] && python3 - <<PY
import json, sys
cfg = json.load(open("$cfg"))
sys.exit(0 if "$(pwd)" in cfg.get("projects", {}) else 1)
PY
}

if _project_linked; then
  echo "  ✓ project already linked"
else
  railway init -n "$PROJECT_NAME"
fi

# ---------- environments ----------
# Railway auto-creates 'production' on new projects. Attempt creation and
# silently ignore "already exists" errors.

for env in "${ENVIRONMENTS[@]}"; do
  railway environment new "$env" 2>/dev/null \
    && echo "  + created environment '$env'" \
    || echo "  ✓ environment '$env' already exists"
done

# ---------- services and databases ----------
# Services and databases are project-level in Railway (shared across environments).
# We add them once here; per-environment variable references are wired below.

# ── Postgres ──────────────────────────────────────────────────────────────────
if railway variables --service postgres >/dev/null 2>&1; then
  echo "  ✓ Postgres present"
else
  echo "  + adding Postgres"
  railway add --database postgres 2>/dev/null \
    || echo "  ! Postgres: add manually via dashboard (New → Database → PostgreSQL)"
fi

# ── Valkey ────────────────────────────────────────────────────────────────────
# 'railway add --database' only supports postgres/mysql/redis/mongo in CLI v4.
# Valkey must be added via the dashboard: New → Database → Add a Template → Valkey
if railway variables --service valkey >/dev/null 2>&1; then
  echo "  ✓ Valkey present"
else
  echo "  ! Valkey: add manually via dashboard (New → Database → Add a Template → Valkey)"
fi

# ── Bucket (S3-compatible object storage) ─────────────────────────────────────
# Bucket is not listable by service name via CLI — Railway auto-injects its vars
# (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL, AWS_DEFAULT_REGION,
# AWS_S3_BUCKET_NAME) directly into connected services.
# Add via dashboard: New → Database → Bucket
echo "  ! Bucket: add manually via dashboard (New → Database → Bucket) if not already present"

# ── App service shells ────────────────────────────────────────────────────────
for svc in "${SERVICES[@]}"; do
  if railway variables --service "$svc" >/dev/null 2>&1; then
    echo "  ✓ service '$svc' exists"
  else
    echo "  + creating service '$svc'"
    railway add --service "$svc" 2>/dev/null \
      || echo "    ! could not auto-create '$svc' — add via dashboard"
  fi
done

# ---------- wire variable references per environment -------------------------
# Variable categories:
#
# 1. PRIVATE NETWORK refs (${{Service.VAR}}) — resolved by Railway at deploy time,
#    inside the running container only. Not available during Docker build.
#
# 2. CROSS-SERVICE refs (${{service.RAILWAY_PUBLIC_DOMAIN}}) — resolve per-env
#    automatically; work across dev/staging/production/PR environments.
#
# 3. PER-SERVICE SECRETS — set manually per environment in the Railway dashboard
#    (BETTER_AUTH_SECRET, RESEND_API_KEY, etc.). See the checklist below.

for env in "${ENVIRONMENTS[@]}"; do
  echo ""
  echo "→ [$env] Wiring variable references..."

  # ── api: all vars — private network, cross-service, and shared refs ──────────
  railway variables \
    --service api \
    --environment "$env" \
    --set 'DATABASE_URL=${{postgres.DATABASE_URL}}' \
    --set 'VALKEY_URL=${{valkey.VALKEY_URL}}' \
    --set 'BETTER_AUTH_URL=https://${{api.RAILWAY_PRIVATE_DOMAIN}}' \
    --set 'TRUSTED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}' \
    --set 'BETTER_AUTH_SECRET=${{shared.BETTER_AUTH_SECRET}}' \
    --set 'NODE_ENV=${{shared.NODE_ENV}}' \
    --set 'LOG_LEVEL=${{shared.LOG_LEVEL}}' \
    --set 'RESEND_API_KEY=${{shared.RESEND_API_KEY}}' \
    --set 'RESEND_FROM_EMAIL=${{shared.RESEND_FROM_EMAIL}}' \
    --set 'RESEND_WEBHOOK_SECRET=${{shared.RESEND_WEBHOOK_SECRET}}' \
    --set 'STRIPE_SECRET_KEY=${{shared.STRIPE_SECRET_KEY}}' \
    --set 'STRIPE_WEBHOOK_SECRET=${{shared.STRIPE_WEBHOOK_SECRET}}' \
    --set 'STRIPE_CONNECT_CLIENT_ID=${{shared.STRIPE_CONNECT_CLIENT_ID}}' \
    --set 'BIRD_ACCESS_KEY=${{shared.BIRD_ACCESS_KEY}}' \
    --set 'BIRD_WORKSPACE_ID=${{shared.BIRD_WORKSPACE_ID}}' \
    --set 'BIRD_SMS_CHANNEL_ID=${{shared.BIRD_SMS_CHANNEL_ID}}' \
    --set 'BIRD_WEBHOOK_SECRET=${{shared.BIRD_WEBHOOK_SECRET}}' \
    --set 'VAPID_PUBLIC_KEY=${{shared.VAPID_PUBLIC_KEY}}' \
    --set 'VAPID_PRIVATE_KEY=${{shared.VAPID_PRIVATE_KEY}}' \
    --set 'VAPID_SUBJECT=${{shared.VAPID_SUBJECT}}' \
    2>/dev/null && echo "    ✓ API service vars wired" \
    || echo "    ! Could not set API vars via CLI — see manual steps below"

  # Note: Bucket auto-injects AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
  # AWS_ENDPOINT_URL, AWS_DEFAULT_REGION, AWS_S3_BUCKET_NAME into all services.

  # ── web: build-time VITE_API_URL ─────────────────────────────────────────────
  railway variables \
    --service web \
    --environment "$env" \
    --set 'VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}' \
    2>/dev/null && echo "    ✓ web service vars wired" \
    || echo "    ! Could not set web vars via CLI — see manual steps below"
done

# Switch back to dev as the default working environment
railway environment dev 2>/dev/null || true

# ---------- manual checklist ----------

cat <<'CHECKLIST'

✓ Provisioning complete.

─────────────────────────────────────────────────────────────────────────
Manual steps in the Railway dashboard:
─────────────────────────────────────────────────────────────────────────

1. CONNECT GITHUB REPO
   For each service (api, web, marketing) in each environment:
   Settings → Source → Connect GitHub repo
   Branch tracking:
     dev         →  main
     staging     →  staging
     production  →  production

2. WAIT FOR CI  —  disable on ALL environments

   Leave Wait for CI DISABLED everywhere.
   Quality is enforced at merge time by GitHub branch protection on main,
   which requires pr.yml checks to pass before a PR can merge.

   Flow:
     PR opened  → Railway deploys PR env immediately
                → pr.yml runs CodeQL + Trivy + lint/typecheck in parallel
                → e2e runs after deploy (deployment_status)
                → branch protection blocks merge until quality checks pass
     Merge      → Railway deploys dev immediately → e2e runs after
     Release    → Railway deploys staging/prod immediately → e2e runs after

   e2e is always post-deploy verification, never a deploy prerequisite.

3. PR ENVIRONMENTS
   Project Settings → enable PR Environments

4. GITHUB BRANCH PROTECTION (repo → Settings → Branches → main)
   Required status checks before merging:
     quality / Lint & Typecheck
     codeql / CodeQL
     trivy / Trivy Container Scan (api)
     trivy / Trivy Container Scan (web)
     trivy / Trivy Container Scan (marketing)
   Require pull request before merging: yes
   Require review: recommended

5. ENVIRONMENT-LEVEL SHARED VARIABLES
   Railway dashboard: environment → Settings → Shared Variables
   Visible to ALL services. The Railway CLI cannot set these — use the dashboard.

   Third-party credentials (same across services, differ per environment):
     NODE_ENV              development  (dev)  |  production  (staging/prod)
     LOG_LEVEL             debug        (dev)  |  info        (staging/prod)
     RESEND_API_KEY        re_...
     RESEND_FROM_EMAIL     notifications@yourdomain.com
     STRIPE_SECRET_KEY     sk_test_... (dev+staging) | sk_live_... (production)
     STRIPE_WEBHOOK_SECRET whsec_...
     STRIPE_CONNECT_CLIENT_ID  ca_...
     BIRD_ACCESS_KEY       (when SMS live)
     BIRD_WORKSPACE_ID     (when SMS live)
     BIRD_SMS_CHANNEL_ID   (when SMS live)
     BIRD_WEBHOOK_SECRET   (when SMS live)
     VAPID_PUBLIC_KEY      (when push live)
     VAPID_PRIVATE_KEY     (when push live)
     VAPID_SUBJECT         (when push live)
     RESEND_WEBHOOK_SECRET (when bounce handling live)

   NOTE: if you previously set any of these on a specific service, remove them
   from the service — service-level vars shadow shared vars.

6. VARIABLE SCOPES SUMMARY

   Auto-wired on api service by this script:
     DATABASE_URL      ${{postgres.DATABASE_URL}}           private network
     VALKEY_URL        ${{valkey.VALKEY_URL}}               private network
     BETTER_AUTH_URL   https://${{api.RAILWAY_PRIVATE_DOMAIN}}  private network
     TRUSTED_ORIGINS   https://${{web.RAILWAY_PUBLIC_DOMAIN}}  cross-service ref
     BETTER_AUTH_SECRET  REPLACE_ME  ← fill this in per-environment

   Auto-wired on web service by this script:
     VITE_API_URL      https://${{api.RAILWAY_PUBLIC_DOMAIN}}  cross-service ref

   Auto-injected by Bucket (no action needed):
     AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
     AWS_ENDPOINT_URL, AWS_DEFAULT_REGION, AWS_S3_BUCKET_NAME

   Set via dashboard → environment → Shared Variables (CLI cannot set these):
     NODE_ENV, LOG_LEVEL, RESEND_*, STRIPE_*, BIRD_*, VAPID_*

   GitHub Actions secrets: none required.
     release.yml uses the built-in GITHUB_TOKEN (permissions: contents: write).
     staging/production branches must NOT be protected so the bot can push.

7. CUSTOM DOMAINS (staging + production only)
   Settings → Networking → Add custom domain
   Copy the CNAME target to your DNS provider.
   PR and dev environments use auto-generated .up.railway.app URLs.

Then open a PR to trigger the first deploy. Railway deploys immediately;
e2e runs after. Merge when quality checks and e2e both pass.

CHECKLIST
