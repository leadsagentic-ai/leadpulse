import { Link } from '@tanstack/react-router'
import type { Lead, ScoreTier } from '@/lib/types'

const TIER_STYLES: Record<ScoreTier, string> = {
  HOT:     'bg-red-100 text-red-700',
  WARM:    'bg-orange-100 text-orange-700',
  COOL:    'bg-blue-100 text-blue-700',
  WEAK:    'bg-gray-100 text-gray-600',
  DISCARD: 'bg-gray-100 text-gray-400',
}

const INTENT_LABELS: Record<string, string> = {
  BUYING_INTENT:      'Buying',
  PAIN_SIGNAL:        'Pain',
  COMPARISON_INTENT:  'Comparing',
  HIRING_INTENT:      'Hiring',
  ANNOUNCEMENT_INTENT:'Announcement',
}

interface LeadCardProps {
  lead: Lead
  onStatusChange?: (id: string, status: 'approved' | 'discarded') => void
  isPending?: boolean
}

export function LeadCard({ lead, onStatusChange, isPending }: LeadCardProps) {
  const tierStyle = TIER_STYLES[lead.scoreTier] ?? 'bg-gray-100 text-gray-600'
  const intentLabel = INTENT_LABELS[lead.intentType] ?? lead.intentType

  const isEnriched = !!(lead.email || lead.phone || lead.company || lead.linkedinUrl)

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Score badge */}
        <div className={`flex shrink-0 flex-col items-center rounded-lg px-2.5 py-1.5 ${tierStyle}`}>
          <span className="text-lg font-bold leading-none">{lead.leadScore}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">{lead.scoreTier}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{lead.name ?? lead.username}</span>
            {lead.jobTitle && (
              <span className="text-xs text-muted-foreground">· {lead.jobTitle}</span>
            )}
            {lead.company && (
              <span className="text-xs text-muted-foreground">@ {lead.company}</span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {intentLabel}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {lead.platform}
            </span>
            {lead.location && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {lead.location}
              </span>
            )}
            {isEnriched && (
              <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                enriched
              </span>
            )}
          </div>
        </div>

        {/* Status chip */}
        {lead.status !== 'pending' && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            lead.status === 'approved' ? 'bg-green-100 text-green-800' :
            lead.status === 'discarded' ? 'bg-gray-100 text-gray-500' :
            'bg-purple-100 text-purple-800'
          }`}>
            {lead.status}
          </span>
        )}
      </div>

      {/* Post excerpt */}
      <p className="line-clamp-2 text-sm text-foreground/80">{lead.postText}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {lead.status === 'pending' && onStatusChange && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onStatusChange(lead.id, 'approved')}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onStatusChange(lead.id, 'discarded')}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Discard
            </button>
          </>
        )}
        <Link
          to="/leads/$leadId"
          params={{ leadId: lead.id }}
          className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          View Profile →
        </Link>
      </div>
    </div>
  )
}
