import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
export const leadsQueryOptions = (filters) => queryOptions({
    queryKey: ['leads', filters],
    queryFn: () => apiClient
        .get('api/v1/leads', { searchParams: filtersToParams(filters) })
        .json(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
});
export const leadDetailQueryOptions = (leadId) => queryOptions({
    queryKey: ['leads', leadId],
    queryFn: () => apiClient
        .get(`api/v1/leads/${leadId}`)
        .json(),
    staleTime: 60_000,
});
function filtersToParams(filters) {
    const params = {};
    for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null)
            params[k] = String(v);
    }
    return params;
}
export function useUpdateLeadStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leadId, status }) => apiClient
            .patch(`api/v1/leads/${leadId}/status`, { json: { status } })
            .json(),
        onSuccess: (_data, { leadId }) => {
            void queryClient.invalidateQueries({ queryKey: ['leads'] });
            void queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
        },
    });
}
export function useExportLeads() {
    return useMutation({
        mutationFn: (filters) => apiClient
            .post('api/v1/leads/export', { json: filters })
            .json(),
    });
}
//# sourceMappingURL=leads.queries.js.map