import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Plus, Play, Pause, Trash2 } from 'lucide-react'
import { campaignsQueryOptions, usePatchCampaignStatus, useDeleteCampaign } from '@/lib/queries/campaigns.queries'
import { CampaignListSkeleton } from '@/components/shared/Skeletons'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import type { Campaign } from '@/lib/types'

export const Route = createFileRoute('/campaigns/')({
  component: CampaignsPage,
})

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { mutate: patchStatus, isPending: patching } = usePatchCampaignStatus()
  const { mutate: deleteCampaign, isPending: deleting } = useDeleteCampaign()

  const statusColors: Record<string, string> = {
    active:   'bg-green-100 text-green-800',
    paused:   'bg-yellow-100 text-yellow-800',
    archived: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="flex items-start justify-between rounded-xl border border-border bg-card px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h3 className="truncate font-medium text-foreground">{campaign.name}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[campaign.status] ?? ''}`}>
            {campaign.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {campaign.platforms.map((p) => (
            <span key={p} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{p}</span>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {campaign.keywords.slice(0, 5).join(', ')}
          {campaign.keywords.length > 5 && ` +${campaign.keywords.length - 5} more`}
        </p>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-2">
        {campaign.status === 'active' ? (
          <button
            title="Pause campaign"
            type="button"
            disabled={patching}
            onClick={() => patchStatus({ campaignId: campaign.id, status: 'paused' })}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Pause className="h-4 w-4" />
          </button>
        ) : campaign.status === 'paused' ? (
          <button
            title="Resume campaign"
            type="button"
            disabled={patching}
            onClick={() => patchStatus({ campaignId: campaign.id, status: 'active' })}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
          </button>
        ) : null}
        <button
          title="Delete campaign"
          type="button"
          disabled={deleting}
          onClick={() => deleteCampaign(campaign.id)}
          className="rounded-lg p-1.5 text-destructive/60 hover:bg-red-50 hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function CampaignList() {
  const { data } = useSuspenseQuery(campaignsQueryOptions())
  const campaigns = data.data

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
        <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        <Link
          to="/campaigns/new"
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create your first campaign
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {campaigns.map((c) => (
        <CampaignRow key={c.id} campaign={c} />
      ))}
      {data.meta && data.meta.hasMore && (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Showing {campaigns.length} of {data.meta.total} campaigns.
        </p>
      )}
    </div>
  )
}

function CampaignsPage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your signal monitoring campaigns.</p>
        </div>
        <Link
          to="/campaigns/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      <ErrorBoundary fallback={<p className="text-sm text-destructive">Failed to load campaigns.</p>}>
        <Suspense fallback={<CampaignListSkeleton />}>
          <CampaignList />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
