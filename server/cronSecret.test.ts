import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { requireCronSecret } from "./_core/cron";

function run(authorization?: string) {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  requireCronSecret({ headers: authorization ? { authorization } : {} } as any, res, next);
  return { res, next };
}

describe("requireCronSecret", () => {
  beforeEach(() => {
    ENV.cronSecret = "s3cret-value";
  });

  it("lets a request with the right bearer secret through", () => {
    const { next, res } = run("Bearer s3cret-value");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a missing header", () => {
    const { next, res } = run();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a wrong secret, including ones of a different length", () => {
    for (const header of ["Bearer wrong-value!", "Bearer s3cret", "Bearer s3cret-value-and-more", "s3cret-value"]) {
      const { next, res } = run(header);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    }
  });

  it("refuses everything (503) when CRON_SECRET is not configured", () => {
    ENV.cronSecret = "";
    const { next, res } = run("Bearer x");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
