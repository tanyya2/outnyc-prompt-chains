"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { KINDS, hasModel, hasPrompt } from "@/utils/steps";

// values: what was typed, so the form can show it again after an error
export type FormState = { error: string; values?: Record<string, string> } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// Reads and checks the step form. Fields that don't apply to the kind are saved empty.
function readForm(formData: FormData) {
  const values = {
    kind: text(formData, "kind"),
    name: text(formData, "name"),
    instructions: text(formData, "instructions"),
    prompt_text: text(formData, "prompt_text"),
    model_id: text(formData, "model_id"),
    temperature: text(formData, "temperature"),
  };
  const { kind } = values;
  const fail = (error: string) => ({ error, values });

  if (!Object.hasOwn(KINDS, kind)) return fail("Pick a kind of step.");
  if (!values.name || values.name.length > 100) return fail("Name is required (up to 100 characters).");
  if (values.instructions.length > 500) return fail("Keep \"What it does\" under 500 characters.");
  if (values.prompt_text.length > 20000) return fail("Keep the prompt under 20,000 characters.");
  if (kind === "prompt" && !values.prompt_text) return fail("Build the prompt needs prompt text.");

  const modelId = values.model_id ? Number(values.model_id) : null;
  if (modelId !== null && !Number.isInteger(modelId)) return fail("Pick a model.");
  const temperature = values.temperature === "" ? null : Number(values.temperature);
  if (temperature !== null && !(temperature >= 0 && temperature <= 2)) return fail("Temperature must be between 0 and 2.");

  return {
    row: {
      kind,
      name: values.name,
      instructions: values.instructions || null,
      prompt_text: hasPrompt(kind) ? values.prompt_text || null : null,
      model_id: hasModel(kind) ? modelId : null,
      temperature: hasModel(kind) ? temperature : null,
    },
    values,
  };
}

export async function createStep(chainId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const form = readForm(formData);
  if ("error" in form) return form;

  // A new step goes at the end
  const { data: last } = await supabase
    .from("prompt_chain_steps")
    .select("step_order")
    .eq("chain_id", chainId)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("prompt_chain_steps")
    .insert({ ...form.row, chain_id: chainId, step_order: (last?.step_order ?? 0) + 1 });
  if (error) return { error: `Couldn't save: ${error.message}`, values: form.values };

  redirect(`/chains/${chainId}?saved=1`);
}

export async function updateStep(chainId: number, stepId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const form = readForm(formData);
  if ("error" in form) return form;

  // .select() so a change blocked by RLS shows up as "nothing updated" instead of silent success
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .update(form.row)
    .eq("id", stepId)
    .eq("chain_id", chainId)
    .select("id");
  if (error) return { error: `Couldn't save: ${error.message}`, values: form.values };
  if (!data?.length) return { error: "Nothing was saved (not allowed, or the step is gone).", values: form.values };

  redirect(`/chains/${chainId}?saved=1`);
}

export async function deleteStep(chainId: number, stepId: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .delete()
    .eq("id", stepId)
    .eq("chain_id", chainId)
    .select("id");
  if (error) return { error: `Couldn't delete: ${error.message}` };
  if (!data?.length) return { error: "Nothing was deleted (not allowed, or the step is gone)." };
  redirect(`/chains/${chainId}`);
}

// Swaps the step with the one above or below (sql/prompt-chain-tool.sql)
export async function moveStep(chainId: number, stepId: number, direction: "up" | "down") {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("move_prompt_chain_step", { step_id: stepId, direction });
  if (error) console.error("moveStep failed", error);
  redirect(`/chains/${chainId}${error ? "?moveError=1" : ""}`);
}
