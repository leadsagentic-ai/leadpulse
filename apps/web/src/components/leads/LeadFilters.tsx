import type { LeadFilters, IntentType, ScoreTier, LeadStatus } from '@/lib/types'

const PLATFORMS = ['reddit', 'bluesky', 'threads', 'mastodon', 'linkedin', 'github']
const INTENT_TYPES: { value: IntentType; label: string }[] = [
  { value: 'BUYING_INTENT',       label: 'Buying Intent' },
  { value: 'PAIN_SIGNAL',         label: 'Pain Signal' },
  { value: 'COMPARISON_INTENT',   label: 'Comparing' },
  { value: 'HIRING_INTENT',       label: 'Hiring Intent' },
  { value: 'ANNOUNCEMENT_INTENT', label: 'Announcement' },
]
const SCORE_TIERS: ScoreTier[] = ['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD']
const STATUSES: LeadStatus[] = ['pending', 'approved', 'discarded', 'pushed_crm']

interface LeadFiltersProps {
  filters: LeadFilters
  onChange: (f: LeadFilters) => void
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (v: T | undefined) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value as T) || undefined)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

export function LeadFiltersBar({ filters, onChange }: LeadFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <Select
        label="Platform"
        value={filters.platform}
        options={PLATFORMS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
        onChange={(v) => onChange({ ...filters, ...(v !== undefined ? { platform: v } : { platform: undefined }), page: 1 })}
      />
      <Select
        label="Intent"
        value={filters.intentType}
        options={INTENT_TYPES}
        onChange={(v) => onChange({ ...filters, ...(v !== undefined ? { intentType: v } : { intentType: undefined }), page: 1 })}
      />
      <Select
        label="Score Tier"
        value={filters.scoreTier}
        options={SCORE_TIERS.map((t) => ({ value: t, label: t }))}
        onChange={(v) => onChange({ ...filters, ...(v !== undefined ? { scoreTier: v } : { scoreTier: undefined }), page: 1 })}
      />
      <Select
        label="Status"
        value={filters.status}
        options={STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
        onChange={(v) => onChange({ ...filters, ...(v !== undefined ? { status: v } : { status: undefined }), page: 1 })}
      />
    </div>
  )
}
