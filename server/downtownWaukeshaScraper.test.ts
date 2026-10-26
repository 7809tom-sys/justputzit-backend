import { describe, expect, it } from "vitest";
import { canonicalScrapedEventAddress, canonicalScrapedEventTitle } from "./db";
import { parseDowntownWaukeshaEvents } from "./communityScraper";

const fixture = `
<article class="event-card-box">
  <h3 class="event-card-title">2027 Waukesha Farmers' Market</h3>
  <ul class="event-card-meta"><li><time class="event-card-time">Saturday, September 12th 2027 @ 8am-12pm</time></li><li>125 W St Paul Ave, Waukesha, WI 53188</li></ul>
  <p class="event-card-desc">A community market with local produce and makers.</p>
  <p><a href="/events/waukesha-farmers-market-2027-09-12/">View Details</a></p>
</article>
<article class="event-card-box">
  <h3 class="event-card-title">Autumn Epoxy Afternoon</h3>
  <ul class="event-card-meta"><li><time class="event-card-time">Sunday, September 20th 2027 @ 1pm-3pm</time></li><li>Fisk Avenue DIY Studio, 840 N Grand Avenue</li></ul>
  <p class="event-card-desc">Make an autumn keepsake with a local artist.</p>
  <p><a href="https://www.downtownwaukesha.com/events/autumn-epoxy-afternoon-2027-09-20/">View Details</a></p>
</article>`;

describe("Downtown Waukesha official calendar parser", () => {
  it("keeps future official cards with exact Waukesha city, Central Time, and direct detail handoffs", () => {
    const events = parseDowntownWaukeshaEvents(fixture, new Date("2027-09-05T12:00:00Z"));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "Waukesha Farmers' Market",
      venueCity: "Waukesha, WI",
      venueAddress: "125 W St Paul Ave, Waukesha, WI 53188",
      category: "market",
      sourceName: "Downtown Waukesha",
      sourceUrl: "https://www.downtownwaukesha.com/events/waukesha-farmers-market-2027-09-12/",
    });
    expect(events[0]?.eventDate.toISOString()).toContain("2027-09-12T13:00:00");
    expect(events[1]).toMatchObject({
      venueName: "Fisk Avenue DIY Studio",
      venueAddress: "Fisk Avenue DIY Studio, 840 N Grand Avenue, Waukesha, WI",
      venueCity: "Waukesha, WI",
      category: "arts",
    });
  });

  it("normalizes equivalent source titles and street abbreviations for cross-source duplicate guards", () => {
    expect(canonicalScrapedEventTitle("2027 Waukesha Farmers’ Market")).toBe(canonicalScrapedEventTitle("Waukesha Farmers' Market"));
    expect(canonicalScrapedEventAddress("125 W. St. Paul Avenue, Waukesha, WI, United States")).toBe(canonicalScrapedEventAddress("125 W St Paul Ave, Waukesha, WI 53188"));
  });
});
