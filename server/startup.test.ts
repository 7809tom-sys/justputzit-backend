import { describe, expect, it } from "vitest";
import { missingEnvNames, REQUIRED_IN_PRODUCTION, startupReport } from "./_core/startup";

const complete = Object.fromEntries(REQUIRED_IN_PRODUCTION.map(name => [name, "x"])) as Record<string, string>;

describe("startup report", () => {
  it("states the port, NODE_ENV and the allowed CORS origins", () => {
    const lines = startupReport(8080, { ...complete, NODE_ENV: "production", PORT: "8080", CORS_ORIGINS: "https://a.example, https://b.example" });
    expect(lines[0]).toBe("[startup] listening on port 8080 (NODE_ENV=production, PORT=8080)");
    expect(lines[1]).toBe("[startup] CORS allows 2 origin(s): https://a.example, https://b.example");
    expect(lines.filter(l => l.includes("WARNING"))).toEqual([]);
  });

  it("warns when NODE_ENV is not production", () => {
    const lines = startupReport(3000, { ...complete, NODE_ENV: "development", CORS_ORIGINS: "http://localhost:5173" });
    expect(lines.join("\n")).toContain('NODE_ENV is "development"');
  });

  it("warns when production has no https origin or has a localhost one", () => {
    const none = startupReport(8080, { ...complete, NODE_ENV: "production", CORS_ORIGINS: "" }).join("\n");
    expect(none).toContain("no https:// origin");
    const local = startupReport(8080, { ...complete, NODE_ENV: "production", CORS_ORIGINS: "https://a.example,http://localhost:5173" }).join("\n");
    expect(local).toContain("localhost origin in production");
  });

  it("lists missing variable NAMES only, never values", () => {
    const env = { ...complete, NODE_ENV: "production", CORS_ORIGINS: "https://a.example", STRIPE_SECRET_KEY: "", RESEND_API_KEY: undefined, DATABASE_URL: "mysql://user:secret@host/db" };
    expect(missingEnvNames(env)).toEqual(["STRIPE_SECRET_KEY", "RESEND_API_KEY"]);
    const output = startupReport(8080, env).join("\n");
    expect(output).toContain("missing environment variables: STRIPE_SECRET_KEY, RESEND_API_KEY");
    expect(output).not.toContain("secret@host");
  });
});
