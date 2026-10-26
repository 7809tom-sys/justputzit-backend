import { describe, expect, it } from "vitest";
import { getMarketplaceCheckoutLineItems, getSponsoredPlacementCheckoutLineItems } from "./products";

describe("Marketplace Stripe checkout products", () => {
  it("creates a USD card checkout line item using cents and party size", () => {
    expect(getMarketplaceCheckoutLineItems({
      title: "Community pottery class",
      description: "Two-hour studio session",
      unitAmountCents: 2500,
      partySize: 3,
    })).toEqual([{
      price_data: {
        currency: "usd",
        product_data: {
          name: "Community pottery class",
          description: "Two-hour studio session",
        },
        unit_amount: 2500,
      },
      quantity: 3,
    }]);
  });

  it("omits an empty optional product description", () => {
    expect(getMarketplaceCheckoutLineItems({
      title: "Open gym reservation",
      unitAmountCents: 1200,
      partySize: 1,
    })[0]?.price_data.product_data.description).toBeUndefined();
  });

  it("creates a single transparent sponsored placement checkout item", () => {
    expect(getSponsoredPlacementCheckoutLineItems({
      title: "7-day featured placement: Pasta Night",
      description: "Clearly labeled Sponsored placement.",
      amountCents: 9900,
    })).toEqual([{
      price_data: {
        currency: "usd",
        product_data: {
          name: "7-day featured placement: Pasta Night",
          description: "Clearly labeled Sponsored placement.",
        },
        unit_amount: 9900,
      },
      quantity: 1,
    }]);
  });
});
