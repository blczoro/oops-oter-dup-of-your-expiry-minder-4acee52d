# One Home (dayta) — Setup

This app is portable across Supabase projects. To bring up a fresh
Supabase instance you only need:

1. A new Supabase project
2. Its **URL**, **anon/publishable key**, and **service-role key**
3. The two commands below

No manual table, policy, bucket, or trigger creation needed.

---

## 1. Configure environment

Copy `.env.example` → `.env` and fill in your project's values:

```bash
cp .env.example .env
# edit .env
```

Required:

| Var                            | Where it's used                      |
| ------------------------------ | ------------------------------------ |
| `VITE_SUPABASE_URL`            | browser client                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| browser client                       |
| `VITE_SUPABASE_PROJECT_ID`     | browser client                       |
| `SUPABASE_URL`                 | server functions, SSR, setup scripts |
| `SUPABASE_PUBLISHABLE_KEY`     | server functions, SSR                |
| `SUPABASE_PROJECT_ID`          | server                               |
| `SUPABASE_SERVICE_ROLE_KEY`    | setup scripts only (KEEP SECRET)     |

## 2. Apply the database schema

Everything (tables, indexes, RLS policies, grants, security-definer
functions, triggers, the `documents` storage bucket, and
`storage.objects` policies) is in **`supabase/init.sql`**. It is
idempotent — safe to re-run.

### Option A — `psql` (fastest)

```bash
psql "postgresql://postgres:[YOUR-DB-PASSWORD]@db.YOUR-PROJECT.supabase.co:5432/postgres" \
  -f supabase/init.sql
```

### Option B — Supabase CLI

```bash
supabase link --project-ref YOUR-PROJECT
cp supabase/init.sql supabase/migrations/0000_init.sql
supabase db push
```

### Option C — Supabase Dashboard

Open **SQL Editor → New query**, paste the contents of `supabase/init.sql`,
run.

## 3. Create storage buckets

`supabase/init.sql` already creates the `documents` bucket. If you ran
the SQL via the Dashboard SQL editor and your project blocks bucket
creation from SQL, run the script instead:

```bash
bun install
bun run scripts/setup-storage.ts
```

## 4. Configure Auth

In **Authentication → URL Configuration** add your site URL and any
redirect URLs you'll use (local + production). Enable Email/Password
under **Authentication → Providers**. Add Google OAuth there too if
you want social sign-in.

## 5. Run the app

```bash
bun install
bun dev
```

---

## What's where

```
supabase/init.sql            ← single source of truth for schema + RLS
scripts/setup-storage.ts     ← creates storage buckets via service role
.env.example                 ← required env vars
src/integrations/supabase/   ← clients (browser / server / admin)
```

## Moving to another Supabase project

1. Create the new project.
2. Update the 7 env vars in `.env`.
3. Run `psql ... -f supabase/init.sql` against the new DB.
4. Run `bun run scripts/setup-storage.ts` if buckets weren't created.
5. Start the app.

No code change required.

## Notes

- No project IDs, table IDs, or secrets are hardcoded in source. All
  Supabase access reads from env vars only.
- `supabase/migrations/` contains the historical incremental migrations
  used during development. They are equivalent to `init.sql` when
  applied in order. For a brand-new project prefer `init.sql`.
- The `documents` bucket is **private**. Files are scoped per user via
  `storage.objects` RLS that requires the first path segment to equal
  `auth.uid()`.
