import { createFileRoute, Navigate } from '@tanstack/react-router'
import { auth } from '@/lib/auth'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const user = auth.currentUser
  if (user) {
    return <Navigate to="/dashboard" />
  }
  return <Navigate to="/login" />
}
