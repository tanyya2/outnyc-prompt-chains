import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Who is visiting? Signed out, signed in but not admin, or admin.
// cache() = asked once per page load, however many places call it.
export const getViewer = cache(async () => {
  // Login checks read the clock (is the session expired?), so they must
  // run on a real visit, never ahead of time.
  await connection();
  const supabase = await createClient();
  // getClaims checks the login's signature right here (no trip to Supabase Auth),
  // which is faster than getUser. The database checks the same login again anyway.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return { status: "signed-out" as const };
  const user = { id: claims.sub, email: claims.email };

  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (isAdmin !== true) return { status: "not-admin" as const, user };

  return { status: "admin" as const, user, supabase };
});

// First line of every admin page and server action.
// Anyone who isn't an admin is sent to /login and never reaches the data.
export async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.status !== "admin") redirect("/login");
  return viewer;
}
