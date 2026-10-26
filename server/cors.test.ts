import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { corsMiddleware } from "./_core/cors";

function run(method: string, origin?: string, requestHeaders?: string) {
  const headers: Record<string, string> = {};
  const res: any = { setHeader: (k: string, v: string) => (headers[k] = v), sendStatus: vi.fn() };
  const next = vi.fn();
  const reqHeaders: Record<string, string> = {};
  if (origin) reqHeaders.origin = origin;
  if (requestHeaders) reqHeaders["access-control-request-headers"] = requestHeaders;
  corsMiddleware({ method, headers: reqHeaders } as any, res, next);
  return { headers, res, next };
}

describe("corsMiddleware", () => {
  beforeEach(() => {
    ENV.corsOrigins = ["https://justputzit.com"];
  });

  it("allows a listed origin and the Authorization header on preflight", () => {
    const { headers, res, next } = run("OPTIONS", "https://justputzit.com", "authorization,content-type");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://justputzit.com");
    expect(headers["Access-Control-Allow-Headers"].toLowerCase()).toContain("authorization");
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it("adds no CORS headers for an unlisted origin and rejects its preflight", () => {
    const { headers, res } = run("OPTIONS", "https://evil.example");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(res.sendStatus).toHaveBeenCalledWith(403);
  });

  it("passes normal requests through", () => {
    const { next, headers } = run("GET", "https://justputzit.com");
    expect(next).toHaveBeenCalledOnce();
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://justputzit.com");
  });
});
