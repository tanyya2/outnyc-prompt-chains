# OutNYC Prompt Chains

A tool for OutNYC superadmins to build and run the prompt chains that write OutNYC plans.
It uses the same Supabase project as OutNYC and the OutNYC admin.

## Run it locally

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
GOOGLE_MAPS_SERVER_KEY=
```

Then:

```bash
npm install
npm run dev -- --port 3002
```

Only accounts with `profiles.is_superadmin = true` can sign in.
