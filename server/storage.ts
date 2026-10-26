// Storage helpers backed by Supabase Storage.
// Uploads go to a bucket chosen by key prefix (member content is private).
// Stored URLs keep the /manus-storage/{key} shape, which the storage proxy redirects
// to a public or signed Supabase URL, so URLs already stored in the database keep working.
// Static brand images are served by the frontend from /brand/ instead.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

export const PUBLIC_BUCKET = "site-public";
export const PRIVATE_BUCKET = "member-private";
const PRIVATE_PREFIXES = ["profile-photos/", "voice/"];

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!ENV.supabaseUrl || !ENV.supabaseSecretKey) {
    throw new Error(
      "Storage config missing: set SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
  }
  if (!_client) {
    _client = createClient(ENV.supabaseUrl, ENV.supabaseSecretKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

export function bucketForKey(key: string): string {
  return PRIVATE_PREFIXES.some(p => key.startsWith(p))
    ? PRIVATE_BUCKET
    : PUBLIC_BUCKET;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const { error } = await getClient()
    .storage.from(bucketForKey(key))
    .upload(key, body, { contentType, upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

/** Short-lived URL for any object; public objects get their plain public URL. */
export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const bucket = bucketForKey(key);
  const storage = getClient().storage.from(bucket);

  if (bucket === PUBLIC_BUCKET) {
    return storage.getPublicUrl(key).data.publicUrl;
  }

  const { data, error } = await storage.createSignedUrl(key, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Storage signed URL failed: ${error?.message ?? "empty URL"}`);
  }
  return data.signedUrl;
}
