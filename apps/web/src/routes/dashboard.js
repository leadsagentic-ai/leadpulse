import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth';
export const Route = createFileRoute('/dashboard')({
    component: DashboardPage,
});
function DashboardPage() {
    const user = auth.currentUser;
    return (_jsxs("div", { className: "p-8", children: [_jsx("h1", { className: "text-2xl font-bold text-foreground", children: "Dashboard" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: user?.email }), _jsx("p", { className: "mt-4 text-sm text-muted-foreground", children: "Welcome to LeadPulse Intelligence. Create your first campaign to start monitoring signals." })] }));
}
//# sourceMappingURL=dashboard.js.map