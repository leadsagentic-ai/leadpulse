import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { ApiSuccess, Campaign, CreateCampaignInput } from '@/lib/types'

// Inline response type to match actual API shape
interface CampaignsListResponse {
  success: true
  data: Campaign[]
  meta: { page: number; limit: number; total: number; hasMore: boolean }
}

export const campaignsQueryOptions = (page = 1, limit = 20) =>
  queryOptions({
    queryKey: ['campaigns', { page, limit }] as const,
    queryFn: () =>
      apiClient
        .get('api/v1/campaigns', { searchParams: { page: String(page), limit: String(limit) } })
        .json<CampaignsListResponse>(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

export const campaignDetailQueryOptions = (campaignId: string) =>
  queryOptions({
    queryKey: ['campaigns', campaignId] as const,
    queryFn: () =>
      apiClient
        .get(`api/v1/campaigns/${campaignId}`)
        .json<ApiSuccess<Campaign>>(),
    staleTime: 60_000,
  })

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      apiClient
        .post('api/v1/campaigns', { json: input })
        .json<ApiSuccess<Campaign>>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) =>
      apiClient.delete(`api/v1/campaigns/${campaignId}`).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function usePatchCampaignStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, status }: { campaignId: string; status: 'active' | 'paused' }) =>
      apiClient
        .patch(`api/v1/campaigns/${campaignId}/status`, { json: { status } })
        .json<ApiSuccess<Campaign>>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}


