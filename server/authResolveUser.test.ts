import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  users: [] as any[],
  upsertUser: vi.fn(),
  relinkUserOpenId: vi.fn(),
  getOrCreateProfile: vi.fn(),
  setMemberAdministratorRole: vi.fn(),
}));

vi.mock("./db", () => ({
  getUserByOpenId: async (openId: string) => store.users.find(u => u.openId === openId),
  getUserByEmail: async (email: string) =>
    store.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null,
  upsertUser: store.upsertUser,
  relinkUserOpenId: store.relinkUserOpenId,
  getOrCreateProfile: store.getOrCreateProfile,
  setMemberAdministratorRole: store.setMemberAdministratorRole,
}));

import { bearerToken, resolveUser, upgradeToken } from "./_core/auth";
import { ENV } from "./_core/env";

const SUPA_ID = "22222222-2222-2222-2222-222222222222";
const identity = (over: Record<string, unknown> = {}) => ({
  id: SUPA_ID,
  email: "member@example.com",
  emailVerified: true,
  name: "Member",
  provider: "google",
  ...over,
});

beforeEach(() => {
  store.users = [];
  vi.clearAllMocks();
  ENV.adminEmails = [];
  store.upsertUser.mockImplementation(async (u: any) => {
    const existing = store.users.find(x => x.openId === u.openId);
    if (existing) Object.assign(existing, u);
    else store.users.push({ id: store.users.length + 1, role: "user", ...u });
  });
  store.relinkUserOpenId.mockImplementation(async (id: number, openId: string, loginMethod: string) => {
    Object.assign(store.users.find(u => u.id === id), { openId, loginMethod });
  });
  store.setMemberAdministratorRole.mockImplementation(async (id: number, role: string) => {
    const user = store.users.find(u => u.id === id);
    user.role = role;
    return user;
  });
});

describe("resolveUser", () => {
  it("returns the user whose openId is the Supabase id", async () => {
    store.users.push({ id: 1, openId: SUPA_ID, email: "member@example.com", role: "user" });
    expect((await resolveUser(identity())).id).toBe(1);
    expect(store.relinkUserOpenId).not.toHaveBeenCalled();
  });

  it("relinks an existing member with a legacy openId by verified email", async () => {
    store.users.push({ id: 7, openId: "manus-open-id-abc", email: "Member@Example.com", role: "user" });
    const user = await resolveUser(identity());
    expect(user.id).toBe(7);
    expect(store.relinkUserOpenId).toHaveBeenCalledWith(7, SUPA_ID, "google");
    expect(store.users).toHaveLength(1);
  });

  it("does not link by an unverified email, and does not store it", async () => {
    store.users.push({ id: 7, openId: "manus-open-id-abc", email: "member@example.com", role: "user" });
    const user = await resolveUser(identity({ emailVerified: false }));
    expect(user.id).not.toBe(7);
    expect(store.relinkUserOpenId).not.toHaveBeenCalled();
    expect(store.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: SUPA_ID, email: null }));
  });

  it("refuses to take over an email already linked to another Supabase identity", async () => {
    store.users.push({
      id: 7,
      openId: "33333333-3333-3333-3333-333333333333",
      email: "member@example.com",
      role: "user",
    });
    await expect(resolveUser(identity())).rejects.toThrow();
    expect(store.relinkUserOpenId).not.toHaveBeenCalled();
  });

  it("creates a user and profile on first sight", async () => {
    const user = await resolveUser(identity());
    expect(user.openId).toBe(SUPA_ID);
    expect(user.email).toBe("member@example.com");
    expect(store.getOrCreateProfile).toHaveBeenCalledWith(user.id);
  });

  it("promotes a verified ADMIN_EMAILS address to admin", async () => {
    ENV.adminEmails = ["member@example.com"];
    const user = await resolveUser(identity());
    expect(user.role).toBe("admin");
  });

  it("never promotes an unverified email even if it is listed", async () => {
    ENV.adminEmails = ["member@example.com"];
    const user = await resolveUser(identity({ emailVerified: false }));
    expect(user.role).toBe("user");
  });
});

describe("token extraction", () => {
  it("reads a Bearer header case-insensitively", () => {
    expect(bearerToken({ headers: { authorization: "Bearer abc.def" } })).toBe("abc.def");
    expect(bearerToken({ headers: { authorization: "bearer abc" } })).toBe("abc");
    expect(bearerToken({ headers: { authorization: "Basic abc" } })).toBeNull();
    expect(bearerToken({ headers: {} })).toBeNull();
  });

  it("falls back to ?access_token= only for upgrade requests", () => {
    expect(upgradeToken({ headers: {}, url: "/api/voice/signal?access_token=tok" })).toBe("tok");
    expect(upgradeToken({ headers: { authorization: "Bearer h" }, url: "/x?access_token=q" })).toBe("h");
    expect(bearerToken({ headers: {}, url: "/x?access_token=q" } as any)).toBeNull();
  });
});
