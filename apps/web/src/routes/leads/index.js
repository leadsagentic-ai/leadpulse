import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { LeadFeed } from '@/components/leads/LeadFeed';
import { LeadFiltersBar } from '@/components/leads/LeadFilters';
import { useExportLeads } from '@/lib/queries/leads.queries';
export const Route = createFileRoute('/leads/')({
    component: LeadsPage,
});
function LeadsPage() {
    const [filters, setFilters] = useState({ page: 1, limit: 25 });
    const { mutate: exportLeads, isPending: exporting } = useExportLeads();
    function handleExport() {
        exportLeads(filters, {
            onSuccess: ({ data: { key } }) => {
                const apiUrl = import.meta.env.VITE_API_URL;
                window.open(`${apiUrl.replace(/\/$/, '')}/api/v1/leads/exports/${encodeURIComponent(key)}`, '_blank');
            },
        });
    }
    return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-foreground", children: "Leads" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Review and manage captured buyer signals." })] }), _jsxs("button", { type: "button", disabled: exporting, onClick: handleExport, className: "flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50", children: [_jsx(Download, { className: "h-4 w-4" }), exporting ? 'Exporting…' : 'Export CSV'] })] }), _jsx("div", { className: "mb-5", children: _jsx(LeadFiltersBar, { filters: filters, onChange: setFilters }) }), _jsx(LeadFeed, { filters: filters })] }));
}
//# sourceMappingURL=index.js.map