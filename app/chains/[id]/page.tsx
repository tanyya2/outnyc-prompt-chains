import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { formatDate, hasModel, kindLabel, usesAI } from "@/utils/steps";
import { deleteChain } from "../actions";
import { DeleteButton } from "../delete-button";
import { deleteStep, moveStep } from "./steps/actions";
import { DeleteStepButton } from "./steps/delete-step-button";

type Step = {
  id: number;
  step_order: number;
  name: string;
  kind: string;
  instructions: string | null;
  prompt_text: string | null;
  temperature: number | null;
  llm_models: { name: string; label: string | null } | null;
};

type Chain = {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  prompt_chain_steps: Step[];
};

// One chain: what it is, and its steps in order (add, edit, delete, move)
export default async function ChainPage({ params, searchParams }: PageProps<"/chains/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { saved, moveError } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const { data, error } = await supabase
    .from("prompt_chains")
    .select(
      "id, created_at, name, description, prompt_chain_steps(id, step_order, name, kind, instructions, prompt_text, temperature, llm_models(name, label))",
    )
    .eq("id", Number(id))
    .maybeSingle();
  if (error) {
    return <p className="mx-auto w-full max-w-screen-2xl px-6 py-6 text-sm text-down">Couldn&apos;t load this chain: {error.message}</p>;
  }
  if (!data) notFound();

  const chain = data as unknown as Chain;
  const steps = [...chain.prompt_chain_steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All chains
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Chain · added {formatDate(chain.created_at)}</p>
          <h1 className="mt-2 font-serif text-4xl text-ink">{chain.name}</h1>
          {chain.description && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{chain.description}</p>}
          {saved && <p className="mt-3 text-sm text-accent">Saved.</p>}
          {moveError && <p className="mt-3 text-sm text-down">Couldn&apos;t move that step. Try again.</p>}
        </div>
        <Link
          href={`/chains/${chain.id}/edit`}
          className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink hover:bg-card"
        >
          Edit name and description
        </Link>
      </div>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-serif text-2xl text-ink">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </h2>
        <Link
          href={`/chains/${chain.id}/steps/new`}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          Add step
        </Link>
      </div>
      {steps.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No steps yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Step</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Kind</th>
                <th className="px-5 py-3 font-medium">Uses AI</th>
                <th className="px-5 py-3 font-medium">Model</th>
                <th className="px-5 py-3 font-medium">Temperature</th>
                <th className="px-5 py-3 font-medium">Prompt / what it does</th>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {steps.map((step, i) => (
                <tr key={step.id} className="border-b border-line align-top last:border-0">
                  {/* Position, not step_order: deleted steps can leave gaps in the numbers */}
                  <td className="px-5 py-3 tabular-nums text-muted">{i + 1}</td>
                  <td className="px-5 py-3 text-ink">{step.name}</td>
                  <td className="px-5 py-3 text-ink-soft">{kindLabel(step.kind)}</td>
                  <td className={`px-5 py-3 ${usesAI(step.kind) ? "text-accent" : "text-muted"}`}>
                    {usesAI(step.kind) ? "Yes" : "No"}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">
                    {hasModel(step.kind) ? (step.llm_models?.label ?? step.llm_models?.name ?? "Active models, in order") : "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">
                    {hasModel(step.kind) ? (step.temperature ?? "Gemini's default") : "—"}
                  </td>
                  <td className="max-w-md px-5 py-3 text-ink-soft">
                    {step.prompt_text ? (
                      <span className="line-clamp-3 font-mono text-xs whitespace-pre-line">{step.prompt_text}</span>
                    ) : (
                      (step.instructions ?? "—")
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <form action={moveStep.bind(null, chain.id, step.id, "up")}>
                        <button
                          disabled={i === 0}
                          aria-label={`Move ${step.name} up`}
                          className="size-8 rounded-full border border-line-strong text-ink hover:bg-paper disabled:opacity-30"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveStep.bind(null, chain.id, step.id, "down")}>
                        <button
                          disabled={i === steps.length - 1}
                          aria-label={`Move ${step.name} down`}
                          className="size-8 rounded-full border border-line-strong text-ink hover:bg-paper disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <Link href={`/chains/${chain.id}/steps/${step.id}/edit`} className="text-sm text-ink hover:underline">
                        Edit
                      </Link>
                      <DeleteStepButton action={deleteStep.bind(null, chain.id, step.id)} name={step.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="font-serif text-2xl text-ink">Delete</h2>
        <p className="mt-2 mb-4 text-sm text-ink-soft">
          Removes the chain, its steps and its mix weight. Logs of plans it made are kept, without the link to this chain.
        </p>
        <DeleteButton action={deleteChain.bind(null, chain.id)} steps={steps.length} />
      </section>
    </main>
  );
}
