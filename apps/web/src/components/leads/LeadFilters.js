import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const PLATFORMS = ['reddit', 'bluesky', 'threads', 'mastodon', 'linkedin', 'github'];
const INTENT_TYPES = [
    { value: 'BUYING_INTENT', label: 'Buying Intent' },
    { value: 'PAIN_SIGNAL', label: 'Pain Signal' },
    { value: 'COMPARISON_INTENT', label: 'Comparing' },
    { value: 'HIRING_INTENT', label: 'Hiring Intent' },
    { value: 'ANNOUNCEMENT_INTENT', label: 'Announcement' },
];
const SCORE_TIERS = ['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'];
const STATUSES = ['pending', 'approved', 'discarded', 'pushed_crm'];
function Select({ label, value, options, onChange, }) {
    return (_jsxs("label", { className: "flex flex-col gap-1 text-xs font-medium text-muted-foreground", children: [label, _jsxs("select", { value: value ?? '', onChange: (e) => onChange(e.target.value || undefined), className: "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40", children: [_jsx("option", { value: "", children: "All" }), options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] })] }));
}
export function LeadFiltersBar({ filters, onChange }) {
    return (_jsxs("div", { className: "flex flex-wrap gap-4", children: [_jsx(Select, { label: "Platform", value: filters.platform, options: PLATFORMS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })), onChange: (v) => onChange({ ...filters, ...(v !== undefined ? { platform: v } : { platform: undefined }), page: 1 }) }), _jsx(Select, { label: "Intent", value: filters.intentType, options: INTENT_TYPES, onChange: (v) => onChange({ ...filters, ...(v !== undefined ? { intentType: v } : { intentType: undefined }), page: 1 }) }), _jsx(Select, { label: "Score Tier", value: filters.scoreTier, options: SCORE_TIERS.map((t) => ({ value: t, label: t })), onChange: (v) => onChange({ ...filters, ...(v !== undefined ? { scoreTier: v } : { scoreTier: undefined }), page: 1 }) }), _jsx(Select, { label: "Status", value: filters.status, options: STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') })), onChange: (v) => onChange({ ...filters, ...(v !== undefined ? { status: v } : { status: undefined }), page: 1 }) })] }));
}
//# sourceMappingURL=LeadFilters.js.map