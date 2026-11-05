import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { updateStep } from "../../actions";
import { StepForm } from "../../step-form";

export default async function EditStepPage({ params }: PageProps<"/chains/[id]/steps/[stepId]/edit">) {
  const { supabase } = await requireAdmin();
  const { id, stepId } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(stepId)) notFound();

  const [{ data: step }, { data: models }] = await Promise.all([
    supabase
      .from("prompt_chain_steps")
      .select("id, kind, name, instructions, prompt_text, model_id, temperature, prompt_chains(id, name)")
      .eq("id", Number(stepId))
      .eq("chain_id", Number(id))
      .maybeSingle(),
    supabase.from("llm_models").select("id, name, label, is_active").order("sort_order"),
  ]);
  if (!step) notFound();
  const chain = step.prompt_chains as unknown as { id: number; name: string };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href={`/chains/${chain.id}`} className="text-sm text-muted hover:text-ink">
        ← {chain.name}
      </Link>
      <h1 className="mt-6 mb-6 font-serif text-4xl text-ink">Edit step</h1>
      <StepForm
        action={updateStep.bind(null, chain.id, step.id)}
        initial={{
          kind: step.kind,
          name: step.name,
          instructions: step.instructions ?? "",
          prompt_text: step.prompt_text ?? "",
          model_id: step.model_id == null ? "" : String(step.model_id),
          temperature: step.temperature == null ? "" : String(step.temperature),
        }}
        models={models ?? []}
        submitLabel="Save changes"
      />
    </main>
  );
}
