import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute } from '@tanstack/react-router';
import { LeadProfile } from '@/components/leads/LeadProfile';
export const Route = createFileRoute('/leads/$leadId')({
    component: LeadProfilePage,
});
function LeadProfilePage() {
    const { leadId } = Route.useParams();
    return (_jsx("div", { className: "p-8", children: _jsx(LeadProfile, { leadId: leadId }) }));
}
//# sourceMappingURL=$leadId.js.map