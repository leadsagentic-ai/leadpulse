// Reusable skeleton building block
function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

// ── Lead skeletons ─────────────────────────────────────────────────────────────

export function LeadCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-20" />
        <Bone className="h-5 w-12" />
      </div>
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Bone className="h-5 w-24" />
        <Bone className="h-5 w-20" />
      </div>
    </div>
  )
}

export function LeadFeedSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <LeadCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function LeadProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Bone className="h-6 w-48" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-3/4" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Bone className="h-6 w-36" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <Bone className="h-6 w-28" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  )
}

// ── Campaign skeletons ─────────────────────────────────────────────────────────

export function CampaignCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-36" />
        <Bone className="h-5 w-16" />
      </div>
      <div className="flex gap-2">
        <Bone className="h-6 w-16" />
        <Bone className="h-6 w-16" />
        <Bone className="h-6 w-20" />
      </div>
      <Bone className="h-4 w-48" />
    </div>
  )
}

export function CampaignListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  )
}
