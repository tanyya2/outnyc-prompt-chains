"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  steps: number;
};

// Asks first: the chain's steps and mix weight are deleted with it
export function DeleteButton({ action, steps }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const also = steps > 0 ? ` and its ${steps} ${steps === 1 ? "step" : "steps"}` : "";
        if (!confirm(`Delete this chain${also}? Logs keep their rows. This can't be undone.`)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <button
        disabled={pending}
        className="self-start rounded-full border border-down px-5 py-2.5 text-sm font-medium text-down hover:bg-down hover:text-on-accent disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete chain"}
      </button>
      {state?.error && <p className="text-sm text-down">{state.error}</p>}
    </form>
  );
}
