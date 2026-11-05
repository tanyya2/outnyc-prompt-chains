"use client";

import { createClient } from "@/utils/supabase/client";

// Sends the visitor to Google; Supabase brings them back to /auth/callback.
export function SignInButton() {
  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      onClick={signIn}
      className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent/90"
    >
      Sign in with Google
    </button>
  );
}
