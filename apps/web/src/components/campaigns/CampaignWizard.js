import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { useCreateCampaign } from '@/lib/queries/campaigns.queries';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
// ── Step schemas ───────────────────────────────────────────────────────────────
const step1Schema = z.object({
    name: z.string().min(1, 'Campaign name is required').max(255),
    keywords: z.string().min(1, 'At least one keyword is required'),
    exclusionKeywords: z.string().default(''),
});
const step2Schema = z.object({
    platforms: z.array(z.string()).min(1, 'Select at least one platform'),
    subredditTargets: z.string().default(''),
});
const step3Schema = z.object({
    intentFilters: z.array(z.string()).default([]),
    personaFilter: z.string().max(500).default(''),
    minEngagement: z.coerce.number().int().min(0).default(0),
});
const step4Schema = z.object({
    notificationFreq: z.enum(['realtime', 'hourly', 'daily']).default('daily'),
});
// ── Constants ─────────────────────────────────────────────────────────────────
const PLATFORMS = [
    { id: 'reddit', label: 'Reddit' },
    { id: 'bluesky', label: 'Bluesky' },
    { id: 'threads', label: 'Threads' },
    { id: 'mastodon', label: 'Mastodon' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'github', label: 'GitHub' },
];
const INTENT_TYPES = [
    { id: 'BUYING_INTENT', label: 'Buying Intent' },
    { id: 'PAIN_SIGNAL', label: 'Pain Signal' },
    { id: 'COMPARISON_INTENT', label: 'Comparison Intent' },
    { id: 'HIRING_INTENT', label: 'Hiring Intent' },
    { id: 'ANNOUNCEMENT_INTENT', label: 'Announcement Intent' },
];
const STEPS = ['Campaign Info', 'Platforms', 'Intent Filters', 'Notifications'];
// ── Checkbox helper ───────────────────────────────────────────────────────────
function CheckboxGroup({ options, value, onChange, }) {
    const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    return (_jsx("div", { className: "flex flex-wrap gap-2", children: options.map(({ id, label }) => (_jsx("button", { type: "button", onClick: () => toggle(id), className: [
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                value.includes(id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50',
            ].join(' '), children: label }, id))) }));
}
// ── Wizard ────────────────────────────────────────────────────────────────────
export function CampaignWizard() {
    const navigate = useNavigate();
    const { mutateAsync: createCampaign, isPending } = useCreateCampaign();
    const [step, setStep] = useState(0);
    // Per-step form state collected as wizard progresses
    const [step1Data, setStep1Data] = useState(null);
    const [step2Data, setStep2Data] = useState(null);
    const [step3Data, setStep3Data] = useState(null);
    const form1 = useForm({ resolver: zodResolver(step1Schema) });
    const form2 = useForm({
        resolver: zodResolver(step2Schema),
        defaultValues: { platforms: [], subredditTargets: '' },
    });
    const form3 = useForm({
        resolver: zodResolver(step3Schema),
        defaultValues: { intentFilters: [], personaFilter: '', minEngagement: 0 },
    });
    const form4 = useForm({
        resolver: zodResolver(step4Schema),
        defaultValues: { notificationFreq: 'daily' },
    });
    // ── Step navigation ──────────────────────────────────────────────────────
    const handleStep1 = form1.handleSubmit((data) => {
        setStep1Data(data);
        setStep(1);
    });
    const handleStep2 = form2.handleSubmit((data) => {
        setStep2Data(data);
        setStep(2);
    });
    const handleStep3 = form3.handleSubmit((data) => {
        setStep3Data(data);
        setStep(3);
    });
    const handleSubmit = form4.handleSubmit(async (step4) => {
        if (!step1Data || !step2Data || !step3Data)
            return;
        const parsed1 = step1Schema.parse(step1Data);
        const input = {
            name: parsed1.name,
            keywords: parsed1.keywords.split(',').map((k) => k.trim()).filter(Boolean),
            exclusionKeywords: parsed1.exclusionKeywords.split(',').map((k) => k.trim()).filter(Boolean),
            platforms: step2Data.platforms,
            subredditTargets: step2Data.subredditTargets.split(',').map((s) => s.trim()).filter(Boolean),
            intentFilters: step3Data.intentFilters,
            ...(step3Data.personaFilter ? { personaFilter: step3Data.personaFilter } : {}),
            minEngagement: step3Data.minEngagement,
            notificationFreq: step4.notificationFreq,
            language: 'en',
            geoFilter: [],
        };
        await createCampaign(input);
        await navigate({ to: '/campaigns' });
    });
    // ── Step render ──────────────────────────────────────────────────────────
    const fieldClass = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';
    const errClass = 'mt-1 text-xs text-destructive';
    const labelClass = 'block text-sm font-medium text-foreground mb-1';
    return (_jsxs("div", { className: "mx-auto max-w-2xl", children: [_jsx("div", { className: "mb-8 flex items-center gap-0", children: STEPS.map((label, i) => (_jsxs("div", { className: "flex flex-1 items-center", children: [_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("div", { className: [
                                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                                        i < step
                                            ? 'bg-primary text-primary-foreground'
                                            : i === step
                                                ? 'border-2 border-primary text-primary'
                                                : 'border-2 border-border text-muted-foreground',
                                    ].join(' '), children: i < step ? _jsx(Check, { className: "h-4 w-4" }) : i + 1 }), _jsx("span", { className: "text-xs text-muted-foreground hidden sm:block", children: label })] }), i < STEPS.length - 1 && (_jsx("div", { className: `flex-1 h-px mx-2 ${i < step ? 'bg-primary' : 'bg-border'}` }))] }, label))) }), step === 0 && (_jsxs("form", { onSubmit: handleStep1, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Campaign name *" }), _jsx("input", { ...form1.register('name'), className: fieldClass, placeholder: "e.g. SaaS decision makers" }), form1.formState.errors.name && _jsx("p", { className: errClass, children: form1.formState.errors.name.message })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Keywords (comma-separated) *" }), _jsx("input", { ...form1.register('keywords'), className: fieldClass, placeholder: "e.g. CRM, Salesforce, HubSpot" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Signals containing these keywords will be captured." }), form1.formState.errors.keywords && _jsx("p", { className: errClass, children: form1.formState.errors.keywords.message })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Exclusion keywords (comma-separated)" }), _jsx("input", { ...form1.register('exclusionKeywords'), className: fieldClass, placeholder: "e.g. job, hiring, intern" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Signals containing these keywords will be skipped." })] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { type: "submit", className: "flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", children: ["Next ", _jsx(ChevronRight, { className: "h-4 w-4" })] }) })] })), step === 1 && (_jsxs("form", { onSubmit: handleStep2, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Platforms *" }), _jsx(CheckboxGroup, { options: PLATFORMS, value: form2.watch('platforms'), onChange: (v) => form2.setValue('platforms', v, { shouldValidate: true }) }), form2.formState.errors.platforms && _jsx("p", { className: errClass, children: form2.formState.errors.platforms.message })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Subreddits to monitor (comma-separated)" }), _jsx("input", { ...form2.register('subredditTargets'), className: fieldClass, placeholder: "e.g. r/sales, r/startups" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsxs("button", { type: "button", onClick: () => setStep(0), className: "flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted", children: [_jsx(ChevronLeft, { className: "h-4 w-4" }), " Back"] }), _jsxs("button", { type: "submit", className: "flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", children: ["Next ", _jsx(ChevronRight, { className: "h-4 w-4" })] })] })] })), step === 2 && (_jsxs("form", { onSubmit: handleStep3, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Intent types to capture" }), _jsx("p", { className: "mb-2 text-xs text-muted-foreground", children: "Leave all unselected to capture every intent type." }), _jsx(CheckboxGroup, { options: INTENT_TYPES, value: form3.watch('intentFilters'), onChange: (v) => form3.setValue('intentFilters', v) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Persona filter" }), _jsx("textarea", { ...form3.register('personaFilter'), rows: 3, className: fieldClass, placeholder: "e.g. VP Sales or Head of Revenue at a B2B SaaS company with 50-500 employees" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Describe your ideal buyer. The ML classifier uses this to score persona match." })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Minimum engagement (upvotes / likes)" }), _jsx("input", { ...form3.register('minEngagement'), type: "number", min: 0, className: fieldClass })] }), _jsxs("div", { className: "flex justify-between", children: [_jsxs("button", { type: "button", onClick: () => setStep(1), className: "flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted", children: [_jsx(ChevronLeft, { className: "h-4 w-4" }), " Back"] }), _jsxs("button", { type: "submit", className: "flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", children: ["Next ", _jsx(ChevronRight, { className: "h-4 w-4" })] })] })] })), step === 3 && (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Notification frequency" }), _jsxs("select", { ...form4.register('notificationFreq'), className: fieldClass, children: [_jsx("option", { value: "realtime", children: "Real-time (immediately when a HOT lead is found)" }), _jsx("option", { value: "hourly", children: "Hourly digest" }), _jsx("option", { value: "daily", children: "Daily digest" })] })] }), _jsxs("div", { className: "rounded-xl border border-border bg-muted p-4 space-y-2 text-sm", children: [_jsx("p", { className: "font-medium text-foreground", children: "Campaign summary" }), _jsxs("p", { className: "text-muted-foreground", children: [_jsx("span", { className: "font-medium text-foreground", children: "Name:" }), " ", step1Data?.name] }), _jsxs("p", { className: "text-muted-foreground", children: [_jsx("span", { className: "font-medium text-foreground", children: "Keywords:" }), " ", step1Data?.keywords] }), _jsxs("p", { className: "text-muted-foreground", children: [_jsx("span", { className: "font-medium text-foreground", children: "Platforms:" }), " ", step2Data?.platforms.join(', ')] }), step3Data?.intentFilters && step3Data.intentFilters.length > 0 && (_jsxs("p", { className: "text-muted-foreground", children: [_jsx("span", { className: "font-medium text-foreground", children: "Intent filters:" }), " ", step3Data.intentFilters.join(', ')] }))] }), _jsxs("div", { className: "flex justify-between", children: [_jsxs("button", { type: "button", onClick: () => setStep(2), className: "flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted", children: [_jsx(ChevronLeft, { className: "h-4 w-4" }), " Back"] }), _jsx("button", { type: "submit", disabled: isPending, className: "flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60", children: isPending ? 'Creating…' : 'Create Campaign' })] })] }))] }));
}
//# sourceMappingURL=CampaignWizard.js.map