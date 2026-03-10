import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const user = auth.currentUser

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Welcome to LeadPulse Intelligence. Create your first campaign to start monitoring signals.
      </p>
    </div>
  )
}

