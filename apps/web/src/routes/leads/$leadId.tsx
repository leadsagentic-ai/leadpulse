import { createFileRoute } from '@tanstack/react-router'
import { LeadProfile } from '@/components/leads/LeadProfile'

export const Route = createFileRoute('/leads/$leadId')({
  component: LeadProfilePage,
})

function LeadProfilePage() {
  const { leadId } = Route.useParams()
  return (
    <div className="p-8">
      <LeadProfile leadId={leadId} />
    </div>
  )
}
