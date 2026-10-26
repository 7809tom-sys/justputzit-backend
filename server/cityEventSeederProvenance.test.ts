import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("city event seed provenance", () => {
  const source = readFileSync(resolve(__dirname, "./cityEventSeeder.ts"), "utf8");

  it("refreshes permitted crawlers without publishing AI-generated event records", () => {
    const autoSeedBody = source.slice(source.indexOf("export async function autoSeedCityEvents"));
    expect(autoSeedBody).toContain("crawlMuseumLibraryEvents(normalizedCity)");
    expect(autoSeedBody).toContain("markCitySeeded(normalizedCity, state, 0, coords)");
    expect(autoSeedBody).toContain("no generated events were published");
    expect(autoSeedBody).not.toContain("generateEventsForCity(normalizedCity, state)");
    expect(autoSeedBody).not.toContain("insertGeneratedEvents(events");
  });
});
