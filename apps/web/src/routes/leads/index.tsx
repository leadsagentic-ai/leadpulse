import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { LeadFeed } from '@/components/leads/LeadFeed'
import { LeadFiltersBar } from '@/components/leads/LeadFilters'
import { useExportLeads } from '@/lib/queries/leads.queries'
import type { LeadFilters } from '@/lib/types'

export const Route = createFileRoute('/leads/')({
  component: LeadsPage,
})

function LeadsPage() {
  const [filters, setFilters] = useState<LeadFilters>({ page: 1, limit: 25 })
  const { mutate: exportLeads, isPending: exporting } = useExportLeads()

  function handleExport() {
    exportLeads(filters, {
      onSuccess: ({ data: { key } }) => {
        const apiUrl = import.meta.env.VITE_API_URL as string
        window.open(`${apiUrl.replace(/\/$/, '')}/api/v1/leads/exports/${encodeURIComponent(key)}`, '_blank')
      },
    })
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and manage captured buyer signals.</p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="mb-5">
        <LeadFiltersBar filters={filters} onChange={setFilters} />
      </div>

      <LeadFeed filters={filters} />
    </div>
  )
}
