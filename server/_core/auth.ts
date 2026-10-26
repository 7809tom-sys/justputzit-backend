import { ForbiddenError } from "@shared/_core/errors";
import type { IncomingMessage } from "http";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { verifySupabaseToken, type VerifiedIdentity } from "./supabaseAuth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads `Authorization: Bearer <token>`. */
export function bearerToken(req: Pick<IncomingMessage, "headers">): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Browsers cannot set headers on a WebSocket, so the upgrade request may carry
 * the token as `?access_token=` instead. Only use this for upgrade requests.
 */
export function upgradeToken(req: Pick<IncomingMessage, "headers" | "url">): string | null {
  const fromHeader = bearerToken(req);
  if (fromHeader) return fromHeader;
  try {
    return new URL(req.url ?? "", "http://localhost").searchParams.get("access_token");
  } catch {
    return null;
  }
}

const isConfiguredAdmin = (identity: VerifiedIdentity) =>
  identity.emailVerified &&
  !!identity.email &&
  ENV.adminEmails.includes(identity.email.toLowerCase());

/**
 * Finds the app user for a verified Supabase identity.
 * 1. by users.openId (holds the Supabase user id)
 * 2. else by verified email: an existing member is relinked to this identity
 * 3. else a new user + profile is created
 */
export async function resolveUser(identity: VerifiedIdentity): Promise<User> {
  let user = await db.getUserByOpenId(identity.id);

  if (!user && identity.email && identity.emailVerified) {
    const existing = await db.getUserByEmail(identity.email);
    if (existing) {
      // An id that is already a Supabase id belongs to a different identity; never take it over.
      if (UUID_RE.test(existing.openId)) {
        throw ForbiddenError("This email is already linked to another sign-in");
      }
      await db.relinkUserOpenId(existing.id, identity.id, identity.provider);
      user = await db.getUserByOpenId(identity.id);
    }
  }

  if (!user) {
    await db.upsertUser({
      openId: identity.id,
      name: identity.name,
      // Never store an unverified email: it would block the real owner from linking later.
      email: identity.emailVerified ? identity.email : null,
      loginMethod: identity.provider,
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(identity.id);
    if (user?.id) await db.getOrCreateProfile(user.id);
  } else {
    const update: Parameters<typeof db.upsertUser>[0] = {
      openId: user.openId,
      lastSignedIn: new Date(),
    };
    if (!user.email && identity.emailVerified && identity.email) update.email = identity.email;
    await db.upsertUser(update);
    if (!user.email && update.email) user = { ...user, email: update.email };
  }

  if (!user) throw ForbiddenError("User not found");

  if (isConfiguredAdmin(identity) && user.role === "user") {
    user = (await db.setMemberAdministratorRole(user.id, "admin")) ?? user;
  }
  return user;
}

export async function authenticateToken(token: string): Promise<User> {
  let identity: VerifiedIdentity;
  try {
    identity = await verifySupabaseToken(token);
  } catch {
    throw ForbiddenError("Invalid or expired session");
  }
  return resolveUser(identity);
}

export async function authenticateRequest(req: Pick<IncomingMessage, "headers">): Promise<User> {
  const token = bearerToken(req);
  if (!token) throw ForbiddenError("Missing bearer token");
  return authenticateToken(token);
}
