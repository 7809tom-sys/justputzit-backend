export type MarketplaceCheckoutProduct = {
  title: string;
  description?: string | null;
  unitAmountCents: number;
  partySize: number;
};

export function getMarketplaceCheckoutLineItems(product: MarketplaceCheckoutProduct) {
  return [{
    price_data: {
      currency: "usd",
      product_data: {
        name: product.title,
        description: product.description || undefined,
      },
      unit_amount: product.unitAmountCents,
    },
    quantity: product.partySize,
  }];
}

export function getSponsoredPlacementCheckoutLineItems(product: { title: string; description: string; amountCents: number }) {
  return [{
    price_data: {
      currency: "usd",
      product_data: { name: product.title, description: product.description },
      unit_amount: product.amountCents,
    },
    quantity: 1,
  }];
}
