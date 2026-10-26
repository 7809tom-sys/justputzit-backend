import { describe, expect, it } from "vitest";
import { getSponsoredPerformanceRates } from "../shared/sponsoredPerformance";

describe("sponsored placement performance", () => {
  it("calculates click-through and sign-up rates from aggregate outcomes", () => {
    expect(getSponsoredPerformanceRates({ views: 125, clicks: 20, signUps: 5 })).toEqual({
      views: 125,
      clicks: 20,
      signUps: 5,
      clickThroughRate: 16,
      signUpRate: 4,
    });
  });

  it("uses zero rates when a placement has not received views", () => {
    expect(getSponsoredPerformanceRates({ views: 0, clicks: 0, signUps: 0 })).toMatchObject({
      clickThroughRate: 0,
      signUpRate: 0,
    });
  });
});
