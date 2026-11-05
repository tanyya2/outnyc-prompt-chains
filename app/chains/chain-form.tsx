"use client";

import { useActionState, useLayoutEffect, useState } from "react";
import type { FormState } from "./actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: { name: string; description: string };
  // New chains only: chains whose steps can be copied
  copyable?: { id: number; name: string }[];
  submitLabel: string;
};

const input =
  "w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const label = "text-xs uppercase tracking-widest text-muted";

// Next keeps recently visited pages alive in the background, which would keep a
// half-filled form. Leaving the page bumps `visit`, so coming back starts fresh.
export function ChainForm(props: Props) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Form key={visit} {...props} />;
}

// Fields are uncontrolled; after an error the form is re-keyed with what was typed
function Form({ action, initial, copyable, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.values ?? { name: initial?.name ?? "", description: initial?.description ?? "", start: "" };

  return (
    <form key={JSON.stringify(values)} action={formAction} className="flex max-w-xl flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className={label}>Name *</span>
        <input name="name" required maxLength={100} defaultValue={values.name} className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Description</span>
        <textarea name="description" rows={3} maxLength={500} defaultValue={values.description} className={input} />
      </label>
      {copyable && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>Start from</span>
          <select name="start" defaultValue={values.start} className={input}>
            <option value="">Empty (no steps)</option>
            {copyable.map((chain) => (
              <option key={chain.id} value={chain.id}>
                Copy of {chain.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">A copy gets all its steps, prompts included, so you can change one thing and compare.</span>
        </label>
      )}
      {state?.error && <p className="text-sm text-down">{state.error}</p>}
      <button
        disabled={pending}
        className="self-start rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
