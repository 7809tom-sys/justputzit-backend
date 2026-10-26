import { beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: sb.from } }),
}));

import { ENV } from "./_core/env";
import {
  bucketForKey,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  storageGet,
  storageGetSignedUrl,
  storagePut,
} from "./storage";

beforeEach(() => {
  vi.clearAllMocks();
  ENV.supabaseUrl = "https://example-project.supabase.co";
  ENV.supabaseSecretKey = "sb_secret_test";
  sb.from.mockImplementation((bucket: string) => ({
    upload: (key: string, ...rest: unknown[]) => sb.upload(bucket, key, ...rest),
    createSignedUrl: (key: string, ttl: number) => sb.createSignedUrl(bucket, key, ttl),
    getPublicUrl: (key: string) => ({
      data: { publicUrl: `https://example-project.supabase.co/storage/v1/object/public/${bucket}/${key}` },
    }),
  }));
  sb.upload.mockResolvedValue({ error: null });
  sb.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/x?token=t" }, error: null });
});

describe("bucket routing", () => {
  it("keeps member content private and everything else public", () => {
    expect(bucketForKey("profile-photos/1/a.jpeg")).toBe(PRIVATE_BUCKET);
    expect(bucketForKey("voice/9/a.webm")).toBe(PRIVATE_BUCKET);
    expect(bucketForKey("generated/1.png")).toBe(PUBLIC_BUCKET);
    expect(bucketForKey("logo.png")).toBe(PUBLIC_BUCKET);
  });
});

describe("storage on Supabase", () => {
  it("uploads to the bucket for the key and keeps the /manus-storage URL shape", async () => {
    const { key, url } = await storagePut("/profile-photos/5/photo.jpeg", Buffer.from("x"), "image/jpeg");
    expect(key).toMatch(/^profile-photos\/5\/photo_[0-9a-f]{8}\.jpeg$/);
    expect(url).toBe(`/manus-storage/${key}`);
    expect(sb.upload).toHaveBeenCalledWith(
      PRIVATE_BUCKET,
      key,
      expect.anything(),
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
  });

  it("surfaces upload failures", async () => {
    sb.upload.mockResolvedValue({ error: { message: "bucket missing" } });
    await expect(storagePut("generated/a.png", Buffer.from("x"), "image/png")).rejects.toThrow("bucket missing");
  });

  it("storageGet returns the proxy path without calling Supabase", async () => {
    expect(await storageGet("/profile-photos/1/a.jpeg")).toEqual({
      key: "profile-photos/1/a.jpeg",
      url: "/manus-storage/profile-photos/1/a.jpeg",
    });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("signs private objects for one hour", async () => {
    const url = await storageGetSignedUrl("profile-photos/1/a.jpeg");
    expect(url).toBe("https://signed.example/x?token=t");
    expect(sb.createSignedUrl).toHaveBeenCalledWith(PRIVATE_BUCKET, "profile-photos/1/a.jpeg", 3600);
  });

  it("returns the plain public URL for public objects without signing", async () => {
    const url = await storageGetSignedUrl("/generated/a.png");
    expect(url).toBe(
      `https://example-project.supabase.co/storage/v1/object/public/${PUBLIC_BUCKET}/generated/a.png`,
    );
    expect(sb.createSignedUrl).not.toHaveBeenCalled();
  });

  it("fails clearly when signing fails", async () => {
    sb.createSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(storageGetSignedUrl("voice/1/a.webm")).rejects.toThrow("not found");
  });

  it("fails clearly when storage is not configured", async () => {
    ENV.supabaseSecretKey = "";
    await expect(storageGetSignedUrl("voice/1/a.webm")).rejects.toThrow("SUPABASE_SECRET_KEY");
  });
});
