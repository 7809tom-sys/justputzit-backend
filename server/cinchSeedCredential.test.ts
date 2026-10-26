import { describe, expect, it } from "vitest";

describe("Cinch Seed protected configuration", () => {
  it("has configured embed credentials with the expected public-embed format", () => {
    const seedId = process.env.CINCH_SEED_ID;
    const connectKey = process.env.CINCH_CONNECT_KEY;

    expect(seedId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(connectKey).toMatch(/^cs_[a-z0-9]+$/i);
  });
});
