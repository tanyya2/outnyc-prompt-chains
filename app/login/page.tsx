import { redirect } from "next/navigation";
import { getViewer } from "@/utils/auth";
import { SignInButton } from "./sign-in-button";
import { signOut } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.status === "admin") redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted">OutNYC</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Prompt Chains</h1>

        {viewer.status === "signed-out" ? (
          <>
            {error && (
              <p className="mt-4 text-sm text-ink-soft">Login didn&apos;t work, please try again.</p>
            )}
            <div className="mt-6">
              <SignInButton />
            </div>
          </>
        ) : (
          // Signed in but not an admin: no data, only a way out
          <>
            <p className="mt-6 font-medium text-ink">Not authorized</p>
            <p className="mt-1 text-sm text-ink-soft">Only superadmins can use this tool.</p>
            <form action={signOut} className="mt-6">
              <button className="rounded-full border border-line-strong px-6 py-3 text-sm font-medium text-ink hover:bg-paper">
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
