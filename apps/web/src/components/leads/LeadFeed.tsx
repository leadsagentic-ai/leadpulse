import { Suspense } from 'react'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsQueryOptions, useUpdateLeadStatus } from '@/lib/queries/leads.queries'
import { LeadCard } from './LeadCard'
import { LeadFeedSkeleton } from '@/components/shared/Skeletons'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import type { LeadFilters } from '@/lib/types'

function LeadFeedInner({ filters }: { filters: LeadFilters }) {
  const { data } = useSuspenseQuery(leadsQueryOptions(filters))
  const { mutate: updateStatus, isPending } = useUpdateLeadStatus()
  const leads = data.data

  if (!leads.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16">
        <p className="text-sm text-muted-foreground">No leads match the selected filters.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onStatusChange={(id, status) => updateStatus({ leadId: id, status })}
            isPending={isPending}
          />
        ))}
      </div>
      {data.meta && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Showing {leads.length} of {data.meta.total} leads
        </p>
      )}
    </>
  )
}

export function LeadFeed({ filters }: { filters: LeadFilters }) {
  return (
    <ErrorBoundary fallback={<p className="text-sm text-destructive">Failed to load leads.</p>}>
      <Suspense fallback={<LeadFeedSkeleton rows={8} />}>
        <LeadFeedInner filters={filters} />
      </Suspense>
    </ErrorBoundary>
  )
}
