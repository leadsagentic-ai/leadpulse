import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});
const router = createRouter({
    routeTree,
    context: { queryClient },
});
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(RouterProvider, { router: router }) }) }));
//# sourceMappingURL=main.js.map