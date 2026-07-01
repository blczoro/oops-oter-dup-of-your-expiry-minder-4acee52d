# One Home (dayta) — Backend Architecture

Complete reference for the Lovable Cloud (Supabase) backend powering One Home. Every page and feature is wired end‑to‑end. No mock data, no local storage — everything is persisted, RLS‑secured, and shareable.

---

## 1. Tech stack

- **Frontend**: TanStack Start v1 + React 19 + Vite 7 + Tailwind v4
- **Backend**: Lovable Cloud (Supabase — Postgres + Auth + Storage)
- **Server logic**: TanStack `createServerFn` (no Edge Functions needed)
- **Client**: `@/integrations/supabase/client` (publishable key, RLS)
- **Server (user)**: `requireSupabaseAuth` middleware — RLS as signed‑in user
- **Server (admin)**: `supabaseAdmin` — service role, RLS bypassed, used only inside handler bodies

---

## 2. Database schema

All tables live in the `public` schema. RLS enabled on every table. Explicit `GRANT` to `authenticated` and `service_role` on all.

| Table | Purpose | Owner column |
|---|---|---|
| `items` | Applications / warranties / renewals | `user_id` |
| `documents` | File metadata for uploads in `items` | `user_id`, `item_id` |
| `reminders` | Standalone reminders (recurring + one‑off) | `user_id` |
| `reminder_completions` | Audit log of completed reminder occurrences | `user_id` |
| `shares` | Membership records (who has access to what) | `owner_id`, `member_user_id` |
| `share_invites` | Pending invites (email or link) | `owner_id`, `token` |
| `backups` | JSON snapshots of user data | `user_id` |

### Relationships

```
auth.users ──1─┬─N items ──1─N documents
               ├─N reminders ─(optional)─ items
               ├─N reminder_completions
               ├─N shares (as owner or member)
               ├─N share_invites (as owner)
               └─N backups
```

Cascade deletes: deleting an `item` cascades to its `documents`; deleting an `auth.users` row cascades to `items` and `backups`.

---

## 3. Security model

### Row‑Level Security

Every user sees only their own rows, **plus** rows explicitly shared with them via `public.shares`. Sharing is implemented through a `SECURITY DEFINER` function to avoid recursive RLS:

```sql
public.has_share_access(_resource_type text, _resource_id uuid, _min_role text)
```

Called from `items`, `reminders`, `documents`, and `storage.objects` policies. `EXECUTE` restricted to `authenticated` / `service_role`.

### Policy summary

| Table | Insert | Select | Update | Delete |
|---|---|---|---|---|
| `items` | self | self OR shared viewer | self OR shared editor | self only |
| `reminders` | self | self OR shared viewer | self OR shared editor | self only |
| `documents` | self | self OR shared viewer (via item) | self only | self only |
| `reminder_completions` | self | self | self | self |
| `shares` | owner only | owner OR member | owner only | owner OR member |
| `share_invites` | owner only | owner only | owner only | owner only |
| `backups` | self | self | self | self |

### Storage (`documents` bucket, private)

Path convention: `{user_id}/{item_id}/{uuid}.{ext}`

- Users upload/read/update/delete files under their own `auth.uid()` prefix.
- Shared collaborators get read access via join against `public.documents` + `has_share_access`.

---

## 4. Server functions (RPC)

| File | Function | Auth | Purpose |
|---|---|---|---|
| `src/lib/sharing.functions.ts` | `acceptShareInvite` | `requireSupabaseAuth` | Accept an invite token → upsert into `shares` |

All other reads/writes happen via the browser Supabase client under RLS. No Edge Functions required for the current feature set.

---

## 5. Auth

- Email + password (Supabase Auth)
- Session persisted in `localStorage`
- `useAuth()` hook subscribes to `onAuthStateChange`
- `_authenticated/*` routes are gated by the layout with `ssr: false` — the layout redirects to `/login` when there's no session (Supabase session lives in `localStorage`, so SSR can't see it)
- Bearer token attached to server function calls via `attachSupabaseAuth` middleware in `src/start.ts`

---

## 6. Page ↔ backend map

| Page | Route | Backend reads | Backend writes |
|---|---|---|---|
| Landing | `/` | — | — |
| Login | `/login` | — | `supabase.auth.signInWithPassword` |
| Sign up | `/signup` | — | `supabase.auth.signUp` |
| Dashboard | `/dashboard` | `items` | — |
| Add Item | `/add-item` | — | `items` insert |
| My Applications | `/my-items` | `items`, `documents` count | `items` update/delete |
| Edit Item | `/items/$id/edit` | `items`, `documents` | `items` update/delete, `documents` insert/update/delete, `storage.objects` upload/remove |
| Reminders | `/reminders` | `reminders`, `items`, `reminder_completions` | `reminders` insert/update/delete, `reminder_completions` insert/delete |
| Settings | `/settings` | `backups` (latest) | `supabase.auth.updateUser`, `backups` insert |
| Accept Invite | `/invite/$token` | — | `acceptShareInvite` server fn → `shares` upsert |

### Sharing UI (`ShareDialog`)

Reads `shares` + `share_invites`; writes to both. Generates client‑side tokens for invite links; recipient opens `/invite/{token}` which calls the server function.

### Backup & Restore (`BackupPanel` + `src/lib/backup.ts`)

- **Create**: Reads all `items` / `reminders` / `documents` for the user → stores full payload as JSONB in `backups` + downloads JSON file.
- **Restore**: Wipes user's `documents` / `reminders` / `items` and re-inserts from the uploaded JSON. Storage files themselves are not backed up (metadata only).

### Export (`ExportMenu` + `src/lib/export.ts`)

Reads the same data → outputs JSON / CSV / XLSX (client‑side via `xlsx`).

---

## 7. Migrations

Historical migrations are in `supabase/migrations/`. The consolidated schema — safe for a fresh project — is `supabase/init.sql` (idempotent).

---

## 8. Environment variables

| Var | Where |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Browser (Vite build‑time) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` | Server functions / SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | Server‑only (admin operations, never in browser) |

All are managed by Lovable Cloud — no manual setup.

---

## 9. What's NOT in the backend (intentional)

- **Email notifications**: The toggle in Settings is UI‑only for now. Adding server‑side email requires a cron endpoint + email provider (Resend, etc.) — happy to wire it when needed.
- **User profiles**: You opted to keep `auth.users` only. Add a `profiles` table later if display names/avatars are needed.
- **File contents in backups**: Only metadata is included. Full file backup would require server‑side ZIP streaming.
