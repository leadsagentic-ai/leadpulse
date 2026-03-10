import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { ApiSuccess, Lead, LeadFilters } from '@/lib/types'

interface LeadsListResponse {
  success: true
  data: Lead[]
  meta: { page: number; limit: number; total: number; hasMore: boolean }
}

export const leadsQueryOptions = (filters: LeadFilters) =>
  queryOptions({
    queryKey: ['leads', filters] as const,
    queryFn: () =>
      apiClient
        .get('api/v1/leads', { searchParams: filtersToParams(filters) })
        .json<LeadsListResponse>(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

export const leadDetailQueryOptions = (leadId: string) =>
  queryOptions({
    queryKey: ['leads', leadId] as const,
    queryFn: () =>
      apiClient
        .get(`api/v1/leads/${leadId}`)
        .json<ApiSuccess<Lead>>(),
    staleTime: 60_000,
  })

function filtersToParams(filters: LeadFilters): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null) params[k] = String(v)
  }
  return params
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
      apiClient
        .patch(`api/v1/leads/${leadId}/status`, { json: { status } })
        .json<ApiSuccess<Lead>>(),
    onSuccess: (_data, { leadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
      void queryClient.invalidateQueries({ queryKey: ['leads', leadId] })
    },
  })
}

export function useExportLeads() {
  return useMutation({
    mutationFn: (filters: LeadFilters) =>
      apiClient
        .post('api/v1/leads/export', { json: filters })
        .json<{ success: true; data: { key: string; expiresAt: string } }>(),
  })
}
