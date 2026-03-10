import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calculateLeadScore, getScoreTier, type LeadScoreInput } from './lead-scorer.service'

// ── Helpers ────────────────────────────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000)
}

/** Minimal valid input — only required fields, everything optional is null */
function baseInput(overrides?: Partial<LeadScoreInput>): LeadScoreInput {
  return {
    intentType:       'BUYING_INTENT',
    intentConfidence: 1.0,
    urgencyScore:     1.0,
    platform:         'reddit',
    postPublishedAt:  hoursAgo(1),  // fresh — within 24h
    email:            null,
    phone:            null,
    linkedinUrl:      null,
    companyDomain:    null,
    name:             null,
    jobTitle:         null,
    company:          null,
    industry:         null,
    ...overrides,
  }
}

// ── Intent Strength (max 30) ───────────────────────────────────────────────────

describe('Intent Strength dimension', () => {
  it('BUYING_INTENT at confidence=1 urgency=1 → 30pts', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'BUYING_INTENT', intentConfidence: 1.0, urgencyScore: 1.0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),  // old → recency=3
    }))
    // intentScore=30, dataScore=0, platform=8, recency=3, persona=0 → 41
    expect(score).toBe(41)
  })

  it('BUYING_INTENT weight=1.0 × confidence × urgency × 30 is rounded', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'BUYING_INTENT', intentConfidence: 0.5, urgencyScore: 0.5,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    // intentScore=Math.round(1.0*0.5*0.5*30)=Math.round(7.5)=8, dataScore=0, platform=8, recency=3 → 19
    expect(score).toBe(19)
  })

  it('PAIN_SIGNAL weight=0.8', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'PAIN_SIGNAL', intentConfidence: 1.0, urgencyScore: 1.0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    // intentScore=Math.round(0.8*1*1*30)=24, data=0, platform=8, recency=3 → 35
    expect(score).toBe(35)
  })

  it('COMPARISON_INTENT weight=0.7', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'COMPARISON_INTENT', intentConfidence: 1.0, urgencyScore: 1.0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    // 0.7*1*1*30=21, data=0, platform=8, recency=3 → 32
    expect(score).toBe(32)
  })

  it('HIRING_INTENT weight=0.5', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'HIRING_INTENT', intentConfidence: 1.0, urgencyScore: 1.0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    // 0.5*1*1*30=15, data=0, platform=8, recency=3 → 26
    expect(score).toBe(26)
  })

  it('ANNOUNCEMENT_INTENT weight=0.3', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'ANNOUNCEMENT_INTENT', intentConfidence: 1.0, urgencyScore: 1.0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    // 0.3*1*1*30=9, data=0, platform=8, recency=3 → 20
    expect(score).toBe(20)
  })

  it('unknown intent_type falls back to weight=0.3', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'UNKNOWN_THING', intentConfidence: 1.0, urgencyScore: 1.0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    // same as ANNOUNCEMENT: 9+0+8+3=20
    expect(score).toBe(20)
  })
})

// ── Data Completeness (max 25) ─────────────────────────────────────────────────

describe('Data Completeness dimension', () => {
  it('email present adds 8', () => {
    const withEmail = calculateLeadScore(baseInput({
      email: 'x@example.com', intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    const without = calculateLeadScore(baseInput({
      intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    expect(withEmail - without).toBe(8)
  })

  it('phone adds 6', () => {
    const with_ = calculateLeadScore(baseInput({ phone: '+91-9999999999', intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    const wo    = calculateLeadScore(baseInput({ intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    expect(with_ - wo).toBe(6)
  })

  it('linkedinUrl adds 5', () => {
    const with_ = calculateLeadScore(baseInput({ linkedinUrl: 'https://linkedin.com/in/x', intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    const wo    = calculateLeadScore(baseInput({ intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    expect(with_ - wo).toBe(5)
  })

  it('companyDomain adds 4', () => {
    const with_ = calculateLeadScore(baseInput({ companyDomain: 'acme.com', intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    const wo    = calculateLeadScore(baseInput({ intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    expect(with_ - wo).toBe(4)
  })

  it('name adds 2', () => {
    const with_ = calculateLeadScore(baseInput({ name: 'Alice', intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    const wo    = calculateLeadScore(baseInput({ intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }))
    expect(with_ - wo).toBe(2)
  })

  it('all data fields present add up to 25', () => {
    const full = calculateLeadScore(baseInput({
      email: 'x@acme.com', phone: '+1234', linkedinUrl: 'https://linkedin.com/in/x',
      companyDomain: 'acme.com', name: 'Alice',
      intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    const empty = calculateLeadScore(baseInput({
      intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0,
      platform: 'reddit', postPublishedAt: hoursAgo(200),
    }))
    expect(full - empty).toBe(25)
  })
})

// ── Platform Quality (max 20) ──────────────────────────────────────────────────

describe('Platform Quality dimension', () => {
  const noiseInput = { intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0, postPublishedAt: hoursAgo(200) } as const

  it('linkedin scores 10', () => {
    const score = calculateLeadScore(baseInput({ ...noiseInput, platform: 'linkedin' }))
    const reddit = calculateLeadScore(baseInput({ ...noiseInput, platform: 'reddit' }))
    expect(score - reddit).toBe(2)   // 10 - 8 = 2
  })

  it('reddit scores 8', () => {
    const score  = calculateLeadScore(baseInput({ ...noiseInput, platform: 'reddit' }))
    const bluesky = calculateLeadScore(baseInput({ ...noiseInput, platform: 'bluesky' }))
    expect(score - bluesky).toBe(2)  // 8 - 6 = 2
  })

  it('github scores 7', () => {
    const github  = calculateLeadScore(baseInput({ ...noiseInput, platform: 'github' }))
    const bluesky = calculateLeadScore(baseInput({ ...noiseInput, platform: 'bluesky' }))
    expect(github - bluesky).toBe(1)  // 7 - 6 = 1
  })

  it('bluesky scores 6', () => {
    const bluesky  = calculateLeadScore(baseInput({ ...noiseInput, platform: 'bluesky' }))
    const threads  = calculateLeadScore(baseInput({ ...noiseInput, platform: 'threads' }))
    expect(bluesky - threads).toBe(1)  // 6 - 5 = 1
  })

  it('threads scores 5', () => {
    const threads  = calculateLeadScore(baseInput({ ...noiseInput, platform: 'threads' }))
    const mastodon = calculateLeadScore(baseInput({ ...noiseInput, platform: 'mastodon' }))
    expect(threads - mastodon).toBe(1)  // 5 - 4 = 1
  })

  it('unknown platform scores 2', () => {
    const unknown = calculateLeadScore(baseInput({ ...noiseInput, platform: 'tiktok' }))
    const mastodon = calculateLeadScore(baseInput({ ...noiseInput, platform: 'mastodon' }))
    expect(mastodon - unknown).toBe(2)  // 4 - 2 = 2
  })

  it('platform name is case-insensitive', () => {
    const lower = calculateLeadScore(baseInput({ ...noiseInput, platform: 'linkedin' }))
    const upper = calculateLeadScore(baseInput({ ...noiseInput, platform: 'LinkedIn' }))
    expect(lower).toBe(upper)
  })
})

// ── Engagement Signal / Recency (max 15) ──────────────────────────────────────

describe('Engagement Signal (recency) dimension', () => {
  const noiseInput = { intentType: 'BUYING_INTENT' as const, intentConfidence: 0, urgencyScore: 0, platform: 'reddit' as const }

  it('post published < 24h ago → recency=15', () => {
    const a = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(12) }))
    const b = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(200) }))
    expect(a - b).toBe(12)  // 15 - 3 = 12
  })

  it('post published 24–72h ago → recency=10', () => {
    const a = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(48) }))
    const b = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(200) }))
    expect(a - b).toBe(7)   // 10 - 3 = 7
  })

  it('post published 72–168h ago → recency=7', () => {
    const a = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(120) }))
    const b = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(200) }))
    expect(a - b).toBe(4)   // 7 - 3 = 4
  })

  it('post older than 7d → recency=3', () => {
    const score = calculateLeadScore(baseInput({ ...noiseInput, postPublishedAt: hoursAgo(200) }))
    // recency contributes exactly 3 (base: intent=0, data=0, platform=8, recency=3)
    expect(score).toBe(11)  // 0+0+8+3+0
  })
})

// ── Persona Match (max 10) ─────────────────────────────────────────────────────

describe('Persona Match dimension', () => {
  const noiseInput = { intentType: 'BUYING_INTENT' as const, intentConfidence: 0, urgencyScore: 0, platform: 'reddit', postPublishedAt: hoursAgo(200) }

  it('jobTitle present adds 4', () => {
    const with_ = calculateLeadScore(baseInput({ ...noiseInput, jobTitle: 'CTO' }))
    const wo    = calculateLeadScore(baseInput(noiseInput))
    expect(with_ - wo).toBe(4)
  })

  it('company present adds 3', () => {
    const with_ = calculateLeadScore(baseInput({ ...noiseInput, company: 'Acme' }))
    const wo    = calculateLeadScore(baseInput(noiseInput))
    expect(with_ - wo).toBe(3)
  })

  it('industry present adds 3', () => {
    const with_ = calculateLeadScore(baseInput({ ...noiseInput, industry: 'SaaS' }))
    const wo    = calculateLeadScore(baseInput(noiseInput))
    expect(with_ - wo).toBe(3)
  })

  it('all persona fields add 10 total', () => {
    const with_ = calculateLeadScore(baseInput({ ...noiseInput, jobTitle: 'CTO', company: 'Acme', industry: 'SaaS' }))
    const wo    = calculateLeadScore(baseInput(noiseInput))
    expect(with_ - wo).toBe(10)
  })
})

// ── Score tiers ────────────────────────────────────────────────────────────────

describe('getScoreTier', () => {
  it('100 → HOT',     () => expect(getScoreTier(100)).toBe('HOT'))
  it(' 80 → HOT',     () => expect(getScoreTier(80)).toBe('HOT'))
  it(' 79 → WARM',    () => expect(getScoreTier(79)).toBe('WARM'))
  it(' 60 → WARM',    () => expect(getScoreTier(60)).toBe('WARM'))
  it(' 59 → COOL',    () => expect(getScoreTier(59)).toBe('COOL'))
  it(' 40 → COOL',    () => expect(getScoreTier(40)).toBe('COOL'))
  it(' 39 → WEAK',    () => expect(getScoreTier(39)).toBe('WEAK'))
  it(' 20 → WEAK',    () => expect(getScoreTier(20)).toBe('WEAK'))
  it(' 19 → DISCARD', () => expect(getScoreTier(19)).toBe('DISCARD'))
  it('  0 → DISCARD', () => expect(getScoreTier(0)).toBe('DISCARD'))
})

// ── Score is clamped 0–100 ─────────────────────────────────────────────────────

describe('score clamping', () => {
  it('scores cannot exceed 100 even with perfect inputs', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'BUYING_INTENT', intentConfidence: 1.0, urgencyScore: 1.0,
      email: 'x@acme.com', phone: '+1', linkedinUrl: 'https://li.com',
      companyDomain: 'acme.com', name: 'Alice',
      platform: 'linkedin', postPublishedAt: hoursAgo(1),
      jobTitle: 'CTO', company: 'Acme', industry: 'SaaS',
    }))
    expect(score).toBeLessThanOrEqual(100)
  })

  it('scores cannot be negative', () => {
    const score = calculateLeadScore(baseInput({
      intentType: 'BUYING_INTENT', intentConfidence: 0, urgencyScore: 0,
      platform: 'unknown', postPublishedAt: hoursAgo(1000),
    }))
    expect(score).toBeGreaterThanOrEqual(0)
  })
})
