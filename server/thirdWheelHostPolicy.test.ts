import { describe, expect, it } from "vitest";
import { THIRD_WHEEL_HOST_GUIDANCE, canDisplayThirdWheelHost } from "../shared/thirdWheelHostPolicy";

describe("Third Wheel host policy", () => {
  it("only displays an explicitly admin-enabled event host label", () => {
    expect(canDisplayThirdWheelHost(true)).toBe(true);
    expect(canDisplayThirdWheelHost(false)).toBe(false);
    expect(canDisplayThirdWheelHost("true")).toBe(false);
  });

  it("does not overstate event-host support as emergency help", () => {
    expect(THIRD_WHEEL_HOST_GUIDANCE).toContain("not emergency");
  });
});
