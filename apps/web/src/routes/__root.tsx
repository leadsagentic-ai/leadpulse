import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { getIdToken } from '@/lib/auth'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // Auth guard: redirect unauthenticated users to /login
  beforeLoad: async ({ location }) => {
    const publicPaths = ['/login', '/signup']
    if (publicPaths.includes(location.pathname)) return

    const token = await getIdToken()
    if (!token) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  )
}
