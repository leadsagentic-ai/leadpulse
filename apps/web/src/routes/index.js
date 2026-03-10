import { jsx as _jsx } from "react/jsx-runtime";
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { auth } from '@/lib/auth';
export const Route = createFileRoute('/')({
    component: IndexPage,
});
function IndexPage() {
    const user = auth.currentUser;
    if (user) {
        return _jsx(Navigate, { to: "/dashboard" });
    }
    return _jsx(Navigate, { to: "/login" });
}
//# sourceMappingURL=index.js.map