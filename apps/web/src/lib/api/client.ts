import ky from 'ky'
import { getIdToken } from '@/lib/auth'

export const apiClient = ky.create({
  prefixUrl: import.meta.env['VITE_API_URL'] ?? 'http://localhost:8787',
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
