import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
export const campaignsQueryOptions = (page = 1, limit = 20) => queryOptions({
    queryKey: ['campaigns', { page, limit }],
    queryFn: () => apiClient
        .get('api/v1/campaigns', { searchParams: { page: String(page), limit: String(limit) } })
        .json(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
});
export const campaignDetailQueryOptions = (campaignId) => queryOptions({
    queryKey: ['campaigns', campaignId],
    queryFn: () => apiClient
        .get(`api/v1/campaigns/${campaignId}`)
        .json(),
    staleTime: 60_000,
});
export function useCreateCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiClient
            .post('api/v1/campaigns', { json: input })
            .json(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        },
    });
}
export function useDeleteCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (campaignId) => apiClient.delete(`api/v1/campaigns/${campaignId}`).json(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        },
    });
}
export function usePatchCampaignStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ campaignId, status }) => apiClient
            .patch(`api/v1/campaigns/${campaignId}/status`, { json: { status } })
            .json(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        },
    });
}
//# sourceMappingURL=campaigns.queries.js.map