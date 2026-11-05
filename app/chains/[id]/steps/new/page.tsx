import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { createStep } from "../actions";
import { StepForm } from "../step-form";

export default async function NewStepPage({ params }: PageProps<"/chains/[id]/steps/new">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const [{ data: chain }, { data: models }] = await Promise.all([
    supabase.from("prompt_chains").select("id, name").eq("id", Number(id)).maybeSingle(),
    supabase.from("llm_models").select("id, name, label, is_active").order("sort_order"),
  ]);
  if (!chain) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href={`/chains/${chain.id}`} className="text-sm text-muted hover:text-ink">
        ← {chain.name}
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink">Add step</h1>
      <p className="mt-2 mb-6 text-sm text-ink-soft">It goes at the end of the chain; move it with ↑ ↓ after.</p>
      <StepForm action={createStep.bind(null, chain.id)} models={models ?? []} submitLabel="Add step" />
    </main>
  );
}
