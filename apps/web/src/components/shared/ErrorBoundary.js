import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from 'react';
export class ErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (_jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-destructive", children: "Something went wrong. Please refresh the page." }));
        }
        return this.props.children;
    }
}
//# sourceMappingURL=ErrorBoundary.js.map