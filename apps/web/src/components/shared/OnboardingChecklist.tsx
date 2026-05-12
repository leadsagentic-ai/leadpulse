import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { campaignsQueryOptions } from '@/lib/queries/campaigns.queries'

interface Step {
  label: string
  description: string
  href: string
  isDone: boolean
}

/**
 * Beta onboarding checklist — shown on the Dashboard when a user has no campaigns yet.
 * Guides new users through: create campaign → see leads → connect CRM.
 */
export function OnboardingChecklist() {
  const { data, isPending } = useQuery({
    ...campaignsQueryOptions(1, 1),
    // Don't throw on error — silently hide the checklist if the query fails
    throwOnError: false,
  })

  // Hide while loading or once user has campaigns
  if (isPending || (data && data.meta.total > 0)) return null

  const steps: Step[] = [
    {
      label: 'Create your first campaign',
      description: 'Define your ICP and select platforms to monitor.',
      href: '/campaigns/new',
      isDone: false,
    },
    {
      label: 'See your first lead',
      description: 'Review AI-scored, intent-ranked leads from your campaign.',
      href: '/leads',
      isDone: false,
    },
    {
      label: 'Connect your CRM',
      description: 'Push approved leads directly into HubSpot or Salesforce.',
      href: '/settings',
      isDone: false,
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Get started with LeadPulse</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Complete these steps to start capturing high-intent leads automatically.
      </p>

      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li key={step.href} className="flex items-start gap-4">
            {/* Step number badge */}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>

            <div className="flex-1 min-w-0">
              <Link
                to={step.href}
                className="text-sm font-medium text-foreground hover:text-primary hover:underline"
              >
                {step.label}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            </div>

            <Link
              to={step.href}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start →
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
