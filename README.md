# Garden of Arguments

Write down your arguments and walk through the garden they grow.

- **Each argument is a tree.** Log what each person said, and every point grows a branch with leaves in that person's colour (2–6 people per argument).
- **Similar arguments grow together.** Every point is turned into a meaning vector (Supabase's built-in `gte-small` model in an Edge Function). A new tree is planted next to the trees it resembles, so a "chores corner" or "money grove" forms by itself.
- **Search by meaning.** "money" also finds "you never pay rent on time".
- **No sign-up.** You get an anonymous Supabase account on first visit. Save it later with email + password or Google and keep every tree.

## Stack
React + Vite + three.js (react-three-fiber) · Supabase (Postgres + pgvector, Auth, RLS, Edge Functions)

## Security
- Row level security on every table: users can only read and change their own rows.
- Column-level grants: clients can't write embeddings, tree positions, or read raw vectors.
- Signed-out requests get nothing; the `embed` function checks the caller's token and reads through RLS.

## Run locally
```bash
cd app
npm install
npm run dev
```

## Backend
- `supabase/migrations/` — schema, RLS, search functions
- `supabase/functions/embed/` — embedding + search Edge Function
