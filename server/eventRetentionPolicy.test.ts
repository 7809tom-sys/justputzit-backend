import { describe, expect, it } from "vitest";
import { getArchivableEventIds } from "../shared/eventRetentionPolicy";

describe("event retention policy", () => {
  it("archives only expired events without a member or connection reference", () => {
    expect(getArchivableEventIds([10, 11, 12, 13], [11, 13, 13])).toEqual([10, 12]);
  });

  it("preserves every expired event when each has a retained reference", () => {
    expect(getArchivableEventIds([10, 11], [10, 11])).toEqual([]);
  });
});
