import { requireAdmin } from "@/utils/auth";

type Chain = {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  prompt_chain_steps: { id: number }[];
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Every prompt chain: the recipe OutNYC follows to turn a request into a plan
export default async function ChainsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select("id, created_at, name, description, prompt_chain_steps(id)")
    .order("created_at");
  const chains = (data ?? []) as Chain[];

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">Prompt chains</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        {chains.length} {chains.length === 1 ? "chain" : "chains"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Each chain is a list of steps for turning someone&apos;s request into a plan.</p>

      {error ? (
        <p className="mt-6 text-sm text-down">Couldn&apos;t load chains: {error.message}</p>
      ) : chains.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No chains yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chains.map((chain) => (
            <li key={chain.id} className="rounded-2xl border border-line bg-card p-5">
              <p className="text-xs uppercase tracking-widest text-muted">Added {formatDate(chain.created_at)}</p>
              <h2 className="mt-2 font-serif text-2xl text-ink">{chain.name}</h2>
              {chain.description && <p className="mt-1 text-sm text-ink-soft">{chain.description}</p>}
              <p className="mt-3 text-sm text-muted">
                {chain.prompt_chain_steps.length} {chain.prompt_chain_steps.length === 1 ? "step" : "steps"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
