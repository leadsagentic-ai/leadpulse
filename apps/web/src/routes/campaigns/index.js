import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, Link } from '@tanstack/react-router';
import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Plus, Play, Pause, Trash2 } from 'lucide-react';
import { campaignsQueryOptions, usePatchCampaignStatus, useDeleteCampaign } from '@/lib/queries/campaigns.queries';
import { CampaignListSkeleton } from '@/components/shared/Skeletons';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
export const Route = createFileRoute('/campaigns/')({
    component: CampaignsPage,
});
function CampaignRow({ campaign }) {
    const { mutate: patchStatus, isPending: patching } = usePatchCampaignStatus();
    const { mutate: deleteCampaign, isPending: deleting } = useDeleteCampaign();
    const statusColors = {
        active: 'bg-green-100 text-green-800',
        paused: 'bg-yellow-100 text-yellow-800',
        archived: 'bg-gray-100 text-gray-600',
    };
    return (_jsxs("div", { className: "flex items-start justify-between rounded-xl border border-border bg-card px-5 py-4", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h3", { className: "truncate font-medium text-foreground", children: campaign.name }), _jsx("span", { className: `shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[campaign.status] ?? ''}`, children: campaign.status })] }), _jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: campaign.platforms.map((p) => (_jsx("span", { className: "rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize", children: p }, p))) }), _jsxs("p", { className: "mt-1.5 text-xs text-muted-foreground", children: [campaign.keywords.slice(0, 5).join(', '), campaign.keywords.length > 5 && ` +${campaign.keywords.length - 5} more`] })] }), _jsxs("div", { className: "ml-4 flex shrink-0 items-center gap-2", children: [campaign.status === 'active' ? (_jsx("button", { title: "Pause campaign", type: "button", disabled: patching, onClick: () => patchStatus({ campaignId: campaign.id, status: 'paused' }), className: "rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50", children: _jsx(Pause, { className: "h-4 w-4" }) })) : campaign.status === 'paused' ? (_jsx("button", { title: "Resume campaign", type: "button", disabled: patching, onClick: () => patchStatus({ campaignId: campaign.id, status: 'active' }), className: "rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50", children: _jsx(Play, { className: "h-4 w-4" }) })) : null, _jsx("button", { title: "Delete campaign", type: "button", disabled: deleting, onClick: () => deleteCampaign(campaign.id), className: "rounded-lg p-1.5 text-destructive/60 hover:bg-red-50 hover:text-destructive disabled:opacity-50", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }));
}
function CampaignList() {
    const { data } = useSuspenseQuery(campaignsQueryOptions());
    const campaigns = data.data;
    if (!campaigns.length) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "No campaigns yet." }), _jsx(Link, { to: "/campaigns/new", className: "mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", children: "Create your first campaign" })] }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [campaigns.map((c) => (_jsx(CampaignRow, { campaign: c }, c.id))), data.meta && data.meta.hasMore && (_jsxs("p", { className: "py-3 text-center text-sm text-muted-foreground", children: ["Showing ", campaigns.length, " of ", data.meta.total, " campaigns."] }))] }));
}
function CampaignsPage() {
    return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-foreground", children: "Campaigns" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Manage your signal monitoring campaigns." })] }), _jsxs(Link, { to: "/campaigns/new", className: "flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", children: [_jsx(Plus, { className: "h-4 w-4" }), "New Campaign"] })] }), _jsx(ErrorBoundary, { fallback: _jsx("p", { className: "text-sm text-destructive", children: "Failed to load campaigns." }), children: _jsx(Suspense, { fallback: _jsx(CampaignListSkeleton, {}), children: _jsx(CampaignList, {}) }) })] }));
}
//# sourceMappingURL=index.js.map