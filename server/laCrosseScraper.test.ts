import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLaCrosseLibraryEvents, parseLaCrosseParksDetail, parseLaCrosseParksEvents } from "./communityScraper";

const libraryFixture = `
<article class="event-card event-card--sparse">
  <div class="lc-event__color-indicator"></div>
  <div class="lc-date-icon"><span class="lc-date-icon__item--month">Sep</span><span class="lc-date-icon__item--day">21</span><span class="lc-date-icon__item--year">2027</span></div>
  <h3 class="lc-event__title"><a href="/event/repair-cafe">Repair Cafe</a></h3>
  <div class="lc-event-info-item--time">10:30am–12:30pm</div>
  <div class="lc-event-info__item--colors">Adult, Family</div>
  <div class="lc-event-info__item--categories">Main Library</div>
</article>
<article class="event-card event-card--sparse">
  <div class="lc-event__color-indicator"></div>
  <div class="lc-date-icon"><span class="lc-date-icon__item--month">Sep</span><span class="lc-date-icon__item--day">22</span><span class="lc-date-icon__item--year">2027</span></div>
  <h3 class="lc-event__title"><a href="/event/outreach">Outreach Program</a></h3>
  <div class="lc-event-info-item--time">1:00pm–2:00pm</div>
  <div class="lc-event-info__item--categories">Outreach Offsite Event</div>
</article>`;

const parksFixture = `
<div class="list-item-container homepage-show"><article><a href="/City-Events/Park-and-Rec-Events/Music-Cafe"><h3 class="list-item-title">Music Café</h3><p><span class="list-item-block-date"><span class="part-date">17</span><span class="part-month">Sep</span><span class="part-year">2027</span></span><span class="list-item-block-desc">Thursday afternoon concerts with an opportunity to meet new people.</span></p><p class="tagged-as-list">Adult & Senior Enrichment, Parks & Recreation</p></a></article></div>
<div class="list-item-container homepage-show"><article><a href="/City-Events/Park-and-Rec-Events/Fishing"><h3 class="list-item-title">La Crosse Parks Fishing Tournaments</h3><p><span class="list-item-block-date"><span class="part-date">18</span><span class="part-month">Sep</span><span class="part-year">2027</span></span><span class="list-item-block-desc">Free public fishing tournament at Veterans Freedom Landing.</span></p><p class="tagged-as-list">Waterways, Parks & Recreation</p></a></article></div>`;

describe("La Crosse official calendar parsers", () => {
  it("keeps dated library programs at the stated public venue and excludes offsite records without a public address", () => {
    const events = parseLaCrosseLibraryEvents(libraryFixture, new Date("2027-09-01T12:00:00"));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Repair Cafe",
      venueName: "Main Library",
      venueAddress: "800 Main St, La Crosse, WI 54601",
      venueCity: "La Crosse, WI",
      sourceName: "La Crosse Public Library",
      isFree: true,
    });
    expect(events[0]?.sourceUrl).toBe("https://www.lacrosselibrary.org/event/repair-cafe");
  });

  it("keeps future city recreation programs with exact city and official detail handoffs", () => {
    const events = parseLaCrosseParksEvents(parksFixture, new Date("2027-09-01T12:00:00"));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "Music Café",
      venueCity: "La Crosse, WI",
      sourceName: "City of La Crosse Parks & Recreation",
      sourceUrl: "https://www.cityoflacrosse.org/City-Events/Park-and-Rec-Events/Music-Cafe",
    });
    expect(events[1]).toMatchObject({ category: "sports", isFree: true });
  });

  it("uses the official parks detail page to retain Central Time and a stated public venue", () => {
    const detail = parseLaCrosseParksDetail(`
      <main>
        <p>Next date: Thursday, September 17, 2027 | 01:00 PM to 02:00 PM</p>
        <p>1 p.m.-2 p.m. | South Side Neighborhood Center Ages 50+ Registration Fee: FREE</p>
      </main>`, new Date("2027-09-17T00:00:00.000Z"));
    expect(detail.eventDate.toISOString()).toContain("2027-09-17T18:00:00");
    expect(detail.venueName).toBe("South Side Neighborhood Center");
  });

  it("runs both La Crosse official sources in the nightly refresh", () => {
    const scheduled = readFileSync(resolve(__dirname, "scheduledScrape.ts"), "utf8");
    expect(scheduled).toContain("scrapeAllLaCrosseEventsWithHealth");
    expect(scheduled).toContain("...laCrosse.events");
    expect(scheduled).toContain("...laCrosse.outcomes");
  });
});
