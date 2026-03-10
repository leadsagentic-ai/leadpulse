// ── Intent type weights (MASTER_CONTEXT section 7) ────────────────────────────
const INTENT_WEIGHTS: Record<string, number> = {
  BUYING_INTENT:       1.0,
  PAIN_SIGNAL:         0.8,
  COMPARISON_INTENT:   0.7,
  HIRING_INTENT:       0.5,
  ANNOUNCEMENT_INTENT: 0.3,
}

// ── Platform quality scores ────────────────────────────────────────────────────
const PLATFORM_SCORES: Record<string, number> = {
  linkedin: 10,
  reddit:   8,
  github:   7,
  bluesky:  6,
  threads:  5,
  mastodon: 4,
}

// ── Score tier thresholds ──────────────────────────────────────────────────────
const HOT_THRESHOLD     = 80
const WARM_THRESHOLD    = 60
const COOL_THRESHOLD    = 40
const WEAK_THRESHOLD    = 20

// ── Contracts ──────────────────────────────────────────────────────────────────

export interface LeadScoreInput {
  intentType:        string
  intentConfidence:  number   // 0–1
  urgencyScore:      number   // 0–1
  email?:            string | null
  phone?:            string | null
  linkedinUrl?:      string | null
  companyDomain?:    string | null
  name?:             string | null
  platform:          string
  postPublishedAt:   Date
  jobTitle?:         string | null
  company?:          string | null
  industry?:         string | null
}

export type ScoreTier = 'HOT' | 'WARM' | 'COOL' | 'WEAK' | 'DISCARD'

// ── Scoring ────────────────────────────────────────────────────────────────────

/**
 * Calculates a lead score (0–100) across 5 dimensions:
 * 1. Intent Strength (max 30) — type weight × ML confidence × urgency × 30
 * 2. Data Completeness (max 25) — email+8, phone+6, linkedin+5, domain+4, name+2
 * 3. Platform Quality (max 20) — LinkedIn→10 … Mastodon→4
 * 4. Engagement Signal (max 15) — recency: 24h→15, 72h→10, 7d→7, older→3
 * 5. Persona Match (max 10) — jobTitle+4, company+3, industry+3
 */
export function calculateLeadScore(lead: LeadScoreInput): number {
  // 1. Intent Strength ────────────────────────────────────────────────────────
  const intentWeight = INTENT_WEIGHTS[lead.intentType] ?? 0.3
  const intentScore = Math.round(
    intentWeight * lead.intentConfidence * lead.urgencyScore * 30,
  )

  // 2. Data Completeness ──────────────────────────────────────────────────────
  let dataScore = 0
  if (lead.email)         dataScore += 8
  if (lead.phone)         dataScore += 6
  if (lead.linkedinUrl)   dataScore += 5
  if (lead.companyDomain) dataScore += 4
  if (lead.name)          dataScore += 2

  // 3. Platform Quality ───────────────────────────────────────────────────────
  const platformScore = PLATFORM_SCORES[lead.platform.toLowerCase()] ?? 2

  // 4. Engagement Signal (recency) ────────────────────────────────────────────
  const ageHours = (Date.now() - lead.postPublishedAt.getTime()) / (1000 * 60 * 60)
  let recencyScore: number
  if (ageHours <= 24)       recencyScore = 15
  else if (ageHours <= 72)  recencyScore = 10
  else if (ageHours <= 168) recencyScore = 7
  else                      recencyScore = 3

  // 5. Persona Match (v1: data presence proxy) ────────────────────────────────
  let personaScore = 0
  if (lead.jobTitle) personaScore += 4
  if (lead.company)  personaScore += 3
  if (lead.industry) personaScore += 3

  const total = intentScore + dataScore + platformScore + recencyScore + personaScore
  return Math.min(100, Math.max(0, total))
}

/**
 * Maps a numeric score to a human-readable tier.
 * HOT ≥ 80 | WARM ≥ 60 | COOL ≥ 40 | WEAK ≥ 20 | DISCARD < 20
 */
export function getScoreTier(score: number): ScoreTier {
  if (score >= HOT_THRESHOLD)  return 'HOT'
  if (score >= WARM_THRESHOLD) return 'WARM'
  if (score >= COOL_THRESHOLD) return 'COOL'
  if (score >= WEAK_THRESHOLD) return 'WEAK'
  return 'DISCARD'
}
