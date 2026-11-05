import Link from "next/link";
import { getViewer } from "@/utils/auth";
import { signOut } from "./login/actions";
import { ThemeSwitch } from "./theme-switch";

// Top menu, only for superadmins. Pages still check requireAdmin() themselves.
export async function Nav() {
  const viewer = await getViewer();
  if (viewer.status !== "admin") return null;

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-2.5">
        <Link href="/" className="font-serif text-xl text-ink">
          OutNYC <span className="text-muted">Prompt Chains</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <form action={signOut}>
            <button className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink hover:bg-paper">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
