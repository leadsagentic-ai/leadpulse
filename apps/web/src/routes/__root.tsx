import { createRootRouteWithContext, Outlet, useRouterState, Navigate } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { auth } from '@/lib/auth'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Layout } from '@/components/shared/Layout'

interface RouterContext {
  queryClient: QueryClient
}

// Routes that don't require auth or a sidebar
const PUBLIC_PATHS = ['/login']

function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const { location } = useRouterState()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u))
    return unsubscribe
  }, [])

  // Hold render until Firebase resolves the initial auth state
  if (user === undefined) return null

  const isPublic = PUBLIC_PATHS.includes(location.pathname)

  // Unauthenticated users trying to access protected routes → redirect to login
  if (!user && !isPublic) {
    return <Navigate to="/login" />
  }

  // Login (and any future public pages) render without the shell
  if (isPublic) {
    return <Outlet />
  }

  // Authenticated routes get the sidebar + main-area shell
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
