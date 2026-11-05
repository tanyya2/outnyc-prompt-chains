import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { updateChain } from "../../actions";
import { ChainForm } from "../../chain-form";

export default async function EditChainPage({ params }: PageProps<"/chains/[id]/edit">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const { data: chain } = await supabase.from("prompt_chains").select("id, name, description").eq("id", Number(id)).maybeSingle();
  if (!chain) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href={`/chains/${chain.id}`} className="text-sm text-muted hover:text-ink">
        ← {chain.name}
      </Link>
      <h1 className="mt-6 mb-6 font-serif text-4xl text-ink">Edit chain</h1>
      <ChainForm
        action={updateChain.bind(null, chain.id)}
        initial={{ name: chain.name, description: chain.description ?? "" }}
        submitLabel="Save changes"
      />
    </main>
  );
}
