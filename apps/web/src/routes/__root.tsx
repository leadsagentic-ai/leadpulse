import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { auth } from '@/lib/auth'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'

interface RouterContext {
  queryClient: QueryClient
}

function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u))
    return unsubscribe
  }, [])

  // Still loading auth state — render nothing to avoid flash
  if (user === undefined) return null

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
