import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { CATEGORIES, type Category } from "@/lib/nyc";
import { formatDate } from "@/utils/steps";

type Stop = { name?: string; category?: string; minutes?: number; note?: string };
type Plan = {
  id: number;
  created_at: string;
  neighborhood: string | null;
  content: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  votes: { value: number }[];
};

// plans.content is JSON text: { title, stops, tip }
function readContent(content: string | null): { title: string; stops: Stop[]; tip: string } | null {
  try {
    const plan = JSON.parse(content ?? "");
    if (typeof plan?.title !== "string" || !Array.isArray(plan.stops)) return null;
    return { title: plan.title, stops: plan.stops, tip: typeof plan.tip === "string" ? plan.tip : "" };
  } catch {
    return null;
  }
}

const fullName = (p: Plan["profiles"]) => [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "No name yet";
const categoryLabel = (c?: string) => CATEGORIES[c as Category]?.label ?? c ?? "";

// The plans this chain made (from the request log: the tool and OutNYC log the chain they used)
export default async function ChainPlansPage({ params }: PageProps<"/chains/[id]/plans">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const [{ data: chain }, { data, error }] = await Promise.all([
    supabase.from("prompt_chains").select("id, name").eq("id", Number(id)).maybeSingle(),
    supabase
      .from("generation_requests")
      .select("plans(id, created_at, neighborhood, content, profiles(first_name, last_name), votes(value))")
      .eq("chain_id", Number(id))
      .not("plan_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);
  if (!chain) notFound();

  // Newest first; a deleted plan has no row left
  const plans = ((data ?? []) as unknown as { plans: Plan | null }[]).flatMap((row) => (row.plans ? [row.plans] : []));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <Link href={`/chains/${chain.id}`} className="text-sm text-muted hover:text-ink">
        ← {chain.name}
      </Link>
      <p className="mt-6 text-xs uppercase tracking-widest text-muted">Plans made by this chain</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        {plans.length} {plans.length === 1 ? "plan" : "plans"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Made with Generate here, or in OutNYC with this chain. Plans from before OutNYC logged its chain aren&apos;t included. Click a plan to see its stops.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-down">Couldn&apos;t load the plans: {error.message}</p>
      ) : plans.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No plans yet. Use Generate a plan on the chain&apos;s page.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {plans.map((plan) => {
            const content = readContent(plan.content);
            const up = plan.votes.filter((vote) => vote.value === 1).length;
            const down = plan.votes.filter((vote) => vote.value === -1).length;
            return (
              <li key={plan.id} className="rounded-2xl border border-line bg-card">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
                    <span>
                      <span className="font-serif text-xl text-ink">{content?.title ?? "Untitled plan"}</span>
                      <span className="block text-xs text-muted">
                        Plan #{plan.id} · {plan.neighborhood ?? "—"} · {formatDate(plan.created_at)} · by {fullName(plan.profiles)}
                      </span>
                    </span>
                    <span className="text-sm text-ink-soft tabular-nums">
                      👍 {up} · 👎 {down}
                    </span>
                  </summary>
                  <div className="border-t border-line px-5 py-4">
                    {content ? (
                      <>
                        <ol className="flex flex-col gap-3">
                          {content.stops.map((stop, i) => (
                            <li key={i}>
                              <p className="text-ink">
                                {i + 1}. {stop.name}
                              </p>
                              <p className="text-xs text-muted">
                                {categoryLabel(stop.category)}
                                {stop.minutes ? ` · ~${stop.minutes} min` : ""}
                              </p>
                              {stop.note && <p className="mt-1 text-sm text-ink-soft">{stop.note}</p>}
                            </li>
                          ))}
                        </ol>
                        {content.tip && <p className="mt-4 text-sm text-ink-soft">Tip: {content.tip}</p>}
                      </>
                    ) : (
                      <p className="text-sm text-ink-soft">This plan&apos;s content can&apos;t be read.</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
