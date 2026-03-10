import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Reusable skeleton building block
function Bone({ className }) {
    return _jsx("div", { className: `animate-pulse rounded bg-gray-200 ${className ?? ''}` });
}
// ── Lead skeletons ─────────────────────────────────────────────────────────────
export function LeadCardSkeleton() {
    return (_jsxs("div", { className: "rounded-xl border border-border bg-card p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Bone, { className: "h-5 w-20" }), _jsx(Bone, { className: "h-5 w-12" })] }), _jsx(Bone, { className: "h-4 w-full" }), _jsx(Bone, { className: "h-4 w-4/5" }), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx(Bone, { className: "h-5 w-24" }), _jsx(Bone, { className: "h-5 w-20" })] })] }));
}
export function LeadFeedSkeleton({ rows = 8 }) {
    return (_jsx("div", { className: "flex flex-col gap-3", children: Array.from({ length: rows }).map((_, i) => (_jsx(LeadCardSkeleton, {}, i))) }));
}
export function LeadProfileSkeleton() {
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "rounded-xl border border-border bg-card p-6 space-y-4", children: [_jsx(Bone, { className: "h-6 w-48" }), _jsx(Bone, { className: "h-4 w-full" }), _jsx(Bone, { className: "h-4 w-5/6" }), _jsx(Bone, { className: "h-4 w-3/4" })] }), _jsxs("div", { className: "rounded-xl border border-border bg-card p-6 space-y-4", children: [_jsx(Bone, { className: "h-6 w-36" }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx(Bone, { className: "h-8 w-full" }, i))) })] }), _jsxs("div", { className: "rounded-xl border border-border bg-card p-6 space-y-3", children: [_jsx(Bone, { className: "h-6 w-28" }), Array.from({ length: 5 }).map((_, i) => (_jsx(Bone, { className: "h-5 w-full" }, i)))] })] }));
}
// ── Campaign skeletons ─────────────────────────────────────────────────────────
export function CampaignCardSkeleton() {
    return (_jsxs("div", { className: "rounded-xl border border-border bg-card p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Bone, { className: "h-5 w-36" }), _jsx(Bone, { className: "h-5 w-16" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Bone, { className: "h-6 w-16" }), _jsx(Bone, { className: "h-6 w-16" }), _jsx(Bone, { className: "h-6 w-20" })] }), _jsx(Bone, { className: "h-4 w-48" })] }));
}
export function CampaignListSkeleton({ rows = 4 }) {
    return (_jsx("div", { className: "flex flex-col gap-3", children: Array.from({ length: rows }).map((_, i) => (_jsx(CampaignCardSkeleton, {}, i))) }));
}
//# sourceMappingURL=Skeletons.js.map