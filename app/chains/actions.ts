"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/auth";

// values: what was typed, so the form can show it again after an error
export type FormState = { error: string; values?: Record<string, string> } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// Reads and checks the chain form
function readForm(formData: FormData) {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const values = { name, description, start: text(formData, "start") };
  if (!name || name.length > 100) return { error: "Name is required (up to 100 characters).", values };
  if (description.length > 500) return { error: "Keep the description under 500 characters.", values };
  return { name, description: description || null, values };
}

// Postgres "unique_violation": another chain already has this name
const nameTaken = (error: { code?: string }) => error.code === "23505";

export async function createChain(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const form = readForm(formData);
  if (form.error !== undefined) return form;

  // "Start from": empty, or a copy of another chain's steps
  const copyFrom = form.values.start ? Number(form.values.start) : null;
  if (copyFrom !== null && !Number.isInteger(copyFrom)) return { error: "Pick what to start from.", values: form.values };

  const { data: chain, error } = await supabase
    .from("prompt_chains")
    .insert({ name: form.name, description: form.description })
    .select("id")
    .single();
  if (error) {
    const message = nameTaken(error) ? "Another chain already has this name." : `Couldn't save: ${error.message}`;
    return { error: message, values: form.values };
  }

  if (copyFrom !== null) {
    const { data: steps, error: readError } = await supabase
      .from("prompt_chain_steps")
      .select("step_order, name, kind, instructions, prompt_text, model_id, temperature")
      .eq("chain_id", copyFrom);
    let copyError = readError;
    if (!copyError && steps?.length) {
      ({ error: copyError } = await supabase
        .from("prompt_chain_steps")
        .insert(steps.map((step) => ({ ...step, chain_id: chain.id }))));
    }
    if (copyError) {
      // Don't leave a half-made chain behind
      await supabase.from("prompt_chains").delete().eq("id", chain.id);
      return { error: `Couldn't copy the steps: ${copyError.message}`, values: form.values };
    }
  }

  redirect(`/chains/${chain.id}?saved=1`);
}

export async function updateChain(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const form = readForm(formData);
  if (form.error !== undefined) return form;

  // .select() so a change blocked by RLS shows up as "nothing updated" instead of silent success
  const { data, error } = await supabase
    .from("prompt_chains")
    .update({ name: form.name, description: form.description })
    .eq("id", id)
    .select("id");
  if (error) {
    const message = nameTaken(error) ? "Another chain already has this name." : `Couldn't save: ${error.message}`;
    return { error: message, values: form.values };
  }
  if (!data?.length) return { error: "Nothing was saved (not allowed, or the chain is gone).", values: form.values };

  redirect(`/chains/${id}?saved=1`);
}

// Its steps and mix weight go with it (on delete cascade); logs keep their rows but lose the link
export async function deleteChain(id: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("prompt_chains").delete().eq("id", id).select("id");
  if (error) return { error: `Couldn't delete: ${error.message}` };
  if (!data?.length) return { error: "Nothing was deleted (not allowed, or the chain is gone)." };
  redirect("/?deleted=1");
}
