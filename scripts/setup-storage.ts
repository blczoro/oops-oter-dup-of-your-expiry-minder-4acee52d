#!/usr/bin/env bun
/**
 * One Home — Storage bootstrap
 *
 * Creates required storage buckets on a fresh Supabase project using the
 * service-role key. RLS policies for storage.objects are applied by
 * supabase/init.sql, not by this script.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   bun run scripts/setup-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKETS: Array<{ id: string; public: boolean }> = [
  { id: "documents", public: false },
];

async function ensureBucket(id: string, isPublic: boolean) {
  const { data: existing } = await admin.storage.getBucket(id);
  if (existing) {
    console.log(`✓ bucket exists: ${id}`);
    return;
  }
  const { error } = await admin.storage.createBucket(id, { public: isPublic });
  if (error) throw new Error(`createBucket(${id}): ${error.message}`);
  console.log(`+ created bucket: ${id} (public=${isPublic})`);
}

for (const b of BUCKETS) {
  await ensureBucket(b.id, b.public);
}

console.log("\nStorage setup complete.");
