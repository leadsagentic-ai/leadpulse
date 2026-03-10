import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sidebar } from './Sidebar';
export function Layout({ children }) {
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-background", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-y-auto", children: children })] }));
}
//# sourceMappingURL=Layout.js.map