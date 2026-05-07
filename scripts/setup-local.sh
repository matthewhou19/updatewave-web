#!/usr/bin/env bash
set -euo pipefail

echo "=== UpdateWave Web — Local Setup ==="
echo ""

# ── Check required CLI tools ──────────────────────────────────────────
missing=()

if ! command -v node &>/dev/null; then
  missing+=("node")
fi

if ! command -v npm &>/dev/null; then
  missing+=("npm")
fi

if ! command -v docker &>/dev/null; then
  missing+=("docker (Docker Desktop)")
fi

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: Missing required tools: ${missing[*]}"
  echo "Install Node.js (v20+) from https://nodejs.org"
  echo "Install Docker Desktop from https://www.docker.com/products/docker-desktop"
  exit 1
fi

echo "Node:   $(node --version)"
echo "npm:    $(npm --version)"
echo "Docker: $(docker --version)"

if command -v stripe &>/dev/null; then
  echo "Stripe CLI: $(stripe --version 2>&1 | head -1)"
else
  echo "Stripe CLI: not installed (optional — install from https://stripe.com/docs/stripe-cli)"
fi

echo ""

# ── Environment file ─────────────────────────────────────────────────
if [ -f .env.local ]; then
  echo ".env.local already exists — skipping copy."
else
  cp .env.example .env.local
  echo "Created .env.local from .env.example (defaults to local Supabase)."
fi

# ── Install dependencies ─────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
npm install
echo ""

# ── Start local Supabase stack ───────────────────────────────────────
echo "Starting local Supabase (Docker)..."
echo "  First run may take 5-10 minutes to pull container images."
npx supabase start
echo ""

# ── Initialise local DB ──────────────────────────────────────────────
echo "Applying schema + migrations + seed..."
bash scripts/db-init.sh --drop
echo ""

# ── Next steps ────────────────────────────────────────────────────────
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. (Optional) Add Stripe test keys to .env.local for checkout flows"
echo "  2. Start dev server:        npm run dev"
echo "  3. View test pages:"
echo "       http://localhost:3000/browse/a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ"
echo "       http://localhost:3000/reveals/a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ"
echo "       http://localhost:3000/login           (mailpit catches the magic link)"
echo "  4. View auth emails:        http://127.0.0.1:54324 (mailpit)"
echo "  5. Stop Supabase later:     npm run supabase:stop"
echo ""
