import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { leadsQueryOptions, useUpdateLeadStatus } from '@/lib/queries/leads.queries';
import { LeadCard } from './LeadCard';
import { LeadFeedSkeleton } from '@/components/shared/Skeletons';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
function LeadFeedInner({ filters }) {
    const { data } = useSuspenseQuery(leadsQueryOptions(filters));
    const { mutate: updateStatus, isPending } = useUpdateLeadStatus();
    const leads = data.data;
    if (!leads.length) {
        return (_jsx("div", { className: "flex items-center justify-center rounded-xl border border-dashed border-border py-16", children: _jsx("p", { className: "text-sm text-muted-foreground", children: "No leads match the selected filters." }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex flex-col gap-3", children: leads.map((lead) => (_jsx(LeadCard, { lead: lead, onStatusChange: (id, status) => updateStatus({ leadId: id, status }), isPending: isPending }, lead.id))) }), data.meta && (_jsxs("p", { className: "mt-4 text-center text-xs text-muted-foreground", children: ["Showing ", leads.length, " of ", data.meta.total, " leads"] }))] }));
}
export function LeadFeed({ filters }) {
    return (_jsx(ErrorBoundary, { fallback: _jsx("p", { className: "text-sm text-destructive", children: "Failed to load leads." }), children: _jsx(Suspense, { fallback: _jsx(LeadFeedSkeleton, { rows: 8 }), children: _jsx(LeadFeedInner, { filters: filters }) }) }));
}
//# sourceMappingURL=LeadFeed.js.map