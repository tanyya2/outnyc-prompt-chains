"use client";

import { useActionState } from "react";
import { BUDGETS, CATEGORIES, NEIGHBORHOODS, RADII_MILES } from "@/lib/nyc";
import { kindLabel } from "@/utils/steps";
import type { GenerateState } from "./actions";

type Props = { action: (prev: GenerateState, formData: FormData) => Promise<GenerateState> };

const input =
  "w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const label = "text-xs uppercase tracking-widest text-muted";

// The request (same choices as OutNYC), then the plan and what each step did
export function GenerateForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values;
  const result = state?.result;

  return (
    <div>
      <form key={JSON.stringify(values)} action={formAction} className="grid gap-4 rounded-2xl border border-line bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Where</span>
          <select name="neighborhood" defaultValue={values?.neighborhood ?? NEIGHBORHOODS[0].name} className={input}>
            {NEIGHBORHOODS.map((n) => (
              <option key={n.name}>{n.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Within</span>
          <select name="radius" defaultValue={values?.radius ?? "1"} className={input}>
            {RADII_MILES.map((miles) => (
              <option key={miles} value={miles}>
                {miles} {miles === 1 ? "mile" : "miles"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Budget</span>
          <select name="budget" defaultValue={values?.budget ?? "$$"} className={input}>
            {BUDGETS.map((budget) => (
              <option key={budget}>{budget}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>What for</span>
          <input name="purpose" maxLength={200} placeholder="e.g. cheap date" defaultValue={values?.purpose ?? ""} className={input} />
        </label>

        <fieldset className="sm:col-span-2 lg:col-span-4">
          <legend className={label}>Include (none = any kind)</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(CATEGORIES).map(([value, { label: text }]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="categories" value={value} defaultChecked={values?.categories.includes(value)} className="accent-accent" />
                {text}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-5 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="openNow" defaultChecked={values?.openNow ?? true} className="accent-accent" />
            Only places open now
          </label>
          <button
            disabled={pending}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-60"
          >
            {pending ? "Generating… (up to a minute)" : "Generate"}
          </button>
          <span className="text-xs text-muted">Uses Google searches from the daily 30 shared with OutNYC.</span>
        </div>
        {state?.error && <p className="text-sm text-down sm:col-span-2 lg:col-span-4">{state.error}</p>}
      </form>

      {result && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="text-xs uppercase tracking-widest text-muted">The plan</h3>
            {result.error && <p className="mt-2 text-sm text-down">{result.error}</p>}
            {result.plan ? (
              <div className="mt-2 rounded-2xl border border-line bg-card p-5">
                <p className="font-serif text-2xl text-ink">{result.plan.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {result.planId
                    ? `Saved as plan #${result.planId}`
                    : result.error
                      ? "Not saved: the chain stopped at the failed step. This is what the AI made before that."
                      : "Not saved (no Save the plan step)"}
                </p>
                <ol className="mt-4 flex flex-col gap-4">
                  {result.plan.stops.map((stop, i) => (
                    <li key={i}>
                      <p className="text-ink">
                        {i + 1}. {stop.mapsUrl ? <a href={stop.mapsUrl} target="_blank" rel="noreferrer" className="hover:underline">{stop.name}</a> : stop.name}
                      </p>
                      <p className="text-xs text-muted">
                        {stop.category} · ~{stop.minutes} min
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">{stop.note}</p>
                    </li>
                  ))}
                </ol>
                {result.plan.tip && <p className="mt-4 text-sm text-ink-soft">Tip: {result.plan.tip}</p>}
              </div>
            ) : (
              !result.error && <p className="mt-2 text-sm text-ink-soft">No plan.</p>
            )}
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-widest text-muted">What each step did</h3>
            <ol className="mt-2 flex flex-col gap-2">
              {result.steps.map((step, i) => (
                <li key={i} className="rounded-xl border border-line bg-card">
                  <details open={!step.ok}>
                    <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="text-ink">
                        <span className={step.ok ? "text-accent" : "text-down"}>{step.ok ? "✓" : "✗"}</span> {i + 1}. {step.name}{" "}
                        <span className="text-muted">· {kindLabel(step.kind)}</span>
                      </span>
                      <span className="text-xs text-muted tabular-nums">{(step.ms / 1000).toFixed(1)}s</span>
                    </summary>
                    <pre className="max-h-96 overflow-auto border-t border-line px-4 py-3 font-mono text-xs whitespace-pre-wrap text-ink-soft">
                      {step.output}
                    </pre>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
