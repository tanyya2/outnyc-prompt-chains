"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

// Asks first; shows why if it didn't work
export function DeleteStepButton({ action, name }: { action: (prev: FormState, formData: FormData) => Promise<FormState>; name: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete the step "${name}"? This can't be undone.`)) e.preventDefault();
      }}
    >
      <button disabled={pending} className="text-sm text-down hover:underline disabled:opacity-60">
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error && <p className="text-xs text-down">{state.error}</p>}
    </form>
  );
}
