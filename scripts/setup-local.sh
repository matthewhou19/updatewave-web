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

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: Missing required tools: ${missing[*]}"
  echo "Install Node.js (v20+) from https://nodejs.org"
  exit 1
fi

echo "Node:  $(node --version)"
echo "npm:   $(npm --version)"

if command -v supabase &>/dev/null; then
  echo "Supabase CLI: $(supabase --version 2>&1 | head -1)"
else
  echo "Supabase CLI: not installed (optional — install via 'npm i -g supabase')"
fi

if command -v stripe &>/dev/null; then
  echo "Stripe CLI:   $(stripe --version 2>&1 | head -1)"
else
  echo "Stripe CLI:   not installed (optional — install from https://stripe.com/docs/stripe-cli)"
fi

echo ""

# ── Environment file ─────────────────────────────────────────────────
if [ -f .env.local ]; then
  echo ".env.local already exists — skipping copy."
else
  if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "Created .env.local from .env.example."
    echo ""
    echo "  >>> Open .env.local and fill in your Supabase + Stripe keys <<<"
    echo ""
  else
    echo "WARNING: .env.example not found. Create .env.local manually with:"
    echo "  NEXT_PUBLIC_SUPABASE_URL="
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY="
    echo "  SUPABASE_SERVICE_ROLE_KEY="
    echo "  STRIPE_SECRET_KEY="
    echo "  STRIPE_WEBHOOK_SECRET="
    echo "  NEXT_PUBLIC_BASE_URL=http://localhost:3000"
  fi
fi

# ── Install dependencies ─────────────────────────────────────────────
echo "Installing dependencies..."
npm install
echo ""

# ── Next steps ────────────────────────────────────────────────────────
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Fill in .env.local with your Supabase + Stripe keys"
echo "  2. Run the database schema: paste supabase/schema.sql into Supabase SQL Editor"
echo "  3. (Optional) Seed test data: npm run db:seed"
echo "  4. Start dev server: npm run dev"
echo "  5. (Optional) Listen for Stripe webhooks: npm run stripe:listen"
echo ""
