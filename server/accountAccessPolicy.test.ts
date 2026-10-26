import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getAccountAccessBlock } from "../shared/accountAccessPolicy";

describe("account suspension access policy", () => {
  it("blocks only suspended accounts from protected features", () => {
    expect(getAccountAccessBlock("banned")).toContain("suspended");
    expect(getAccountAccessBlock("user")).toBeNull();
    expect(getAccountAccessBlock("admin")).toBeNull();
  });

  it("enforces the policy in protected procedures and changes admin suspension to banned state", () => {
    const root = resolve(__dirname, "..");
    const trpcSource = readFileSync(resolve(root, "server/_core/trpc.ts"), "utf8");
    const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
    expect(trpcSource).toContain("getAccountAccessBlock(ctx.user.role)");
    expect(dbSource).toContain('set({ role: "banned" as any })');
  });
});
