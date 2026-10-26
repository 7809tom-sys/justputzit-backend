import { describe, expect, it } from "vitest";
import { parseBrookfieldLibraryCalendarEvents } from "./communityScraper";

const fixture = `
<div id="CID29"><ol>
  <li><h3><span>Library Building Closed</span></h3><div class="subHeader"><div class="date">September 7, 2027 - 12:00 AM</div><div class="eventLocation"><div class="name">1900 N. Calhoun Rd., Brookfield, WI, 53005, US</div></div></div></li>
  <li><h3><span>Fiber Arts Fanatics</span></h3><div class="subHeader"><div class="date">September 8, 2027, 7:00 PM - 8:30 PM</div><div class="eventLocation"><div class="name">1900 N. Calhoun Rd., Brookfield, WI, 53005, US</div></div></div><p class="icalDescription">Bring your own materials and join other fiber fanatics.</p></li>
  <li><h3><span>Past Book Club</span></h3><div class="subHeader"><div class="date">September 1, 2027, 7:00 PM - 8:00 PM</div><div class="eventLocation"><div class="name">1900 N. Calhoun Rd., Brookfield, WI, 53005, US</div></div></div></li>
</ol></div>`;

describe("Brookfield Public Library official calendar parser", () => {
  it("keeps only future public programs while excluding closure notices", () => {
    const events = parseBrookfieldLibraryCalendarEvents(fixture, new Date("2027-09-05T12:00:00"));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Fiber Arts Fanatics",
      description: "Bring your own materials and join other fiber fanatics.",
      venueName: "Brookfield Public Library",
      venueCity: "Brookfield, WI",
      isFree: true,
      sourceName: "Brookfield Public Library",
      sourceUrl: "https://www.ci.brookfield.wi.us/calendar.aspx?view=list&CID=29",
    });
    expect(events[0]?.eventDate.toISOString()).toContain("2027-09-08T19:00:00");
  });
});
