import { jsx as _jsx } from "react/jsx-runtime";
import { createRootRouteWithContext, Outlet, useRouterState, Navigate } from '@tanstack/react-router';
import { auth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/shared/Layout';
// Routes that don't require auth or a sidebar
const PUBLIC_PATHS = ['/login'];
function RootLayout() {
    const [user, setUser] = useState(undefined);
    const { location } = useRouterState();
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
        return unsubscribe;
    }, []);
    // Hold render until Firebase resolves the initial auth state
    if (user === undefined)
        return null;
    const isPublic = PUBLIC_PATHS.includes(location.pathname);
    // Unauthenticated users trying to access protected routes → redirect to login
    if (!user && !isPublic) {
        return _jsx(Navigate, { to: "/login" });
    }
    // Login (and any future public pages) render without the shell
    if (isPublic) {
        return _jsx(Outlet, {});
    }
    // Authenticated routes get the sidebar + main-area shell
    return (_jsx(Layout, { children: _jsx(Outlet, {}) }));
}
export const Route = createRootRouteWithContext()({
    component: RootLayout,
});
//# sourceMappingURL=__root.js.map