import { describe, expect, it } from "vitest";
import { parseClub400EntertainmentEvents, parseLaughingTapComedyEvents, parseMilwaukeeComedyEvents, parseMilwaukeeImprovEvents } from "./communityScraper";

describe("verified entertainment source scrapers", () => {
  const referenceDate = new Date(2026, 8, 5, 12, 0, 0);

  it("imports only dated future karaoke and live-talent listings from Club 400", () => {
    const events = parseClub400EntertainmentEvents(`
      <article><h2>Karaoke Night</h2><p>Friday, September 11, 2026 · 9:00 PM</p><a href="/events/karaoke">Details</a></article>
      <article><h2>Open Mic Night</h2><p>Monday, September 14, 2026 · 6:30 PM</p><a href="/events/open-mic">Details</a></article>
      <article><h2>Karaoke Night</h2><p>Friday, August 21, 2026 · 9:00 PM</p></article>
    `, referenceDate);
    expect(events.map((event) => event.title)).toEqual(["Karaoke Night", "Open Mic Night"]);
    expect(events[0].category).toBe("karaoke");
    expect(events[1].category).toBe("live_music");
    expect(events.every((event) => event.venueCity === "Waukesha, WI")).toBe(true);
  });

  it("imports only dated future comedy ticket links from Milwaukee Comedy", () => {
    const events = parseMilwaukeeComedyEvents(`
      <a href="https://www.tickettailor.com/events/milwaukeecomedy/123">Cask Comedy Sept 12</a>
      <a href="https://www.tickettailor.com/events/milwaukeecomedy/124">Laugh Wisconsinbly Sept 22</a>
      <a href="https://www.tickettailor.com/events/milwaukeecomedy/125">Comedy Sep 4</a>
    `, referenceDate);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.category === "comedy")).toBe(true);
    expect(events.every((event) => event.venueCity === "Milwaukee, WI")).toBe(true);
  });

  it("imports dated future Laughing Tap comedy shows from official ticket links", () => {
    const events = parseLaughingTapComedyEvents(`
      <a href="https://www.etix.com/ticket/e/1060024/jfharris-2026-milwaukee-the-laughing-tap-comedy-club">JF Harris Sept 11-12</a>
      <a href="https://www.etix.com/ticket/p/85274690/comedy-and-magic-show-milwaukee-the-laughing-tap-comedy-club">Comedy Magic Show Sept 17</a>
      <a href="https://www.etix.com/ticket/e/1058303/zach-martina-2026-milwaukee-the-laughing-tap-comedy-club"><img alt="Zach Martina September 18-19" /></a>
      <a href="https://www.etix.com/ticket/e/1060321/akeem-woods-2026-milwaukee-the-laughing-tap-comedy-club">Akeem Woods Sept 4-5</a>
    `, referenceDate);
    expect(events.map((event) => event.title)).toEqual(["JF Harris Sept 11-12", "Comedy Magic Show Sept 17", "Zach Martina September 18-19"]);
    expect(events.every((event) => event.category === "comedy")).toBe(true);
    expect(events.every((event) => event.venueName === "The Laughing Tap Comedy Club")).toBe(true);
  });

  it("imports current Milwaukee Improv shows with the actual Brookfield venue location", () => {
    const events = parseMilwaukeeImprovEvents(`
      <div class="cal-list">
        <a class="item" href="/milwaukee/comic/will+burkart/"><div class="dates"><dl><dt>Sep</dt><dd>5<i> Sat</i></dd></dl></div><h3>Will Burkart</h3></a>
        <a class="item" href="/milwaukee/comic/sam+tallent/"><div class="dates"><dl><dt>Sep</dt><dd>11<i> Fri</i></dd></dl></div><h3>Sam Tallent</h3></a>
      </div>
    `, new Date("2026-09-05T12:00:00"));
    expect(events).toEqual([expect.objectContaining({
      title: "Sam Tallent",
      venueName: "Milwaukee Improv",
      venueCity: "Brookfield, WI",
      category: "comedy",
      sourceUrl: "https://improv.com/milwaukee/comic/sam+tallent/",
    })]);
  });
});
