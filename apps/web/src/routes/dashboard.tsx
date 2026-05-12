import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { OnboardingChecklist } from '@/components/shared/OnboardingChecklist'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const user = auth.currentUser

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

      <div className="mt-6">
        <OnboardingChecklist />
      </div>
    </div>
  )
}

