import { describe, expect, it } from "vitest";
import { parseWaukeshaChamberEvents } from "./communityScraper";

describe("Waukesha Area Chamber public calendar parser", () => {
  it("keeps only future public records with an exact city and official handoff", () => {
    const events = parseWaukeshaChamberEvents([
      {
        name: "Business Networking Lunch",
        startdate: "2027-09-10",
        start_time: "11:30:00",
        enddate: "0000-00-00",
        location_name: "Waukesha City Hall Training Room",
        address: "201 Delafield Street",
        city: "Waukesha",
        state: "WI",
        zip: "53187",
        event_cost: "Free",
        more_info_link: "https://www.chamberorganizer.com/Calendar/moreinfo.php?eventid=123",
        description: "A public business lunch and networking event.",
      },
      {
        name: "Private record",
        startdate: "2027-09-11",
        start_time: "10:00:00",
        city: "Waukesha",
        private_event: 1,
        more_info_link: "https://www.chamberorganizer.com/Calendar/moreinfo.php?eventid=456",
      },
      {
        name: "Cancelled record",
        startdate: "2027-09-12",
        start_time: "10:00:00",
        city: "Waukesha",
        cd_cancelled_ind: "Y",
        more_info_link: "https://www.chamberorganizer.com/Calendar/moreinfo.php?eventid=789",
      },
    ], new Date("2027-09-05T12:00:00Z"));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Business Networking Lunch",
      venueName: "Waukesha City Hall Training Room",
      venueAddress: "201 Delafield Street, Waukesha, WI, 53187",
      venueCity: "Waukesha, WI",
      sourceName: "Waukesha Area Chamber",
      sourceUrl: "https://www.chamberorganizer.com/Calendar/moreinfo.php?eventid=123",
      isFree: true,
      category: "community_center",
    });
    expect(events[0]?.eventDate.toISOString()).toContain("2027-09-10T16:30:00");
  });

  it("excludes public-facing governance records rather than presenting them as member activities", () => {
    const events = parseWaukeshaChamberEvents([{
      name: "Monthly WACC Board Meeting",
      startdate: "2027-09-14",
      start_time: "09:00:00",
      city: "Waukesha",
      more_info_link: "https://www.chamberorganizer.com/Calendar/moreinfo.php?eventid=987",
      description: "The Chamber Board of Directors meet on a monthly basis.",
    }], new Date("2027-09-05T12:00:00Z"));

    expect(events).toHaveLength(0);
  });
});
