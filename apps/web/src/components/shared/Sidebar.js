import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { LayoutDashboard, Users, Megaphone, LogOut, Zap } from 'lucide-react';
import { signOut } from '@/lib/auth';
const NAV_ITEMS = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/leads', icon: Users, label: 'Leads' },
    { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
];
export function Sidebar() {
    const navigate = useNavigate();
    const { location } = useRouterState();
    const handleSignOut = async () => {
        await signOut();
        await navigate({ to: '/login' });
    };
    return (_jsxs("aside", { className: "flex h-full w-56 flex-col border-r border-border bg-card", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-border px-5 py-4", children: [_jsx(Zap, { className: "h-5 w-5 text-primary" }), _jsx("span", { className: "text-base font-bold text-foreground", children: "LeadPulse" })] }), _jsx("nav", { className: "flex flex-1 flex-col gap-0.5 p-3", children: NAV_ITEMS.map(({ to, icon: Icon, label }) => {
                    const active = location.pathname === to ||
                        (to !== '/dashboard' && location.pathname.startsWith(to));
                    return (_jsxs(Link, { to: to, className: [
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            active
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        ].join(' '), children: [_jsx(Icon, { className: "h-4 w-4 shrink-0" }), label] }, to));
                }) }), _jsx("div", { className: "border-t border-border p-3", children: _jsxs("button", { type: "button", onClick: handleSignOut, className: "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: [_jsx(LogOut, { className: "h-4 w-4 shrink-0" }), "Sign out"] }) })] }));
}
//# sourceMappingURL=Sidebar.js.map