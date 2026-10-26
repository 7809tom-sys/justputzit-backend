import { describe, expect, it } from "vitest";
import { parseVisitWaukeshaEvents } from "./communityScraper";

const fixture = `
<article class="tribe-events-calendar-list__event">
  <h4><a class="tribe-events-calendar-list__event-title-link" href="/event/pewaukee-farmers-market/2027-09-09/">Pewaukee Farmers Market</a></h4>
  <time class="tribe-events-calendar-list__event-datetime" datetime="2027-09-09"><span>September 9 @ 3:00 pm</span></time>
  <address><span class="tribe-events-calendar-list__event-venue-title">Galilee Lutheran Church</span><span class="tribe-events-calendar-list__event-venue-address">N24W26430 Crestview Drive, Pewaukee, WI, United States</span></address>
  <div class="tribe-events-calendar-list__event-description"><p>Shop local vendors, enjoy food trucks, music, and family activities.</p></div>
  <div class="tribe-events-calendar-list__event-cost"><span>Free Admission</span></div>
</article>
<article class="tribe-events-calendar-list__event">
  <h4><a class="tribe-events-calendar-list__event-title-link" href="/event/pewaukee-farmers-market/2027-09-09/">Pewaukee Farmers Market</a></h4>
  <time class="tribe-events-calendar-list__event-datetime" datetime="2027-09-09"><span>September 9 @ 3:00 pm</span></time>
  <address><span class="tribe-events-calendar-list__event-venue-title">Galilee Lutheran Church</span><span class="tribe-events-calendar-list__event-venue-address">N24W26430 Crestview Drive, Pewaukee, WI, United States</span></address>
  <div class="tribe-events-calendar-list__event-cost"><span>Free Admission</span></div>
</article>
<article class="tribe-events-calendar-list__event">
  <h4><a class="tribe-events-calendar-list__event-title-link" href="https://visitwaukesha.org/event/autumn-arts/">Autumn Arts Showcase</a></h4>
  <time class="tribe-events-calendar-list__event-datetime" datetime="2027-09-20"><span>September 20 @ 1:00 pm</span></time>
  <address><span class="tribe-events-calendar-list__event-venue-title">Fisk Avenue Studio</span><span class="tribe-events-calendar-list__event-venue-address">840 N Grand Avenue, Waukesha, WI</span></address>
  <div class="tribe-events-calendar-list__event-description"><p>Make an autumn keepsake with a local artist.</p></div>
  <div class="tribe-events-calendar-list__event-cost"><span>$35</span></div>
</article>
<article class="tribe-events-calendar-list__event">
  <h4><a class="tribe-events-calendar-list__event-title-link" href="/event/unknown-city/">Unlocated Event</a></h4>
  <time class="tribe-events-calendar-list__event-datetime" datetime="2027-09-21"><span>September 21 @ 4:00 pm</span></time>
  <address><span class="tribe-events-calendar-list__event-venue-title">Regional Venue</span><span class="tribe-events-calendar-list__event-venue-address">Various locations</span></address>
</article>`;

describe("Visit Waukesha official calendar parser", () => {
  it("keeps future dated records with exact city, venue, admission, official handoff, and no duplicate cards", () => {
    const events = parseVisitWaukeshaEvents(fixture, new Date("2027-09-05T12:00:00"));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "Pewaukee Farmers Market",
      venueName: "Galilee Lutheran Church",
      venueAddress: "N24W26430 Crestview Drive, Pewaukee, WI, United States",
      venueCity: "Pewaukee, WI",
      category: "market",
      sourceName: "Visit Waukesha",
      sourceUrl: "https://visitwaukesha.org/event/pewaukee-farmers-market/2027-09-09/",
      isFree: true,
    });
    expect(events[0]?.eventDate.toISOString()).toContain("2027-09-09T20:00:00");
    expect(events[1]).toMatchObject({ venueCity: "Waukesha, WI", isFree: false });
  });
});
