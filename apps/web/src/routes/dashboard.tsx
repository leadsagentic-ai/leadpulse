import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const user = auth.currentUser

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">LeadPulse</span>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
        </div>
      </header>
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome to LeadPulse Intelligence. Create your first campaign to start monitoring signals.
        </p>
      </main>
    </div>
  )
}
