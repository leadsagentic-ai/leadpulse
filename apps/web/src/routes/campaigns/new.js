import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from '@tanstack/react-router';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';
export const Route = createFileRoute('/campaigns/new')({
    component: NewCampaignPage,
});
function NewCampaignPage() {
    return (_jsxs("div", { className: "p-8", children: [_jsx("h1", { className: "mb-6 text-2xl font-bold text-foreground", children: "Create Campaign" }), _jsx(CampaignWizard, {})] }));
}
//# sourceMappingURL=new.js.map