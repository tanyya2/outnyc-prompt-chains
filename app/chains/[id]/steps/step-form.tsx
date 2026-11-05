"use client";

import { useActionState, useLayoutEffect, useState } from "react";
import { KINDS, hasModel, hasPrompt } from "@/utils/steps";
import type { FormState } from "./actions";

export type StepValues = {
  kind: string;
  name: string;
  instructions: string;
  prompt_text: string;
  model_id: string;
  temperature: string;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: StepValues;
  models: { id: number; name: string; label: string | null; is_active: boolean }[];
  submitLabel: string;
};

const input =
  "w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const label = "text-xs uppercase tracking-widest text-muted";
const help = "text-xs text-muted";

const blank: StepValues = { kind: "llm_call", name: "", instructions: "", prompt_text: "", model_id: "", temperature: "" };

// Next keeps recently visited pages alive in the background, which would keep a
// half-filled form. Leaving the page bumps `visit`, so coming back starts fresh.
export function StepForm(props: Props) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Form key={visit} {...props} />;
}

// After an error the form is re-keyed with what was typed
function Form({ action, initial, models, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = (state?.values as StepValues | undefined) ?? initial ?? blank;
  return <Fields key={JSON.stringify(values)} values={values} formAction={formAction} pending={pending} error={state?.error} models={models} submitLabel={submitLabel} />;
}

function Fields({
  values,
  formAction,
  pending,
  error,
  models,
  submitLabel,
}: {
  values: StepValues;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  models: Props["models"];
  submitLabel: string;
}) {
  // The kind decides which fields show
  const [kind, setKind] = useState(values.kind);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className={label}>Kind *</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          {Object.entries(KINDS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Name *</span>
        <input name="name" required maxLength={100} defaultValue={values.name} className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>What it does</span>
        <textarea name="instructions" rows={2} maxLength={500} defaultValue={values.instructions} className={input} />
      </label>

      {hasPrompt(kind) && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>Prompt text{kind === "prompt" && " *"}</span>
          <textarea
            name="prompt_text"
            rows={14}
            defaultValue={values.prompt_text}
            className={`${input} font-mono text-xs`}
          />
          <span className={help}>
            {kind === "prompt"
              ? "Filled in for each plan: {purpose} {budget} {start} {places} {pick}."
              : "Empty = send the prompt from the Build the prompt step. Filled = this text is sent instead; {plan} is the plan so far."}
          </span>
        </label>
      )}

      {hasModel(kind) && (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Model</span>
            <select name="model_id" defaultValue={values.model_id} className={input}>
              <option value="">Active models, in order</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label || model.name}
                  {!model.is_active && " (inactive)"}
                </option>
              ))}
            </select>
            <span className={help}>The default tries the admin&apos;s active models in order.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Temperature</span>
            <input
              name="temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              placeholder="Gemini's default"
              defaultValue={values.temperature}
              className={input}
            />
            <span className={help}>0 = predictable, 2 = very creative. Empty = Gemini&apos;s default.</span>
          </label>
        </div>
      )}

      {error && <p className="text-sm text-down">{error}</p>}
      <button
        disabled={pending}
        className="self-start rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
