import express, { type Express, type Request, type Response } from "express";
import Stripe from "stripe";
import {
  createBooking,
  createNotification,
  genCode,
  getActivityById,
  getBookingByStripeCheckoutSessionId,
  attachSponsoredPlacementCheckoutSession,
  activateSponsoredPlacementFromCheckout,
  getSponsoredPlacementById,
  getVenueById,
  recordReferralVisit,
} from "./db";
import { getMarketplaceCheckoutLineItems, getSponsoredPlacementCheckoutLineItems } from "./products";
import { getSponsoredPlacementPackage, type SponsoredPlacementPackage } from "../shared/sponsoredPlacementPolicy";

type CheckoutUser = { id: number; email?: string | null; name?: string | null };

type CheckoutRequest = {
  activityId: number;
  partySize: number;
  scheduledFor?: string;
};

type CheckoutSessionIdentity = {
  clientReferenceId?: string | null;
  metadataUserId?: string | null;
};

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey) : null;
}

function getRequestOrigin(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0] || req.protocol;
  const host = req.get("host");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
}

export function canAccessMarketplaceCheckoutSession(session: CheckoutSessionIdentity, userId: number) {
  const id = userId.toString();
  return session.clientReferenceId === id && session.metadataUserId === id;
}

export async function createMarketplaceCheckoutSession(user: CheckoutUser, request: CheckoutRequest, req: Request) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Secure payment setup is not available yet. Please try again shortly.");

  const listing = await getActivityById(request.activityId);
  if (!listing) throw new Error("Activity not found");
  if (!listing.priceCents || listing.priceCents < 50) {
    throw new Error("This activity does not require card payment.");
  }
  if (request.partySize < 1 || request.partySize > (listing.maxGroupSize ?? 20)) {
    throw new Error("Choose a valid party size for this activity.");
  }

  const origin = getRequestOrigin(req);
  const metadata = {
    user_id: user.id.toString(),
    customer_email: user.email || "",
    customer_name: user.name || "",
    activity_id: listing.id.toString(),
    party_size: request.partySize.toString(),
    scheduled_for: request.scheduledFor || "",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: getMarketplaceCheckoutLineItems({
      title: listing.title,
      description: listing.description,
      unitAmountCents: listing.priceCents,
      partySize: request.partySize,
    }),
    customer_email: user.email || undefined,
    client_reference_id: user.id.toString(),
    metadata,
    payment_intent_data: { metadata },
    allow_promotion_codes: true,
    success_url: `${origin}/payment-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/marketplace?payment=cancelled`,
  });

  if (!session.url) throw new Error("Unable to start secure checkout. Please try again.");
  return { checkoutUrl: session.url };
}

export async function createSponsoredPlacementCheckoutSession(user: CheckoutUser, request: {
  placementId: number;
  activityTitle: string;
  packageCode: SponsoredPlacementPackage;
}, req: Request) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Secure payment setup is not available yet. Please try again shortly.");
  const packageDetails = getSponsoredPlacementPackage(request.packageCode);
  const origin = getRequestOrigin(req);
  const metadata = {
    checkout_type: "sponsored_placement",
    user_id: user.id.toString(),
    placement_id: request.placementId.toString(),
    package_code: request.packageCode,
    customer_email: user.email || "",
    customer_name: user.name || "",
  };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: getSponsoredPlacementCheckoutLineItems({
      title: `${packageDetails.label}: ${request.activityTitle}`,
      description: `${packageDetails.description} The listing will remain clearly labeled Sponsored.`,
      amountCents: packageDetails.amountCents,
    }),
    customer_email: user.email || undefined,
    client_reference_id: user.id.toString(),
    metadata,
    payment_intent_data: { metadata },
    allow_promotion_codes: true,
    success_url: `${origin}/vendor?promotion=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/vendor?promotion=cancelled`,
  });
  if (!session.url) throw new Error("Unable to start secure promotion checkout. Please try again.");
  await attachSponsoredPlacementCheckoutSession(request.placementId, user.id, session.id);
  return { checkoutUrl: session.url };
}

async function fulfillMarketplaceCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const userId = Number(metadata.user_id);
  const activityId = Number(metadata.activity_id);
  const partySize = Number(metadata.party_size);
  if (!Number.isInteger(userId) || !Number.isInteger(activityId) || !Number.isInteger(partySize) || partySize < 1) {
    throw new Error(`Stripe Checkout ${session.id} is missing valid Marketplace metadata`);
  }

  const existing = await getBookingByStripeCheckoutSessionId(session.id);
  if (existing) return existing;

  const listing = await getActivityById(activityId);
  if (!listing) throw new Error(`Activity ${activityId} was not found during checkout fulfillment`);
  const venue = await getVenueById(listing.venueId);
  const unitPriceCents = listing.priceCents ?? 0;
  const totalPriceCents = unitPriceCents * partySize;
  const commissionPct = venue?.commissionPct ?? 12;
  const booking = await createBooking({
    userId,
    activityId: listing.id,
    venueId: listing.venueId,
    partySize,
    unitPriceCents,
    totalPriceCents,
    commissionCents: Math.round((totalPriceCents * commissionPct) / 100),
    referralFeeCents: (venue?.referralFeePerVisit ?? 100) * partySize,
    bookingType: listing.hasTickets ? "ticket" : "reservation",
    confirmationCode: genCode("JP"),
    scheduledFor: metadata.scheduled_for ? new Date(metadata.scheduled_for) : undefined,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: getPaymentIntentId(session),
  });
  await recordReferralVisit(listing.id);
  await createNotification(
    userId,
    "new_match",
    "Payment received — booking confirmed! 🎟️",
    `Your card payment for ${listing.title} was received. Your booking is confirmed.`,
    booking?.id,
  );
  return booking;
}

async function fulfillSponsoredPlacementCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const placementId = Number(metadata.placement_id);
  const userId = Number(metadata.user_id);
  if (!Number.isInteger(placementId) || !Number.isInteger(userId)) {
    throw new Error(`Stripe Checkout ${session.id} is missing sponsored placement metadata`);
  }
  const placement = await getSponsoredPlacementById(placementId);
  if (!placement || placement.purchaserUserId !== userId) throw new Error("Sponsored placement ownership verification failed");
  if (placement.status === "active") return placement;
  const packageDetails = getSponsoredPlacementPackage(placement.packageCode);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + packageDetails.durationDays * 24 * 60 * 60 * 1000);
  return activateSponsoredPlacementFromCheckout({
    placementId,
    sessionId: session.id,
    paymentIntentId: getPaymentIntentId(session),
    startsAt,
    endsAt,
  });
}

export async function getMarketplacePaymentConfirmation(userId: number, sessionId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Secure payment setup is not available yet. Please try again shortly.");

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!canAccessMarketplaceCheckoutSession({
    clientReferenceId: session.client_reference_id,
    metadataUserId: session.metadata?.user_id,
  }, userId)) {
    throw new Error("This payment confirmation does not belong to your account.");
  }

  if (session.payment_status !== "paid") {
    return { status: "processing" as const, booking: null, activity: null, venue: null };
  }

  const booking = await fulfillMarketplaceCheckout(session);
  if (!booking) throw new Error("Your payment was received, but we could not retrieve the booking yet.");
  const activity = await getActivityById(booking.activityId);
  const venue = await getVenueById(booking.venueId);
  return { status: "confirmed" as const, booking, activity, venue };
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret || typeof signature !== "string") {
      return res.status(400).json({ error: "Stripe webhook is not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }

    if (event.id.startsWith("evt_test_")) {
      console.log("[Stripe] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.checkout_type === "sponsored_placement") {
          await fulfillSponsoredPlacementCheckout(session);
        } else {
          await fulfillMarketplaceCheckout(session);
        }
      }
      console.log(`[Stripe] Processed ${event.type} (${event.id})`);
      return res.json({ received: true });
    } catch (error) {
      console.error("[Stripe] Webhook fulfillment failed", error);
      return res.status(500).json({ error: "Webhook fulfillment failed" });
    }
  });
}
