import ky from 'ky'
import { getIdToken } from '@/lib/auth'

// Base ky instance — automatically attaches Firebase JWT to every request
export const apiClient = ky.create({
  prefixUrl: import.meta.env['VITE_API_URL'] as string ?? 'http://localhost:8787',
  timeout: 30_000,
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await getIdToken()
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    ],
  },
})
