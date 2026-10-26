import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.logout", () => {
  it("reports success without touching cookies (sessions are Supabase tokens held by the client)", async () => {
    const ctx = {
      user: null,
      req: { headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } satisfies TrpcContext;

    const result = await appRouter.createCaller(ctx).auth.logout();

    expect(result).toEqual({ success: true });
  });
});
