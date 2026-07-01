# One Home — Rebrand, Documents, Export & Backup

A large multi-area update. I'll group it into focused phases so each ships cleanly.

## 1. Branding: "Warranty Reminder" → "One Home"

- Update every visible "Warranty Reminder" string: sidebar header, landing page hero/header/footer, all route `head().meta.title` tags, login/signup, settings, README copy.
- New logo lockup component used in sidebar + landing header:
  ```
  One Home
       dayta
  ```
  `dayta` rendered small, muted, positioned under and slightly right of the title.
- Update `<title>` template in `__root.tsx` and favicon alt text.

## 2. Navigation: "My Items" → "My Applications"

- Rename sidebar entry, page heading, page title meta, breadcrumbs, all button labels ("Add Item" stays as the verb but page becomes "Add Application"? — see Question 1).
- Keep route URL `/my-items` and DB table `items` unchanged (avoids a destructive migration); only the user-facing copy changes. Internal code keeps `items` naming.

## 3. Document storage & management

New `documents` table linked to `items`:

| field | type |
|---|---|
| `id` | uuid |
| `item_id` | uuid → items.id |
| `user_id` | uuid → auth.users |
| `file_name` | text |
| `file_type` | text (mime) |
| `file_size` | bigint |
| `storage_path` | text |
| `uploaded_at` | timestamptz |

- Storage bucket `documents` (private), RLS so users only access their own files.
- New `<DocumentUploader>` with progress bar, success toast, instant preview.
- `<DocumentViewer>` modal: images (with zoom via existing pattern), PDF preview via `<iframe>`, download button.
- Item edit page gets a **Documents** tab/section showing thumbnails (image previews, PDF icon), file name, upload date, and View / Download / Replace / Delete actions.
- My Applications cards show a paperclip icon + document count badge when `documents.count > 0`.

Supported preview types: JPG, PNG, WEBP, PDF. Other types still upload but show a generic file icon + download.

## 4. Export feature

New "Export" panel in Settings + button on My Applications page. Three formats:

- **JSON** — full dump of applications + nested reminders + document metadata refs.
- **CSV** — flat applications sheet; reminders/documents as separate CSV files inside a `.zip`.
- **Excel** — `.xlsx` with sheets `Applications`, `Reminders`, `Documents` (using `xlsx` npm package).

Client-side generation (no server fn needed): fetch user data, build file, trigger download via Blob.

## 5. Backup & restore

New "Backup" section in Settings:

- **Create Backup** — bundles applications, reminders, document metadata (paths, not file blobs), settings, notes into one JSON file; stores a copy in a new `backups` table (`id, user_id, created_at, size, payload jsonb`) and triggers download.
- **Download Backup** — re-downloads latest backup row.
- **Restore Backup** — file picker reads JSON, validates schema, upserts records (with confirmation modal warning about overwrite).
- Display: Last backup date, item counts, status.

Note: backup does NOT include the binary contents of stored documents — only metadata. Users should re-upload files if storage is wiped. (See Question 2.)

## Technical notes

- DB migrations: create `documents`, `backups` tables with RLS scoped to `auth.uid()`; create private `documents` storage bucket with per-user-folder policies (`{user_id}/...`).
- New components: `BrandLogo`, `DocumentUploader`, `DocumentViewer`, `DocumentList`, `ExportPanel`, `BackupPanel`.
- New libs: `src/lib/export.ts` (JSON/CSV/XLSX builders), `src/lib/backup.ts`.
- Add `xlsx` package via `bun add xlsx`.
- No new server functions needed — all reads/writes via the authenticated browser client with RLS.

## Out of scope (unless requested)

- Restoring binary document files from backup.
- Sharing of documents (existing share dialog stays item-level only).
- OneSignal — still parked pending credentials.

## Questions

1. **"Add Item" button & route** — also rename to "Add Application" / `/add-application`, or keep URL stable and only change the label?
2. **Backup contents** — metadata-only is much smaller and feasible client-side. Want me to also include base64-encoded file blobs (could be 10s of MB)?
3. **Export scope** — export only the current user's data (yes by default), or include shared-with-me items too?

I'll proceed with sensible defaults (label-only rename, metadata-only backup, owned items only) unless you say otherwise.
