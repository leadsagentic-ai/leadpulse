import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { useCreateCampaign } from '@/lib/queries/campaigns.queries'
import type { CreateCampaignInput } from '@/lib/types'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'

// ── Step schemas ───────────────────────────────────────────────────────────────

const step1Schema = z.object({
  name:              z.string().min(1, 'Campaign name is required').max(255),
  keywords:          z.string().min(1, 'At least one keyword is required'),
  exclusionKeywords: z.string().default(''),
})

const step2Schema = z.object({
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  subredditTargets: z.string().default(''),
})

const step3Schema = z.object({
  intentFilters: z.array(z.string()).default([]),
  personaFilter: z.string().max(500).default(''),
  minEngagement: z.coerce.number().int().min(0).default(0),
})

const step4Schema = z.object({
  notificationFreq: z.enum(['realtime', 'hourly', 'daily']).default('daily'),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>
type Step3 = z.infer<typeof step3Schema>
type Step4 = z.infer<typeof step4Schema>

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'reddit',   label: 'Reddit'   },
  { id: 'bluesky',  label: 'Bluesky'  },
  { id: 'threads',  label: 'Threads'  },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'github',   label: 'GitHub'   },
]

const INTENT_TYPES = [
  { id: 'BUYING_INTENT',       label: 'Buying Intent'       },
  { id: 'PAIN_SIGNAL',         label: 'Pain Signal'         },
  { id: 'COMPARISON_INTENT',   label: 'Comparison Intent'   },
  { id: 'HIRING_INTENT',       label: 'Hiring Intent'       },
  { id: 'ANNOUNCEMENT_INTENT', label: 'Announcement Intent' },
]

const STEPS = ['Campaign Info', 'Platforms', 'Intent Filters', 'Notifications']

// ── Checkbox helper ───────────────────────────────────────────────────────────

function CheckboxGroup({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => toggle(id)}
          className={[
            'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
            value.includes(id)
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-primary/50',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export function CampaignWizard() {
  const navigate = useNavigate()
  const { mutateAsync: createCampaign, isPending } = useCreateCampaign()
  const [step, setStep] = useState(0)

  // Per-step form state collected as wizard progresses
  const [step1Data, setStep1Data] = useState<Step1 | null>(null)
  const [step2Data, setStep2Data] = useState<Step2 | null>(null)
  const [step3Data, setStep3Data] = useState<Step3 | null>(null)

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) })
  const form2 = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: { platforms: [], subredditTargets: '' },
  })
  const form3 = useForm<Step3>({
    resolver: zodResolver(step3Schema),
    defaultValues: { intentFilters: [], personaFilter: '', minEngagement: 0 },
  })
  const form4 = useForm<Step4>({
    resolver: zodResolver(step4Schema),
    defaultValues: { notificationFreq: 'daily' },
  })

  // ── Step navigation ──────────────────────────────────────────────────────

  const handleStep1 = form1.handleSubmit((data) => {
    setStep1Data(data)
    setStep(1)
  })

  const handleStep2 = form2.handleSubmit((data) => {
    setStep2Data(data)
    setStep(2)
  })

  const handleStep3 = form3.handleSubmit((data) => {
    setStep3Data(data)
    setStep(3)
  })

  const handleSubmit = form4.handleSubmit(async (step4) => {
    if (!step1Data || !step2Data || !step3Data) return

    const parsed1 = step1Schema.parse(step1Data)
    const input: CreateCampaignInput = {
      name:              parsed1.name,
      keywords:          parsed1.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      exclusionKeywords: parsed1.exclusionKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      platforms:         step2Data.platforms,
      subredditTargets:  step2Data.subredditTargets.split(',').map((s) => s.trim()).filter(Boolean),
      intentFilters:     step3Data.intentFilters as CreateCampaignInput['intentFilters'],
      ...(step3Data.personaFilter ? { personaFilter: step3Data.personaFilter } : {}),
      minEngagement:     step3Data.minEngagement,
      notificationFreq:  step4.notificationFreq,
      language: 'en',
      geoFilter: [],
    }

    await createCampaign(input)
    await navigate({ to: '/campaigns' })
  })

  // ── Step render ──────────────────────────────────────────────────────────

  const fieldClass = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'
  const errClass   = 'mt-1 text-xs text-destructive'
  const labelClass = 'block text-sm font-medium text-foreground mb-1'

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'border-2 border-primary text-primary'
                      : 'border-2 border-border text-muted-foreground',
                ].join(' ')}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Campaign Info */}
      {step === 0 && (
        <form onSubmit={handleStep1} className="space-y-5">
          <div>
            <label className={labelClass}>Campaign name *</label>
            <input {...form1.register('name')} className={fieldClass} placeholder="e.g. SaaS decision makers" />
            {form1.formState.errors.name && <p className={errClass}>{form1.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Keywords (comma-separated) *</label>
            <input {...form1.register('keywords')} className={fieldClass} placeholder="e.g. CRM, Salesforce, HubSpot" />
            <p className="mt-1 text-xs text-muted-foreground">Signals containing these keywords will be captured.</p>
            {form1.formState.errors.keywords && <p className={errClass}>{form1.formState.errors.keywords.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Exclusion keywords (comma-separated)</label>
            <input {...form1.register('exclusionKeywords')} className={fieldClass} placeholder="e.g. job, hiring, intern" />
            <p className="mt-1 text-xs text-muted-foreground">Signals containing these keywords will be skipped.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 2 — Platforms */}
      {step === 1 && (
        <form onSubmit={handleStep2} className="space-y-5">
          <div>
            <label className={labelClass}>Platforms *</label>
            <CheckboxGroup
              options={PLATFORMS}
              value={form2.watch('platforms')}
              onChange={(v) => form2.setValue('platforms', v, { shouldValidate: true })}
            />
            {form2.formState.errors.platforms && <p className={errClass}>{form2.formState.errors.platforms.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Subreddits to monitor (comma-separated)</label>
            <input {...form2.register('subredditTargets')} className={fieldClass} placeholder="e.g. r/sales, r/startups" />
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(0)} className="flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 3 — Intent Filters */}
      {step === 2 && (
        <form onSubmit={handleStep3} className="space-y-5">
          <div>
            <label className={labelClass}>Intent types to capture</label>
            <p className="mb-2 text-xs text-muted-foreground">Leave all unselected to capture every intent type.</p>
            <CheckboxGroup
              options={INTENT_TYPES}
              value={form3.watch('intentFilters')}
              onChange={(v) => form3.setValue('intentFilters', v)}
            />
          </div>
          <div>
            <label className={labelClass}>Persona filter</label>
            <textarea
              {...form3.register('personaFilter')}
              rows={3}
              className={fieldClass}
              placeholder="e.g. VP Sales or Head of Revenue at a B2B SaaS company with 50-500 employees"
            />
            <p className="mt-1 text-xs text-muted-foreground">Describe your ideal buyer. The ML classifier uses this to score persona match.</p>
          </div>
          <div>
            <label className={labelClass}>Minimum engagement (upvotes / likes)</label>
            <input {...form3.register('minEngagement')} type="number" min={0} className={fieldClass} />
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 4 — Notifications + Confirm */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Notification frequency</label>
            <select {...form4.register('notificationFreq')} className={fieldClass}>
              <option value="realtime">Real-time (immediately when a HOT lead is found)</option>
              <option value="hourly">Hourly digest</option>
              <option value="daily">Daily digest</option>
            </select>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border bg-muted p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">Campaign summary</p>
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Name:</span> {step1Data?.name}</p>
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Keywords:</span> {step1Data?.keywords}</p>
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Platforms:</span> {step2Data?.platforms.join(', ')}</p>
            {step3Data?.intentFilters && step3Data.intentFilters.length > 0 && (
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Intent filters:</span> {step3Data.intentFilters.join(', ')}</p>
            )}
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
