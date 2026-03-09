# INFRASTRUCTURE.md — LeadPulse Intelligence Platform
## Deployment, Environment Variables, Service Setup, Cost Optimization
## Version: 1.0 | March 2026

---

> **AGENT INSTRUCTION:** Read this file when:
> - Setting up the project for the first time
> - Configuring environment variables
> - Writing wrangler.toml or deployment config
> - Working on DB connection or Redis connection code
> - Deploying any service

---

## 1. COST-OPTIMIZED ARCHITECTURE DECISION

You (the developer) already have: Firebase, Cloudflare, Vercel.
This is the optimal stack for a startup building at world-class quality with minimal burn.

| What | Where | Why | Phase 1 Cost |
|------|-------|-----|-------------|
| REST API | Cloudflare Workers | 100K req/day free, zero cold starts, Hono built for it | $0 → $5/mo |
| Database | Neon Serverless Postgres | Scales to zero, HTTP driver for Workers, free 0.5GB | $0 → $19/mo |
| Cache | Upstash Redis | REST API (no TCP = works in Workers), free 10K cmd/day | $0 → $5/mo |
| Job Queue | Cloudflare Queues | Built into Workers, 1M msg/month free, no extra service | $0 |
| Frontend | Vercel | Free hobby, auto-deploy, edge network included | $0 |
| Python ML | EC2 t3.micro | Only persistent server needed — Python needs native binaries | $4-9/mo |
| Auth | Firebase Auth | Already have it, free 10K MAU, REST works in Workers | $0 |
| File Storage | Cloudflare R2 | 10GB free, no egress fees (vs S3 which charges egress) | $0 |
| Email | Resend | 3K emails/month free, Cloudflare Workers SDK | $0 |
| Error Tracking | Sentry | Free tier for Phase 1 | $0 |

**Phase 1 total: ~$4-14/month.** All infra is serverless except the EC2 ML box.

---

## 2. ENVIRONMENT VARIABLES — COMPLETE REFERENCE

### apps/api — `.dev.vars` (local) / Wrangler Secrets (production)

```bash
# apps/api/.dev.vars
# LOCAL DEV ONLY — never commit this file (it's in .gitignore)

# ── Database ──────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/leadpulse?sslmode=require"

# ── Cache (Upstash Redis) ─────────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxx..."

# ── Firebase Auth ─────────────────────────────────────────────────
FIREBASE_WEB_API_KEY="AIzaSy..."     # From Firebase console → Project Settings → Web API Key
# (The full Admin SDK is not needed — we verify JWTs via Firebase REST API)

# ── ML Service (EC2) ──────────────────────────────────────────────
ML_SERVICE_URL="http://YOUR_EC2_PUBLIC_IP:8000"
ML_SERVICE_SECRET="generate-a-32-char-secret-string-here"

# ── Enrichment Providers ─────────────────────────────────────────
HUNTER_API_KEY="your-hunter-api-key"           # Phase 1
APOLLO_API_KEY="your-apollo-api-key"           # Phase 2
PDL_API_KEY="your-pdl-api-key"                 # Phase 2
PROXYCURL_API_KEY="your-proxycurl-api-key"     # Phase 2 (LinkedIn)

# ── Verification ─────────────────────────────────────────────────
ZEROBOUNCE_API_KEY="your-zerobounce-key"       # Phase 2
TWILIO_ACCOUNT_SID="ACxxx"                     # Phase 2
TWILIO_AUTH_TOKEN="your-twilio-auth-token"     # Phase 2

# ── Social Platform APIs ─────────────────────────────────────────
REDDIT_CLIENT_ID="your-reddit-client-id"
REDDIT_CLIENT_SECRET="your-reddit-client-secret"
REDDIT_USER_AGENT="LeadPulse/1.0 by u/YOUR_REDDIT_USERNAME"
BLUESKY_IDENTIFIER="yourhandle.bsky.social"
BLUESKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"     # Create in Bluesky settings → App Passwords

# ── CRM OAuth (Phase 2) ──────────────────────────────────────────
HUBSPOT_CLIENT_ID="your-hubspot-client-id"
HUBSPOT_CLIENT_SECRET="your-hubspot-client-secret"
SALESFORCE_CLIENT_ID="your-salesforce-connected-app-id"
SALESFORCE_CLIENT_SECRET="your-salesforce-secret"

# ── Email ─────────────────────────────────────────────────────────
RESEND_API_KEY="re_xxx"

# ── Payments ─────────────────────────────────────────────────────
RAZORPAY_KEY_ID="rzp_live_xxx"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"

# ── App Config ───────────────────────────────────────────────────
FRONTEND_URL="http://localhost:5173"           # In prod: https://app.leadpulse.io
ENCRYPTION_KEY="exactly-32-characters-here!!"  # For encrypting OAuth tokens in DB
NODE_ENV="development"
```

### apps/api — `.dev.vars.example` (commit this, not .dev.vars)

```bash
# apps/api/.dev.vars.example
# Copy this to .dev.vars and fill in values

DATABASE_URL=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
FIREBASE_WEB_API_KEY=""
ML_SERVICE_URL=""
ML_SERVICE_SECRET=""
HUNTER_API_KEY=""
APOLLO_API_KEY=""
PDL_API_KEY=""
PROXYCURL_API_KEY=""
ZEROBOUNCE_API_KEY=""
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
REDDIT_CLIENT_ID=""
REDDIT_CLIENT_SECRET=""
REDDIT_USER_AGENT=""
BLUESKY_IDENTIFIER=""
BLUESKY_APP_PASSWORD=""
HUBSPOT_CLIENT_ID=""
HUBSPOT_CLIENT_SECRET=""
SALESFORCE_CLIENT_ID=""
SALESFORCE_CLIENT_SECRET=""
RESEND_API_KEY=""
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
FRONTEND_URL="http://localhost:5173"
ENCRYPTION_KEY=""
NODE_ENV="development"
```

### apps/ml — `.env`

```bash
# apps/ml/.env  (on EC2 — never commit)
ANTHROPIC_API_KEY="sk-ant-api03-xxx"
ML_SERVICE_SECRET="same-secret-as-api-env-above"
PORT="8000"
```

### apps/web — `.env.local`

```bash
# apps/web/.env.local  (local dev — never commit)
VITE_API_URL="http://localhost:8787"
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="leadpulse-prod.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="leadpulse-prod"
VITE_FIREBASE_STORAGE_BUCKET="leadpulse-prod.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123:web:abc"
```

```bash
# apps/web/.env.production  (commit this — no secrets)
VITE_API_URL="https://leadpulse-api.YOUR_SUBDOMAIN.workers.dev"
VITE_FIREBASE_AUTH_DOMAIN="leadpulse-prod.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="leadpulse-prod"
# Add other non-secret values — API key is set in Vercel dashboard
```

---

## 3. CLOUDFLARE WORKERS — wrangler.toml

```toml
# apps/api/wrangler.toml
name = "leadpulse-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

# ── Queue Bindings ────────────────────────────────────────────────
[[queues.producers]]
binding = "SIGNAL_QUEUE"
queue = "leadpulse-signal-processing"

[[queues.producers]]
binding = "ENRICHMENT_QUEUE"
queue = "leadpulse-enrichment"

[[queues.producers]]
binding = "CRM_SYNC_QUEUE"
queue = "leadpulse-crm-sync"

[[queues.consumers]]
queue = "leadpulse-signal-processing"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 3
dead_letter_queue = "leadpulse-dead-letter"

[[queues.consumers]]
queue = "leadpulse-enrichment"
max_batch_size = 5
max_batch_timeout = 10
max_retries = 3

[[queues.consumers]]
queue = "leadpulse-crm-sync"
max_batch_size = 3
max_batch_timeout = 30
max_retries = 3

# ── R2 Storage ────────────────────────────────────────────────────
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "leadpulse-storage"

# ── Scheduled Triggers (Signal Polling) ──────────────────────────
[triggers]
crons = ["*/30 * * * *"]    # Every 30 minutes — triggers signal poll

# ── Dev Environment ───────────────────────────────────────────────
[env.development]
vars = { NODE_ENV = "development" }

# ── Production Environment ────────────────────────────────────────
[env.production]
vars = { NODE_ENV = "production" }
# Secrets are set via: pnpm wrangler secret put SECRET_NAME
```

---

## 4. FIRST-TIME PROJECT SETUP

### Prerequisites Check

```bash
node --version     # Must be ≥ 22.0.0
pnpm --version     # Must be ≥ 9.0.0
python --version   # Must be = 3.13.x
uv --version       # Must be installed

# Install pnpm if missing
npm install -g pnpm@latest

# Install uv if missing (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
```

### Clone and Install

```bash
git clone https://github.com/YOUR_ORG/leadpulse.git
cd leadpulse

# Install all Node.js dependencies (all apps at once via Turborepo)
pnpm install

# Install Python dependencies for ML service
cd apps/ml && uv sync && cd ../..

# Set up environment files
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
# Edit both files and fill in real values before continuing
```

### Cloudflare Setup (One-Time)

```bash
# Login to Cloudflare
pnpm --filter api exec wrangler login

# Create Queues (run once per environment)
pnpm --filter api exec wrangler queues create leadpulse-signal-processing
pnpm --filter api exec wrangler queues create leadpulse-enrichment
pnpm --filter api exec wrangler queues create leadpulse-crm-sync
pnpm --filter api exec wrangler queues create leadpulse-dead-letter

# Create R2 bucket
pnpm --filter api exec wrangler r2 bucket create leadpulse-storage
```

### Database Setup

```bash
# Make sure DATABASE_URL is set in apps/api/.dev.vars
# Then run migrations:
pnpm --filter api db:migrate

# Seed development data (creates test user + campaign):
pnpm --filter api db:seed

# Open DB GUI (optional):
pnpm --filter api db:studio
```

### Start Development Servers

```bash
# Start everything (Turborepo runs all apps in parallel)
pnpm dev

# This starts:
# API:  http://localhost:8787  (Wrangler dev — emulates CF Workers locally)
# Web:  http://localhost:5173  (Vite)
# ML:   http://localhost:8000  (start manually — see below)

# Start ML service separately:
cd apps/ml
uv run uvicorn main:app --reload --port 8000

# Verify everything is running:
curl http://localhost:8787/health
# → { "status": "ok", "timestamp": "..." }

curl http://localhost:8000/health
# → { "status": "ok", "service": "leadpulse-ml" }
```

---

## 5. DAILY COMMANDS REFERENCE

```bash
# ── Development ───────────────────────────────────────────────────
pnpm dev                              # Start all apps
pnpm --filter api dev                 # API only
pnpm --filter web dev                 # Frontend only

# ── Type Checking ─────────────────────────────────────────────────
pnpm typecheck                        # All apps
pnpm --filter api typecheck           # API only

# ── Testing ───────────────────────────────────────────────────────
pnpm test                             # All apps
pnpm --filter api test                # API tests only
pnpm --filter api test:watch          # Watch mode
pnpm --filter web test                # Frontend tests
cd apps/ml && uv run pytest           # Python tests

# ── Database ──────────────────────────────────────────────────────
pnpm --filter api db:generate -- --name migration-name   # Create migration
pnpm --filter api db:migrate          # Apply pending migrations
pnpm --filter api db:studio           # Open Drizzle Studio GUI

# ── Code Quality ──────────────────────────────────────────────────
pnpm lint                             # All apps
pnpm format                           # Format all files

# ── Deployment ────────────────────────────────────────────────────
pnpm --filter api deploy              # Deploy API to Cloudflare Workers
pnpm --filter web build && vercel --prod  # Deploy frontend to Vercel
```

---

## 6. EC2 ML SERVICE SETUP

### Launch EC2 Instance

```
Instance type:   t3.micro (Phase 1) → t3.small when ML load increases
AMI:             Ubuntu 22.04 LTS
Region:          ap-south-1 (Mumbai) — lowest latency for India users
Spot instance:   Yes (saves 70%) — use On-Demand only if uptime is critical
Storage:         20GB gp3 SSD (minimal)

Security Group:
  Inbound:  Port 8000 — Source: YOUR_CLOUDFLARE_WORKERS_IP (restrict to CF IP ranges)
  Inbound:  Port 22 — Source: YOUR_DEVELOPER_IP/32 only
  Outbound: All traffic (needs to call Anthropic API, etc.)

Key pair: Create and download leadpulse-ml.pem
```

### EC2 Bootstrap Script

```bash
#!/bin/bash
# Run this after SSH into the new EC2 instance

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.13
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update && sudo apt install -y python3.13 python3.13-venv python3.13-dev build-essential

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
echo 'source $HOME/.cargo/env' >> ~/.bashrc

# Install Node.js 22 (for PM2)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Clone repo
git clone https://github.com/YOUR_ORG/leadpulse.git
cd leadpulse/apps/ml

# Install Python dependencies
uv sync

# Download spaCy model
uv run python -m spacy download en_core_web_sm   # Phase 1 (smaller)
# uv run python -m spacy download en_core_web_trf  # Phase 2 (transformer, better NER)

# Create .env
cp .env.example .env
nano .env  # Fill in ANTHROPIC_API_KEY and ML_SERVICE_SECRET

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the command it outputs to enable auto-restart

# Test
curl http://localhost:8000/health
```

### PM2 Config

```javascript
// apps/ml/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'leadpulse-ml',
    script: 'uv',
    args: 'run uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2',
    cwd: '/home/ubuntu/leadpulse/apps/ml',
    env_production: { NODE_ENV: 'production' },
    restart_delay: 3000,
    max_restarts: 10,
    exp_backoff_restart_delay: 100,
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
```

---

## 7. PRODUCTION DEPLOYMENT

### Deploy API to Cloudflare Workers

```bash
# Set all secrets (run once — stored in Cloudflare)
cd apps/api
pnpm wrangler secret put DATABASE_URL
pnpm wrangler secret put UPSTASH_REDIS_REST_URL
pnpm wrangler secret put UPSTASH_REDIS_REST_TOKEN
pnpm wrangler secret put FIREBASE_WEB_API_KEY
pnpm wrangler secret put ML_SERVICE_URL
pnpm wrangler secret put ML_SERVICE_SECRET
pnpm wrangler secret put HUNTER_API_KEY
pnpm wrangler secret put RESEND_API_KEY
pnpm wrangler secret put RAZORPAY_KEY_ID
pnpm wrangler secret put RAZORPAY_KEY_SECRET
pnpm wrangler secret put FRONTEND_URL
pnpm wrangler secret put ENCRYPTION_KEY
# (set all variables from .dev.vars)

# Deploy
pnpm --filter api deploy
# → Deployed to: https://leadpulse-api.YOUR_SUBDOMAIN.workers.dev
```

### Deploy Frontend to Vercel

```bash
# Install Vercel CLI (if not already)
npm install -g vercel

# Link project (first time)
cd apps/web
vercel link

# Set environment variables in Vercel dashboard:
# Settings → Environment Variables → Add:
# VITE_FIREBASE_API_KEY (Production + Preview)
# VITE_FIREBASE_AUTH_DOMAIN
# VITE_FIREBASE_PROJECT_ID
# VITE_FIREBASE_APP_ID
# VITE_API_URL = https://leadpulse-api.YOUR_SUBDOMAIN.workers.dev

# Deploy
vercel --prod
```

### Deploy ML Service Updates

```bash
# SSH into EC2
ssh -i leadpulse-ml.pem ubuntu@YOUR_EC2_IP

# Pull latest code
cd leadpulse && git pull origin main
cd apps/ml

# Update dependencies if pyproject.toml changed
uv sync

# Restart service
pm2 restart leadpulse-ml

# Verify
curl http://localhost:8000/health
```

---

## 8. TURBOREPO CONFIG

```json
// turbo.json (root)
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**", "package.json", "tsconfig.json", "wrangler.toml"],
      "outputs":   ["dist/**", ".wrangler/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**", "test/**", "*.config.*"],
      "outputs":   ["coverage/**"]
    },
    "typecheck": { "dependsOn": ["^build"] },
    "lint":      { "dependsOn": ["^build"] },
    "deploy":    { "dependsOn": ["build", "typecheck", "test"] },
    "db:migrate":  { "cache": false },
    "db:generate": { "cache": false },
    "db:studio":   { "cache": false, "persistent": true }
  }
}
```

```yaml
# pnpm-workspace.yaml (root)
packages:
  - "apps/*"
  - "packages/*"
```

```json
// package.json (root)
{
  "name": "leadpulse",
  "private": true,
  "scripts": {
    "dev":       "turbo dev",
    "build":     "turbo build",
    "test":      "turbo test",
    "typecheck": "turbo typecheck",
    "lint":      "turbo lint",
    "format":    "prettier --write \"**/*.{ts,tsx,md,json}\" --ignore-path .gitignore"
  },
  "devDependencies": {
    "turbo":     "^2.0.0",
    "prettier":  "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.6.0"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=22.0.0", "pnpm": ">=9.0.0" }
}
```

---

## 9. MONTHLY COST TRACKING

### Phase 1 (0-100 users)

| Service | Usage | Cost |
|---------|-------|------|
| Cloudflare Workers | Free tier (100K req/day) | $0 |
| Cloudflare Queues | Free tier (1M msg/mo) | $0 |
| Cloudflare R2 | Free tier (10GB) | $0 |
| Neon Postgres | Free tier (0.5GB, 100 compute hrs) | $0 |
| Upstash Redis | Free tier (10K cmd/day) | $0 |
| Vercel | Free hobby | $0 |
| Firebase Auth | Free tier (10K MAU) | $0 |
| Resend Email | Free tier (3K/mo) | $0 |
| EC2 t3.micro | Spot pricing (~$0.003/hr) | ~$2-4 |
| Domain (leadpulse.io) | Annual | ~$10 |
| Sentry | Free tier | $0 |
| **TOTAL** | | **~$12-14/mo** |

### Phase 2 (100-1,000 users)

| Service | Upgrade trigger | Cost |
|---------|----------------|------|
| Cloudflare Workers | >100K req/day → Paid ($5/mo base) | $5-15 |
| Neon Postgres | >0.5GB or >100 hrs → Launch plan | $19 |
| Upstash Redis | >10K cmd/day → Pay-per-use | $5-15 |
| Vercel | >100GB bandwidth → Pro | $20 |
| EC2 t3.micro → t3.small | More ML load | $15 |
| Resend Email | >3K/mo → Starter | $20 |
| Sentry | >5K errors/mo → Team | $26 |
| **TOTAL** | | **~$110-130/mo** |

### Phase 3 (1,000+ users)

| Service | Scale config | Cost |
|---------|-------------|------|
| Cloudflare Workers | High usage | $20-50 |
| Neon Postgres | Scale plan ($69/mo) | $69 |
| Upstash Redis | Pro plan | $30 |
| Vercel | Pro | $20 |
| EC2 t3.medium × 2 | Handle ML load | $60 |
| Resend | Business | $50 |
| Sentry | Team | $26 |
| **TOTAL** | | **~$275-305/mo** |
