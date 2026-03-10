import { createFileRoute } from '@tanstack/react-router'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'

export const Route = createFileRoute('/campaigns/new')({
  component: NewCampaignPage,
})

function NewCampaignPage() {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Create Campaign</h1>
      <CampaignWizard />
    </div>
  )
}
