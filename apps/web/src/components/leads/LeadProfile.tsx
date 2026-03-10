import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, Mail, Phone, Linkedin, Building2, MapPin, ShieldCheck } from 'lucide-react'
import { leadDetailQueryOptions, useUpdateLeadStatus } from '@/lib/queries/leads.queries'
import { LeadProfileSkeleton } from '@/components/shared/Skeletons'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import type { Lead, ScoreTier } from '@/lib/types'

const TIER_STYLES: Record<ScoreTier, string> = {
  HOT:     'bg-red-100 text-red-700',
  WARM:    'bg-orange-100 text-orange-700',
  COOL:    'bg-blue-100 text-blue-700',
  WEAK:    'bg-gray-100 text-gray-600',
  DISCARD: 'bg-gray-100 text-gray-400',
}

const INTENT_LABELS: Record<string, string> = {
  BUYING_INTENT:       'Buying Intent',
  PAIN_SIGNAL:         'Pain Signal',
  COMPARISON_INTENT:   'Comparing Solutions',
  HIRING_INTENT:       'Hiring Intent',
  ANNOUNCEMENT_INTENT: 'Announcement',
}

function ConfidenceBar({ value }: { value: string }) {
  const pct = Math.round(parseFloat(value) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs font-medium text-foreground">{pct}%</span>
    </div>
  )
}

function ScoreRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-4 text-sm text-muted-foreground">{label}</td>
      <td className="py-2 text-sm font-medium text-foreground">{value}</td>
    </tr>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  href?: string | undefined
}) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}:</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {value}
        </a>
      ) : (
        <span className="text-foreground">{value}</span>
      )}
    </div>
  )
}

function LeadProfileContent({ leadId }: { leadId: string }) {
  const { data } = useSuspenseQuery(leadDetailQueryOptions(leadId))
  const { mutate: updateStatus, isPending } = useUpdateLeadStatus()
  const lead = data.data

  const tierStyle = TIER_STYLES[lead.scoreTier] ?? ''
  const intentLabel = INTENT_LABELS[lead.intentType] ?? lead.intentType
  const pct = Math.round(parseFloat(lead.intentConfidence) * 100)

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link
          to="/leads"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Leads
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lead.name ?? lead.username}
          </h1>
          {lead.jobTitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lead.jobTitle}{lead.company ? ` · ${lead.company}` : ''}
            </p>
          )}
        </div>
        <div className={`flex flex-col items-center rounded-xl px-4 py-2.5 ${tierStyle}`}>
          <span className="text-2xl font-bold leading-none">{lead.leadScore}</span>
          <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide">{lead.scoreTier}</span>
        </div>
      </div>

      {/* Actions */}
      {lead.status === 'pending' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => updateStatus({ leadId: lead.id, status: 'approved' })}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => updateStatus({ leadId: lead.id, status: 'discarded' })}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
      {lead.status !== 'pending' && (
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            lead.status === 'approved' ? 'bg-green-100 text-green-800' :
            lead.status === 'discarded' ? 'bg-gray-100 text-gray-500' :
            'bg-purple-100 text-purple-800'
          }`}>
            {lead.status}
          </span>
        </div>
      )}

      {/* Original post */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Original Post</h2>
          <a
            href={lead.postUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on {lead.platform} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">{lead.postText}</p>
        {lead.postPublishedAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Posted {new Date(lead.postPublishedAt).toLocaleDateString()} · {lead.postEngagement} engagements
          </p>
        )}
      </section>

      {/* AI Intent Analysis */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-foreground">AI Intent Analysis</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-700">
              {intentLabel}
            </span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Intent Confidence</span>
              <span>{pct}%</span>
            </div>
            <ConfidenceBar value={lead.intentConfidence} />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Urgency Score</div>
            <ConfidenceBar value={lead.urgencyScore} />
          </div>
          {lead.intentJustification && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm italic text-muted-foreground">
              "{lead.intentJustification}"
            </p>
          )}
        </div>
      </section>

      {/* Contact + Enrichment */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Contact Information</h2>
        <div className="space-y-2">
          <InfoItem icon={Mail} label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
          {lead.emailStatus && (
            <div className="ml-6 text-xs text-muted-foreground">
              Status: <span className={lead.emailStatus === 'VALID' ? 'text-green-700' : 'text-yellow-700'}>{lead.emailStatus}</span>
            </div>
          )}
          <InfoItem icon={Phone} label="Phone" value={lead.phone} />
          <InfoItem icon={Linkedin} label="LinkedIn" value={lead.linkedinUrl} href={lead.linkedinUrl ?? undefined} />
          <InfoItem icon={Building2} label="Company" value={lead.company} />
          <InfoItem icon={MapPin} label="Location" value={lead.location} />
          {lead.industry && <InfoItem label="Industry" value={lead.industry} />}
          {lead.companySize && <InfoItem label="Company Size" value={lead.companySize} />}
          {lead.platformProfileUrl && (
            <InfoItem
              label="Profile"
              value={lead.username}
              href={lead.platformProfileUrl}
            />
          )}
        </div>
        {lead.enrichedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Enriched {new Date(lead.enrichedAt).toLocaleDateString()}
          </p>
        )}
      </section>

      {/* Score Breakdown */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Score Breakdown</h2>
        <table className="w-full text-left">
          <tbody>
            <ScoreRow label="Intent Confidence" value={`${pct}%`} />
            <ScoreRow label="Urgency" value={`${Math.round(parseFloat(lead.urgencyScore) * 100)}%`} />
            <ScoreRow label="Persona Match" value={`${Math.round(parseFloat(lead.personaMatchScore) * 100)}%`} />
            <ScoreRow label="Score Tier" value={lead.scoreTier} />
            <ScoreRow label="Total Score" value={lead.leadScore} />
          </tbody>
        </table>
      </section>

      {/* Compliance */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Compliance</h2>
        <div className="flex gap-4">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${lead.complianceGdprSafe ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            <ShieldCheck className="h-4 w-4" />
            GDPR {lead.complianceGdprSafe ? 'Safe' : 'Not Safe'}
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${lead.complianceDpdpSafe ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            <ShieldCheck className="h-4 w-4" />
            DPDP {lead.complianceDpdpSafe ? 'Safe' : 'Not Safe'}
          </div>
        </div>
      </section>
    </div>
  )
}

export function LeadProfile({ leadId }: { leadId: string }) {
  return (
    <ErrorBoundary fallback={<p className="text-sm text-destructive">Failed to load lead.</p>}>
      <Suspense fallback={<LeadProfileSkeleton />}>
        <LeadProfileContent leadId={leadId} />
      </Suspense>
    </ErrorBoundary>
  )
}
