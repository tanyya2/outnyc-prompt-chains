"use server";

import { requireAdmin } from "@/utils/auth";
import { BUDGETS, CATEGORIES, NEIGHBORHOODS, RADII_MILES, type Category } from "@/lib/nyc";
import { runChain, type RunResult } from "@/lib/run-chain";

// values: what was picked, so the form keeps it after a run
export type GenerateState =
  | { error?: string; result?: RunResult; values: { neighborhood: string; radius: string; budget: string; purpose: string; categories: string[]; openNow: boolean } }
  | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// Runs the chain once with the form's request and returns the plan and each step's output
export async function generatePlan(chainId: number, _prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const { supabase } = await requireAdmin();
  const values = {
    neighborhood: text(formData, "neighborhood"),
    radius: text(formData, "radius"),
    budget: text(formData, "budget"),
    purpose: text(formData, "purpose"),
    categories: formData.getAll("categories").map(String),
    openNow: formData.get("openNow") === "on",
  };

  const place = NEIGHBORHOODS.find((n) => n.name === values.neighborhood);
  const radiusMiles = Number(values.radius);
  if (!place) return { error: "Pick a neighborhood.", values };
  if (!RADII_MILES.includes(radiusMiles as (typeof RADII_MILES)[number])) return { error: "Pick a distance.", values };
  if (!BUDGETS.includes(values.budget as (typeof BUDGETS)[number])) return { error: "Pick a budget.", values };
  if (values.purpose.length > 200) return { error: "Keep \"What for\" under 200 characters.", values };
  const categories = values.categories.filter((c): c is Category => Object.hasOwn(CATEGORIES, c));

  const result = await runChain(supabase, chainId, {
    neighborhood: place.name,
    lat: place.lat,
    lon: place.lon,
    radiusMiles,
    budget: values.budget,
    purpose: values.purpose,
    categories,
    openNow: values.openNow,
  });
  return { result, values };
}
