import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from '@tanstack/react-router';
const TIER_STYLES = {
    HOT: 'bg-red-100 text-red-700',
    WARM: 'bg-orange-100 text-orange-700',
    COOL: 'bg-blue-100 text-blue-700',
    WEAK: 'bg-gray-100 text-gray-600',
    DISCARD: 'bg-gray-100 text-gray-400',
};
const INTENT_LABELS = {
    BUYING_INTENT: 'Buying',
    PAIN_SIGNAL: 'Pain',
    COMPARISON_INTENT: 'Comparing',
    HIRING_INTENT: 'Hiring',
    ANNOUNCEMENT_INTENT: 'Announcement',
};
export function LeadCard({ lead, onStatusChange, isPending }) {
    const tierStyle = TIER_STYLES[lead.scoreTier] ?? 'bg-gray-100 text-gray-600';
    const intentLabel = INTENT_LABELS[lead.intentType] ?? lead.intentType;
    const isEnriched = !!(lead.email || lead.phone || lead.company || lead.linkedinUrl);
    return (_jsxs("div", { className: "rounded-xl border border-border bg-card p-5 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsxs("div", { className: `flex shrink-0 flex-col items-center rounded-lg px-2.5 py-1.5 ${tierStyle}`, children: [_jsx("span", { className: "text-lg font-bold leading-none", children: lead.leadScore }), _jsx("span", { className: "mt-0.5 text-[10px] font-semibold uppercase tracking-wide", children: lead.scoreTier })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: lead.name ?? lead.username }), lead.jobTitle && (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["\u00B7 ", lead.jobTitle] })), lead.company && (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["@ ", lead.company] }))] }), _jsxs("div", { className: "mt-1.5 flex flex-wrap gap-1.5", children: [_jsx("span", { className: "rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700", children: intentLabel }), _jsx("span", { className: "rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground", children: lead.platform }), lead.location && (_jsx("span", { className: "rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground", children: lead.location })), isEnriched && (_jsx("span", { className: "rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700", children: "enriched" }))] })] }), lead.status !== 'pending' && (_jsx("span", { className: `shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${lead.status === 'approved' ? 'bg-green-100 text-green-800' :
                            lead.status === 'discarded' ? 'bg-gray-100 text-gray-500' :
                                'bg-purple-100 text-purple-800'}`, children: lead.status }))] }), _jsx("p", { className: "line-clamp-2 text-sm text-foreground/80", children: lead.postText }), _jsxs("div", { className: "flex items-center gap-2 pt-1", children: [lead.status === 'pending' && onStatusChange && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: isPending, onClick: () => onStatusChange(lead.id, 'approved'), className: "rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50", children: "Approve" }), _jsx("button", { type: "button", disabled: isPending, onClick: () => onStatusChange(lead.id, 'discarded'), className: "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50", children: "Discard" })] })), _jsx(Link, { to: "/leads/$leadId", params: { leadId: lead.id }, className: "ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted", children: "View Profile \u2192" })] })] }));
}
//# sourceMappingURL=LeadCard.js.map