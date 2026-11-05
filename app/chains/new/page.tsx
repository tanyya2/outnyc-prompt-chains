import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { createChain } from "../actions";
import { ChainForm } from "../chain-form";

export default async function NewChainPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("prompt_chains").select("id, name").order("created_at");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All chains
      </Link>
      <h1 className="mt-6 mb-6 font-serif text-4xl text-ink">New chain</h1>
      <ChainForm action={createChain} copyable={data ?? []} submitLabel="Create chain" />
    </main>
  );
}
