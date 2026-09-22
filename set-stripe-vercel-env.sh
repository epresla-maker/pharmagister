#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PROJECT_NAME="pharmagister"
PROJECT_FILE=".vercel/project.json"
REQUIRED_VARS=(
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "NEXT_PUBLIC_APP_URL"
)

TARGETS=("production")
if [[ "${1:-}" == "--all" ]]; then
  TARGETS=("development" "preview" "production")
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "ERROR: vercel CLI is not installed."
  exit 1
fi

if [[ ! -f ".env.local" ]]; then
  echo "ERROR: .env.local not found in project root."
  exit 1
fi

if [[ -f "$PROJECT_FILE" ]]; then
  project_name=$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$PROJECT_FILE','utf8'));console.log(p.projectName||'');")
  if [[ -n "$project_name" && "$project_name" != "$EXPECTED_PROJECT_NAME" && "${ALLOW_ANY_PROJECT:-0}" != "1" ]]; then
    echo "ERROR: linked Vercel project is '$project_name', expected '$EXPECTED_PROJECT_NAME'."
    echo "Run: vercel link"
    echo "Or override once with: ALLOW_ANY_PROJECT=1 ./set-stripe-vercel-env.sh"
    exit 1
  fi
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "ERROR: Vercel login is required. Run: vercel login"
  exit 1
fi

# Load variables from .env.local
set -a
source .env.local
set +a

for key in "${REQUIRED_VARS[@]}"; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "ERROR: missing $key in .env.local"
    exit 1
  fi

done

if [[ "${STRIPE_SECRET_KEY}" == sk_test_your_* || "${STRIPE_SECRET_KEY}" == sk_live_your_* ]]; then
  echo "ERROR: STRIPE_SECRET_KEY is still placeholder."
  exit 1
fi

if [[ "${STRIPE_WEBHOOK_SECRET}" == whsec_your_* ]]; then
  echo "ERROR: STRIPE_WEBHOOK_SECRET is still placeholder."
  exit 1
fi

echo "Updating Stripe env vars in Vercel..."
for target in "${TARGETS[@]}"; do
  echo "Target: $target"
  for key in "${REQUIRED_VARS[@]}"; do
    value="${!key}"
    vercel env rm "$key" "$target" --yes >/dev/null 2>&1 || true
    printf "%s" "$value" | vercel env add "$key" "$target" >/dev/null
    echo "  OK $key"
  done

done

echo "Done."
echo "Webhook endpoint in Stripe should be: ${NEXT_PUBLIC_APP_URL%/}/api/payments/stripe-webhook"
