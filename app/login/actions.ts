"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Ends the session (deletes the login cookie) and goes back to the sign-in page.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
