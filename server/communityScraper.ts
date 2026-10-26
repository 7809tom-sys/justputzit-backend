/**
 * communityScraper.ts
 * Scrapes public event calendars from Milwaukee/Waukesha area sources:
 *   - Milwaukee Public Library (mpl.libnet.info/events)
 *   - Waukesha Public Library (waukesha.librarycalendar.com/events/list)
 *   - UW-Milwaukee (uwm.edu/events)
 *   - Marquette University (today.marquette.edu/calendar)
 *   - OnMilwaukee (onmilwaukee.com/articles/weekend-preview)
 *
 * Each scraper returns a normalized ScrapedEvent[] array.
 * Scrapers fail gracefully — a broken source returns [] and logs a warning.
 */

import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedEvent {
  title: string;
  description: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string;
  category: string; // maps to our activity category enum
  sourceUrl: string;
  sourceName: string;
  isFree: boolean;
  isOnCampus: boolean;
}

export interface ScrapeSourceOutcome {
  sourceKey: string;
  sourceLabel: string;
  city: string;
  status: "healthy" | "empty" | "failed";
  eventsFound: number;
  errorMessage?: string;
}

interface NamedSourceScraper {
  sourceKey: string;
  sourceLabel: string;
  city: string;
  run: () => Promise<ScrapedEvent[]>;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; JustPutzit-EventBot/1.0; +https://justputzit.com/about)",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });
    return res.data as string;
  } catch (err: any) {
    console.warn(`[communityScraper] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

async function fetchPublicText(url: string, accept = "text/plain,*/*"): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      headers: { ...HEADERS, Accept: accept },
      timeout: 15000,
      maxRedirects: 5,
      responseType: "text",
    });
    return typeof res.data === "string" ? res.data : null;
  } catch (err: any) {
    console.warn(`[communityScraper] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

/** Parse a loose date string into a Date object, returns null if unparseable */
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse public calendar dates that omit their year, such as "Aug 15 · 7:30 PM". */
export function parseCommunityCalendarDate(raw: string, referenceDate = new Date()): Date | null {
  const cleaned = raw.replace(/[–—]/g, " ").replace(/\s+/g, " ").trim();
  const match = cleaned.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?(?:[^\d]{0,25}(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i);
  if (!match) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(match[1].slice(0, 3).toLowerCase());
  const day = Number(match[2]);
  if (month < 0 || day < 1 || day > 31) return null;
  let year = match[3] ? Number(match[3]) : referenceDate.getFullYear();
  let hour = match[4] ? Number(match[4]) : 12;
  const minute = match[5] ? Number(match[5]) : 0;
  const meridiem = match[6]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  let result = new Date(year, month, day, hour, minute, 0, 0);
  if (!match[3] && result.getTime() < referenceDate.getTime() - 36 * 60 * 60 * 1000) {
    year += 1;
    result = new Date(year, month, day, hour, minute, 0, 0);
  }
  return Number.isNaN(result.getTime()) ? null : result;
}

function futureEvents(events: ScrapedEvent[], limit = 40, referenceDate = new Date()) {
  const now = referenceDate.getTime();
  return events.filter((event) => event.eventDate && event.eventDate.getTime() > now).slice(0, limit);
}

function dedupeScrapedEvents(events: ScrapedEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.sourceName}|${event.title.toLowerCase().replace(/\s+/g, " ").trim()}|${event.eventDate?.toISOString() ?? ""}|${event.venueAddress ?? event.venueName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseWaukeshaCalendarDate(month: string, day: string, year: string, time?: string) {
  const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month.trim().slice(0, 3).toLowerCase());
  const numericDay = Number(day);
  const numericYear = Number(year);
  if (monthIndex < 0 || !Number.isInteger(numericDay) || !Number.isInteger(numericYear)) return null;
  const match = time?.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  let hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;
  if (match?.[3].toLowerCase() === "pm" && hour < 12) hour += 12;
  if (match?.[3].toLowerCase() === "am" && hour === 12) hour = 0;
  const date = new Date(numericYear, monthIndex, numericDay, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseWaukeshaCountyParksLocation(locationText: string) {
  const cityMatch = locationText.match(/,\s*([A-Za-z .'-]+),?\s+WI(?:\s+\d{5})?\)?/i);
  const venueCity = cityMatch?.[1]?.trim() ? `${cityMatch[1].trim()}, WI` : "Waukesha, WI";
  const addressMatch = locationText.match(/\(([^()]*\bWI(?:\s+\d{5})?[^()]*)\)/i);
  const venueName = locationText.split("(")[0]?.trim() || "Waukesha County Parks";
  return { venueCity, venueAddress: addressMatch?.[1]?.trim() || null, venueName };
}

function parseWaukeshaCountyParksOccurrences(title: string, detailText: string, sourceUrl: string): ScrapedEvent[] {
  const entries = detailText.matchAll(/(?:\b(CANCELLED)\s+)?\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(\d{1,2}),\s+(\d{4})\s*•\s*(\d{1,2})(?::(\d{2}))?\s*(?:[–-]\s*\d{1,2}(?::\d{2})?\s*)?([ap])\.?m\.?\s*•\s*(.*?)(?=\s+(?:\bCANCELLED\s+)?\b(?:JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+\d{1,2},\s+\d{4}\s*•|$)/gi);
  const events: ScrapedEvent[] = [];

  Array.from(entries).forEach((entry) => {
    const [, cancelled, month, day, year, hourText, minuteText, meridiem, locationText] = entry;
    if (cancelled) return;
    const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month.slice(0, 3).toLowerCase());
    if (monthIndex < 0) return;
    let hour = Number(hourText);
    if (meridiem.toLowerCase() === "p" && hour < 12) hour += 12;
    if (meridiem.toLowerCase() === "a" && hour === 12) hour = 0;
    const eventDate = new Date(Number(year), monthIndex, Number(day), hour, Number(minuteText ?? 0), 0, 0);
    if (Number.isNaN(eventDate.getTime())) return;
    const location = parseWaukeshaCountyParksLocation(locationText.trim());
    events.push({
      title,
      description: detailText.slice(0, 1000) || null,
      eventDate,
      endDate: null,
      ...location,
      category: guessCategory(`${title} ${detailText}`),
      sourceUrl,
      sourceName: "Waukesha County Parks",
      isFree: /\bfree\b|no charge|admission free/i.test(detailText),
      isOnCampus: false,
    });
  });
  return events;
}

export function parseWaukeshaCountyParksEvents(html: string, now = new Date()): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $("li.gs-feed-list-item").each((_, element) => {
    const titleLink = $(element).find("a.gs-feed-list-title").first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    const eventDate = parseDate($(element).find(".gs-feed-list-date").first().text());
    if (!title || !eventDate) return;

    const sourceUrl = titleLink.attr("href")?.trim();
    if (!sourceUrl?.startsWith("https://events.waukeshacounty.gov/default/detail/")) return;

    const detailText = $(element).find(".gs-feed-list-description").text().replace(/\s+/g, " ").trim();
    if (/DATES\/TIMES\/LOCATIONS\s*:/i.test(detailText)) {
      events.push(...parseWaukeshaCountyParksOccurrences(title, detailText, sourceUrl));
      return;
    }
    const locationMatch = detailText.match(/LOCATION\s*:\s*([\s\S]{1,300}?)(?=(?:COST|HOW TO PURCHASE TICKETS|DATES\/TIMES|REGISTRATION|QUESTIONS|NOTE)\s*:|$)/i);
    const locationText = locationMatch?.[1]?.trim() ?? "";
    const location = parseWaukeshaCountyParksLocation(locationText);
    const detailDate = sourceUrl.match(/\/detail\/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})-/);
    const startAt = detailDate
      ? new Date(Number(detailDate[1]), Number(detailDate[2]) - 1, Number(detailDate[3]), Number(detailDate[4]), Number(detailDate[5]))
      : eventDate;
    const costMatch = detailText.match(/COST\s*:\s*([\s\S]{1,200}?)(?=(?:HOW TO PURCHASE TICKETS|DATES\/TIMES|REGISTRATION|QUESTIONS|NOTE)\s*:|$)/i);

    events.push({
      title,
      description: detailText.slice(0, 1000) || null,
      eventDate: startAt,
      endDate: null,
      ...location,
      category: guessCategory(`${title} ${detailText}`),
      sourceUrl,
      sourceName: "Waukesha County Parks",
      isFree: /\bfree\b|no charge|admission free/i.test(costMatch?.[1] ?? ""),
      isOnCampus: false,
    });
  });

  return futureEvents(dedupeScrapedEvents(events), 75)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000);
}

// ─── Waukesha County Parks ──────────────────────────────────────────────────
export async function scrapeWaukeshaCountyParks(): Promise<ScrapedEvent[]> {
  const url = "https://www.waukeshacounty.gov/parks-and-land-use/parks-and-land-use-events/";
  const html = await fetchHtml(url);
  return html ? parseWaukeshaCountyParksEvents(html) : [];
}

export function parseBrookfieldLibraryCalendarEvents(html: string, now = new Date()): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const url = "https://www.ci.brookfield.wi.us/calendar.aspx?view=list&CID=29";
  const events: ScrapedEvent[] = [];

  $("#CID29 > ol > li").each((_, element) => {
    const title = $(element).find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!title || /\bclosed\b/i.test(title)) return;

    const dateText = $(element).find(".subHeader .date").first().text().replace(/\s+/g, " ").trim();
    const eventDate = parseDate(dateText.split(/\s+[–—-]\s+/)[0]?.trim());
    if (!eventDate) return;

    const location = $(element).find(".eventLocation .name").first().text().replace(/\s+/g, " ").trim();
    const description = $(element).find(".icalDescription").first().text().replace(/\s+/g, " ").trim();
    events.push({
      title,
      description: description || null,
      eventDate,
      endDate: null,
      venueName: "Brookfield Public Library",
      venueAddress: location || "1900 N. Calhoun Rd, Brookfield, WI 53005",
      venueCity: "Brookfield, WI",
      category: guessCategory(`${title} ${description}`),
      sourceUrl: url,
      sourceName: "Brookfield Public Library",
      isFree: true,
      isOnCampus: false,
    });
  });

  return futureEvents(dedupeScrapedEvents(events), 75)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000);
}

// ─── Brookfield Public Library ──────────────────────────────────────────────
export async function scrapeBrookfieldLibrary(): Promise<ScrapedEvent[]> {
  const url = "https://www.ci.brookfield.wi.us/calendar.aspx?view=list&CID=29";
  const html = await fetchHtml(url);
  return html ? parseBrookfieldLibraryCalendarEvents(html) : [];
}

// ─── Visit Waukesha ───────────────────────────────────────────────────────────

function chicagoOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
  return (asUtc - date.getTime()) / 60_000;
}

function chicagoCalendarDate(year: number, month: number, day: number, hour: number, minute: number) {
  const utcGuess = Date.UTC(year, month, day, hour, minute, 0, 0);
  let result = new Date(utcGuess - chicagoOffsetMinutes(new Date(utcGuess)) * 60_000);
  const correctedOffset = chicagoOffsetMinutes(result);
  result = new Date(utcGuess - correctedOffset * 60_000);
  return result;
}

function parseVisitWaukeshaDate(dateValue: string, dateText: string, referenceDate: Date) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = dateText.match(/@\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!dateMatch) return parseCommunityCalendarDate(dateText, referenceDate);

  let hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
  const meridiem = timeMatch?.[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  const eventDate = chicagoCalendarDate(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hour, minute);
  return Number.isNaN(eventDate.getTime()) ? null : eventDate;
}

function parseVisitWaukeshaVenue(venueName: string, venueAddress: string) {
  const cityMatch = venueAddress.match(/,\s*([A-Za-z .'-]+),\s+WI(?:,\s*United States)?\s*$/i);
  if (!cityMatch?.[1]) return null;
  return {
    venueName: venueName || "Visit Waukesha event venue",
    venueAddress,
    venueCity: `${cityMatch[1].trim()}, WI`,
  };
}

export function parseVisitWaukeshaEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const sourceUrl = "https://visitwaukesha.org/events/";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $("article.tribe-events-calendar-list__event").each((_, element) => {
    const titleLink = $(element).find(".tribe-events-calendar-list__event-title-link").first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    const href = titleLink.attr("href")?.trim();
    const dateNode = $(element).find("time.tribe-events-calendar-list__event-datetime").first();
    const eventDate = parseVisitWaukeshaDate(
      dateNode.attr("datetime") ?? "",
      dateNode.text().replace(/\s+/g, " ").trim(),
      referenceDate,
    );
    const venueName = $(element).find(".tribe-events-calendar-list__event-venue-title").first().text().replace(/\s+/g, " ").trim();
    const venueAddress = $(element).find(".tribe-events-calendar-list__event-venue-address").first().text().replace(/\s+/g, " ").trim();
    const venue = parseVisitWaukeshaVenue(venueName, venueAddress);
    if (!title || !href || !eventDate || !venue) return;

    const description = $(element).find(".tribe-events-calendar-list__event-description").first().text().replace(/\s+/g, " ").trim();
    const cost = $(element).find(".tribe-events-calendar-list__event-cost").first().text().replace(/\s+/g, " ").trim();
    events.push({
      title,
      description: description.slice(0, 1000) || null,
      eventDate,
      endDate: null,
      ...venue,
      category: guessCategory(`${title} ${description}`),
      sourceUrl: href.startsWith("http") ? href : new URL(href, sourceUrl).toString(),
      sourceName: "Visit Waukesha",
      isFree: /free admission|\bfree\b|no charge/i.test(cost),
      isOnCampus: false,
    });
  });

  return futureEvents(dedupeScrapedEvents(events), 75)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= referenceDate.getTime() - 6 * 60 * 60 * 1000);
}

export async function scrapeVisitWaukesha(): Promise<ScrapedEvent[]> {
  const url = "https://visitwaukesha.org/events/";
  const html = await fetchHtml(url);
  return html ? parseVisitWaukeshaEvents(html) : [];
}

// ─── Downtown Waukesha ────────────────────────────────────────────────────────

function parseDowntownWaukeshaDate(raw: string) {
  const cleaned = raw
    .replace(/(\d)(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/\s*@\s*/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  let hour = Number(match[4]);
  if (match[6].toLowerCase() === "pm" && hour < 12) hour += 12;
  if (match[6].toLowerCase() === "am" && hour === 12) hour = 0;
  const eventDate = chicagoCalendarDate(Number(match[3]), month, Number(match[2]), hour, Number(match[5] ?? 0));
  return Number.isNaN(eventDate.getTime()) ? null : eventDate;
}

function parseDowntownWaukeshaVenue(raw: string) {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { venueName: "Downtown Waukesha event venue", venueAddress: null, venueCity: "Waukesha, WI" };
  }
  const containsStreetAddress = /\b\d{1,5}\s+/.test(normalized);
  const address = containsStreetAddress
    ? (/\bwaukesha,\s*wi\b/i.test(normalized) ? normalized : `${normalized}, Waukesha, WI`)
    : null;
  const venueName = containsStreetAddress && normalized.includes(",")
    ? normalized.split(",")[0].trim() || "Downtown Waukesha event venue"
    : normalized;
  return { venueName, venueAddress: address, venueCity: "Waukesha, WI" };
}

export function parseDowntownWaukeshaEvents(html: string, now = new Date()): ScrapedEvent[] {
  const sourceUrl = "https://www.downtownwaukesha.com/upcoming-events/";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("article.event-card-box").each((_, element) => {
    const title = $(element).find(".event-card-title").first().text().replace(/\s+/g, " ").trim();
    const dateText = $(element).find("time.event-card-time").first().text().replace(/\s+/g, " ").trim();
    const eventDate = parseDowntownWaukeshaDate(dateText);
    const meta = $(element).find(".event-card-meta li").eq(1).text().replace(/\s+/g, " ").trim();
    const description = $(element).find(".event-card-desc").first().text().replace(/\s+/g, " ").trim();
    const href = $(element).find("a[href]").filter((__, anchor) => /view details/i.test($(anchor).text())).first().attr("href")?.trim();
    const venue = parseDowntownWaukeshaVenue(meta);
    if (!title || !eventDate || !href) return;
    events.push({
      title: title.replace(/^\d{4}\s+/, ""),
      description: description.slice(0, 1000) || null,
      eventDate,
      endDate: null,
      ...venue,
      category: guessCategory(`${title} ${description}`),
      sourceUrl: href.startsWith("http") ? href : new URL(href, sourceUrl).toString(),
      sourceName: "Downtown Waukesha",
      isFree: /\bfree\b/i.test($(element).text()),
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 75)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000);
}

export async function scrapeDowntownWaukesha(): Promise<ScrapedEvent[]> {
  const url = "https://www.downtownwaukesha.com/upcoming-events/";
  const html = await fetchHtml(url);
  return html ? parseDowntownWaukeshaEvents(html) : [];
}

// ─── Waukesha Area Chamber of Commerce ─────────────────────────────────────────

type WaukeshaChamberPublicEvent = {
  name?: string;
  startdate?: string;
  enddate?: string;
  start_time?: string | null;
  end_time?: string | null;
  location_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  event_cost?: string | null;
  event_reg_link?: string | null;
  more_info_link?: string | null;
  description?: string | null;
  details?: string | null;
  cd_cancelled_ind?: string | null;
  private_event?: string | number | null;
};

function chamberText(value: string | null | undefined) {
  return cheerio.load(value ?? "").text().replace(/\s+/g, " ").trim();
}

function parseChamberDate(dateValue: string | undefined, timeValue: string | null | undefined) {
  const dateMatch = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue?.match(/^(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;
  return chicagoCalendarDate(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
}

function chamberVenueAddress(event: WaukeshaChamberPublicEvent) {
  const values = [event.address, event.city, event.state, event.zip]
    .map((value) => value?.trim())
    .filter(Boolean);
  return values.length > 0 ? values.join(", ") : null;
}

function isChamberGovernanceEvent(title: string, description: string | null) {
  return /\b(board of directors|board meeting|committee meeting|membership meeting)\b/i.test(`${title} ${description ?? ""}`);
}

function chamberCategory(title: string, description: string | null) {
  if (/\b(business|network|leadership|professional|ribbon cutting|conference|lunch and learn)\b/i.test(`${title} ${description ?? ""}`)) {
    return "community_center";
  }
  return guessCategory(`${title} ${description ?? ""}`);
}

export function parseWaukeshaChamberEvents(rows: WaukeshaChamberPublicEvent[], now = new Date()): ScrapedEvent[] {
  const events = rows.flatMap((event) => {
    const title = event.name?.replace(/\s+/g, " ").trim();
    const eventDate = parseChamberDate(event.startdate, event.start_time);
    const endDate = event.enddate && event.enddate !== "0000-00-00"
      ? parseChamberDate(event.enddate, event.end_time ?? event.start_time)
      : null;
    const city = event.city?.trim();
    const sourceUrl = event.more_info_link?.trim() || event.event_reg_link?.trim();
    if (!title || !eventDate || !city || !sourceUrl || event.cd_cancelled_ind === "Y" || event.private_event === 1 || event.private_event === "1") {
      return [];
    }
    const description = chamberText(event.details) || chamberText(event.description) || null;
    if (isChamberGovernanceEvent(title, description)) return [];
    const address = chamberVenueAddress(event);
    return [{
      title,
      description: description?.slice(0, 1000) ?? null,
      eventDate,
      endDate,
      venueName: event.location_name?.replace(/\s+/g, " ").trim() || "Waukesha Area Chamber event venue",
      venueAddress: address,
      venueCity: `${city}, ${event.state?.trim() || "WI"}`,
      category: chamberCategory(title, description),
      sourceUrl,
      sourceName: "Waukesha Area Chamber",
      isFree: /\bfree\b|\$\s*0(?:\.00)?\b/i.test(`${event.event_cost ?? ""} ${description ?? ""}`),
      isOnCampus: false,
    } satisfies ScrapedEvent];
  });
  return futureEvents(dedupeScrapedEvents(events), 100)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000);
}

async function fetchWaukeshaChamberYear(year: number) {
  const response = await fetch("https://auth.chamberwidgets.com/cn-api/org/calendar/events", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ searchValues: `&org_id=COWC&year=${year}&day=` }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Waukesha Chamber calendar returned ${response.status}`);
  return response.json() as Promise<WaukeshaChamberPublicEvent[]>;
}

export async function scrapeWaukeshaChamber(now = new Date()): Promise<ScrapedEvent[]> {
  const currentYear = now.getFullYear();
  const years = now.getMonth() >= 10 ? [currentYear, currentYear + 1] : [currentYear];
  const results = await Promise.all(years.map(fetchWaukeshaChamberYear));
  return parseWaukeshaChamberEvents(results.flat(), now);
}

/** Guess a category from title/description keywords */
function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/karaoke/i.test(t)) return "karaoke";
  if (/comedy|comic|improv|stand-?up/i.test(t)) return "comedy";
  if (/farmers'? market|\bmarket\b/i.test(t)) return "market";
  if (/live music|live band|\bband\b|open mic|jazz|acoustic|concert/i.test(t)) return "live_music";
  if (/fishing|angling/i.test(t)) return "sports";
  if (/skate|ice rink|ice arena/i.test(t)) return "sports";
  if (/bowl|bowling/i.test(t)) return "bowling";
  if (/golf/i.test(t)) return "mini_golf";
  if (/kayak|canoe|paddle/i.test(t)) return "kayaking";
  if (/movie|film|cinema|screening/i.test(t)) return "movies";
  if (/dinner|dining|restaurant|food|taste|culinary/i.test(t)) return "dining";
  if (/coffee|cafe|tea/i.test(t)) return "coffee";
  if (/cook|bake|kitchen|chef/i.test(t)) return "cooking_class";
  if (/escape room/i.test(t)) return "escape_room";
  if (/wine|beer|brew|tasting/i.test(t)) return "wine_tasting";
  if (/hike|trail|nature walk/i.test(t)) return "hiking";
  if (/park|garden|outdoor/i.test(t)) return "park";
  if (/library|book|reading|author|storytime/i.test(t)) return "library";
  if (/church|worship|faith|prayer/i.test(t)) return "church";
  if (/sport|game|league|tournament|athletic/i.test(t)) return "sports";
  if (/art|exhibit|gallery|museum|craft|paint|draw|epoxy|resin|theater|theatre|concert|music|dance|perform/i.test(t)) return "arts";
  if (/community|volunteer|fair|festival|market|meetup|social/i.test(t)) return "community_center";
  return "other";
}

// ─── Milwaukee Public Library ────────────────────────────────────────────────
export async function scrapeMilwaukeeLibrary(): Promise<ScrapedEvent[]> {
  const url = "https://mpl.libnet.info/events";
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  // libnet uses .views-row or article.event-row elements
  $(".views-row, article.event-row, .event-listing, .event-item, li.event").each((_, el) => {
    const title = $(el).find("h2, h3, .event-title, .title, a").first().text().trim();
    if (!title || title.length < 3) return;

    const dateText = $(el).find(".date-display-single, .field-name-field-date, time, .event-date, .date").first().text().trim();
    const description = $(el).find(".field-name-body, .description, p").first().text().trim().slice(0, 300) || null;
    const location = $(el).find(".field-name-field-location, .location, .venue").first().text().trim() || null;
    const link = $(el).find("a").first().attr("href");
    const fullUrl = link ? (link.startsWith("http") ? link : `https://mpl.libnet.info${link}`) : url;

    events.push({
      title,
      description,
      eventDate: parseDate(dateText),
      endDate: null,
      venueName: location ?? "Milwaukee Public Library",
      venueAddress: null,
      venueCity: "Milwaukee, WI",
      category: guessCategory(title + " " + (description ?? "")),
      sourceUrl: fullUrl,
      sourceName: "Milwaukee Public Library",
      isFree: true,
      isOnCampus: false,
    });
  });

  // Fallback: grab any anchor with date-like sibling text
  if (events.length === 0) {
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 5 || text.length > 120) return;
      const parent = $(el).parent();
      const dateText = parent.find("time, .date").first().text().trim();
      events.push({
        title: text,
        description: null,
        eventDate: parseDate(dateText),
        endDate: null,
        venueName: "Milwaukee Public Library",
        venueAddress: null,
        venueCity: "Milwaukee, WI",
        category: guessCategory(text),
        sourceUrl: $(el).attr("href") ? `https://mpl.libnet.info${$(el).attr("href")}` : url,
        sourceName: "Milwaukee Public Library",
        isFree: true,
        isOnCampus: false,
      });
    });
  }

  return events.slice(0, 30);
}

// ─── Waukesha Public Library ─────────────────────────────────────────────────
export async function scrapeWaukeshaLibrary(): Promise<ScrapedEvent[]> {
  const url = "https://waukesha.librarycalendar.com/events/upcoming";
  const pages = await Promise.all([0, 1, 2].map((page) => fetchHtml(page === 0 ? url : `${url}?page=${page}`)));
  const events: ScrapedEvent[] = [];
  const seenUrls = new Set<string>();

  for (const html of pages) {
    if (!html) continue;
    const $ = cheerio.load(html);
    $("article.event-card.event-card--sparse").each((_, el) => {
    // The calendar also exposes room reservations. Public library programs carry
    // an official age-group indicator; only those should appear in discovery.
    if ($(el).find(".lc-event__color-indicator").length === 0) return;
    const title = $(el).find(".lc-event__title a, h2, h3, .title, a").first().text().trim();
    if (!title || title.length < 3) return;

    const dateIcon = $(el).find(".lc-date-icon").first();
    const month = dateIcon.find(".lc-date-icon__item--month").text().trim();
    const day = dateIcon.find(".lc-date-icon__item--day").text().trim();
    const year = dateIcon.find(".lc-date-icon__item--year").text().trim();
    const time = $(el).find(".lc-event-info-item--time").first().text().trim();
    const description = null;
    const link = $(el).find(".lc-event__title a, a").first().attr("href");
    const fullUrl = link ? (link.startsWith("http") ? link : `https://waukesha.librarycalendar.com${link}`) : url;
    if (seenUrls.has(fullUrl)) return;
    seenUrls.add(fullUrl);

    events.push({
      title,
      description,
      eventDate: parseWaukeshaCalendarDate(month, day, year, time),
      endDate: null,
      venueName: "Waukesha Public Library",
      venueAddress: "321 Wisconsin Ave, Waukesha, WI 53186",
      venueCity: "Waukesha, WI",
      category: guessCategory(title + " " + (description ?? "")),
      sourceUrl: fullUrl,
      sourceName: "Waukesha Public Library",
      isFree: true,
      isOnCampus: false,
    });
    });
  }

  return events.slice(0, 30);
}

// ─── La Crosse Public Library ─────────────────────────────────────────────────

export function parseLaCrosseLibraryEvents(html: string, now = new Date()): ScrapedEvent[] {
  const url = "https://www.lacrosselibrary.org/events/upcoming";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $("article.event-card.event-card--sparse").each((_, element) => {
    // The library page also contains non-program content. Published programs carry
    // the calendar color indicator and a dated event-card structure.
    if ($(element).find(".lc-event__color-indicator").length === 0) return;
    const titleLink = $(element).find(".lc-event__title a").first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    const month = $(element).find(".lc-date-icon__item--month").first().text().trim();
    const day = $(element).find(".lc-date-icon__item--day").first().text().trim();
    const year = $(element).find(".lc-date-icon__item--year").first().text().trim();
    const time = $(element).find(".lc-event-info-item--time").first().text().replace(/\s+/g, " ").trim();
    const location = $(element).find(".lc-event-info__item--categories").first().text().replace(/\s+/g, " ").trim();
    const groups = $(element).find(".lc-event-info__item--colors").first().text().replace(/\s+/g, " ").trim();
    const eventDate = parseWaukeshaCalendarDate(month, day, year, time);
    const href = titleLink.attr("href")?.trim();

    // Offsite library programs require their own stated address. Do not label an
    // outreach event as occurring at the main library when the calendar does not
    // identify its public venue.
    if (!title || !eventDate || !href || /\boffsite\b|\boutreach\b/i.test(location)) return;

    events.push({
      title,
      description: groups || null,
      eventDate,
      endDate: null,
      venueName: location || "La Crosse Public Library",
      venueAddress: "800 Main St, La Crosse, WI 54601",
      venueCity: "La Crosse, WI",
      category: guessCategory(`${title} ${groups}`),
      sourceUrl: href.startsWith("http") ? href : new URL(href, url).toString(),
      sourceName: "La Crosse Public Library",
      isFree: true,
      isOnCampus: false,
    });
  });

  return futureEvents(dedupeScrapedEvents(events), 100)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000);
}

export async function scrapeLaCrosseLibrary(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://www.lacrosselibrary.org/events/upcoming");
  return html ? parseLaCrosseLibraryEvents(html) : [];
}

// ─── City of La Crosse Parks, Recreation & Forestry ──────────────────────────

export function parseLaCrosseParksDetail(html: string, fallbackDate: Date) {
  const text = cheerio.load(html).text().replace(/\s+/g, " ").trim();
  const nextDate = text.match(/Next date:\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*\|\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let eventDate = fallbackDate;
  if (nextDate) {
    const monthIndex = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
      .indexOf(nextDate[1].split(" ")[0].toLowerCase());
    const dayYear = nextDate[1].match(/\s(\d{1,2}),\s(\d{4})$/);
    let hour = Number(nextDate[2]);
    if (nextDate[4].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (nextDate[4].toLowerCase() === "am" && hour === 12) hour = 0;
    if (monthIndex >= 0 && dayYear) {
      eventDate = chicagoCalendarDate(Number(dayYear[2]), monthIndex, Number(dayYear[1]), hour, Number(nextDate[3]));
    }
  }

  const venueMatch = text.match(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\s*\|\s*([^|]{3,160})/i);
  const venueName = venueMatch?.[1]
    ?.replace(/\bregistration fee\s*:.*$/i, "")
    .replace(/\bnext date\s*:.*$/i, "")
    .replace(/\s+ages?\s+\d+\+.*$/i, "")
    .replace(/\s+OR\s+\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?[-–].*$/i, "")
    .trim() || null;

  return { eventDate, venueName };
}

export function parseLaCrosseParksEvents(html: string, now = new Date()): ScrapedEvent[] {
  const url = "https://www.cityoflacrosse.org/Your-Government/Departments/Parks-Recreation-Forestry/Recreation/Activities-Calendar";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $(".list-item-container.homepage-show article").each((_, element) => {
    const anchor = $(element).find("a[href]").first();
    const title = $(element).find(".list-item-title").first().text().replace(/\s+/g, " ").trim();
    const day = $(element).find(".part-date").first().text().trim();
    const month = $(element).find(".part-month").first().text().trim();
    const year = $(element).find(".part-year").first().text().trim();
    const description = $(element).find(".list-item-block-desc").first().text().replace(/\s+/g, " ").trim();
    const tags = $(element).find(".tagged-as-list").first().text().replace(/\s+/g, " ").trim();
    const href = anchor.attr("href")?.trim();
    const eventDate = parseWaukeshaCalendarDate(month, day, year);
    if (!title || !href || !eventDate) return;

    events.push({
      title,
      description: description.slice(0, 1000) || null,
      eventDate,
      endDate: null,
      venueName: "City of La Crosse Parks & Recreation",
      venueAddress: null,
      venueCity: "La Crosse, WI",
      category: guessCategory(`${title} ${description} ${tags}`),
      sourceUrl: href.startsWith("http") ? href : new URL(href, url).toString(),
      sourceName: "City of La Crosse Parks & Recreation",
      isFree: /\bfree\b|no charge/i.test(`${title} ${description}`),
      isOnCampus: false,
    });
  });

  return futureEvents(dedupeScrapedEvents(events), 75)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000);
}

export async function scrapeLaCrosseParks(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://www.cityoflacrosse.org/Your-Government/Departments/Parks-Recreation-Forestry/Recreation/Activities-Calendar");
  if (!html) return [];
  const listedEvents = parseLaCrosseParksEvents(html);
  const enrichedEvents = await Promise.all(listedEvents.map(async (event) => {
    const detailHtml = await fetchHtml(event.sourceUrl);
    if (!detailHtml || !event.eventDate) return event;
    const detail = parseLaCrosseParksDetail(detailHtml, event.eventDate);
    return {
      ...event,
      eventDate: detail.eventDate,
      venueName: detail.venueName || event.venueName,
    } satisfies ScrapedEvent;
  }));
  return futureEvents(dedupeScrapedEvents(enrichedEvents), 75);
}

// ─── UW-Milwaukee ─────────────────────────────────────────────────────────────
export async function scrapeUWMilwaukee(): Promise<ScrapedEvent[]> {
  const url = "https://uwm.edu/events/";
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $("article, .event, .tribe-event, .views-row, li.event-item").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .tribe-event-url, .entry-title, a").first().text().trim();
    if (!title || title.length < 3) return;

    const dateText = $(el).find("time, .tribe-event-date-start, .date, .event-date, abbr").first().text().trim();
    const description = $(el).find(".tribe-event-description, p, .description").first().text().trim().slice(0, 300) || null;
    const location = $(el).find(".tribe-venue, .location, .tribe-address").first().text().trim() || null;
    const link = $(el).find("a").first().attr("href");

    events.push({
      title,
      description,
      eventDate: parseDate(dateText),
      endDate: null,
      venueName: location ?? "UW-Milwaukee",
      venueAddress: null,
      venueCity: "Milwaukee, WI",
      category: guessCategory(title + " " + (description ?? "")),
      sourceUrl: link ?? url,
      sourceName: "UW-Milwaukee",
      isFree: false, // campus events may have admission
      isOnCampus: true,
    });
  });

  return events.slice(0, 30);
}

// ─── Marquette University ─────────────────────────────────────────────────────
export async function scrapeMarquette(): Promise<ScrapedEvent[]> {
  const url = "https://today.marquette.edu/calendar/";
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $("article, .event, .tribe-event, .views-row, .event-item, li").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .entry-title, a").first().text().trim();
    if (!title || title.length < 3 || title.length > 150) return;

    const dateText = $(el).find("time, .tribe-event-date-start, .date, abbr").first().text().trim();
    const description = $(el).find("p, .description, .tribe-event-description").first().text().trim().slice(0, 300) || null;
    const location = $(el).find(".tribe-venue, .location, .venue").first().text().trim() || null;
    const link = $(el).find("a").first().attr("href");
    const fullUrl = link ? (link.startsWith("http") ? link : `https://today.marquette.edu${link}`) : url;

    events.push({
      title,
      description,
      eventDate: parseDate(dateText),
      endDate: null,
      venueName: location ?? "Marquette University",
      venueAddress: null,
      venueCity: "Milwaukee, WI",
      category: guessCategory(title + " " + (description ?? "")),
      sourceUrl: fullUrl,
      sourceName: "Marquette University",
      isFree: false,
      isOnCampus: true,
    });
  });

  return events.slice(0, 30);
}

// ─── Club 400, Waukesha ──────────────────────────────────────────────────────

export function parseClub400EntertainmentEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const url = "https://www.clubwaukesha.com/events";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("h1, h2, h3").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!/karaoke|open mic|live music|live band|comedy/i.test(title)) return;
    const card = $(el).closest("article, .event, li, section");
    const nearby = [card.text(), $(el).parent().text(), $(el).next().text()].join(" ").replace(/\s+/g, " ").trim();
    const eventDate = parseCommunityCalendarDate(nearby, referenceDate);
    if (!eventDate) return;
    const link = card.find("a[href]").first().attr("href") ?? $(el).find("a[href]").first().attr("href");
    events.push({
      title,
      description: nearby.replace(title, "").slice(0, 500).trim() || null,
      eventDate,
      endDate: null,
      venueName: "Club 400",
      venueAddress: "322 Williams St, Waukesha, WI 53186",
      venueCity: "Waukesha, WI",
      category: guessCategory(`${title} ${nearby}`),
      sourceUrl: link ? (link.startsWith("http") ? link : new URL(link, url).toString()) : url,
      sourceName: "Club 400",
      isFree: /free|no cover/i.test(nearby),
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 30, referenceDate);
}

export async function scrapeClub400Entertainment(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://www.clubwaukesha.com/events");
  return html ? parseClub400EntertainmentEvents(html) : [];
}

// ─── Milwaukee Comedy ────────────────────────────────────────────────────────

export function parseMilwaukeeComedyEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const url = "https://www.milwaukeecomedy.com/";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("a[href]").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href") ?? "";
    if (!title || title.length > 180 || !/comedy|laugh/i.test(title) || !/(ticket|laughingtap|milwaukeecomedy)/i.test(href)) return;
    const eventDate = parseCommunityCalendarDate(title, referenceDate);
    if (!eventDate) return;
    events.push({
      title,
      description: "Official Milwaukee Comedy ticket and show information.",
      eventDate,
      endDate: null,
      venueName: "Milwaukee Comedy",
      venueAddress: null,
      venueCity: "Milwaukee, WI",
      category: "comedy",
      sourceUrl: href.startsWith("http") ? href : new URL(href, url).toString(),
      sourceName: "Milwaukee Comedy",
      isFree: false,
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 30, referenceDate);
}

export async function scrapeMilwaukeeComedy(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://www.milwaukeecomedy.com/");
  return html ? parseMilwaukeeComedyEvents(html) : [];
}

// ─── The Laughing Tap, Milwaukee ─────────────────────────────────────────────

export function parseLaughingTapComedyEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const url = "https://laughingtap.com/";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const addEvent = (title: string, href: string) => {
    if (!title || title.length > 180 || !/etix\.com\/ticket\/(?:e|p)\//i.test(href)) return;
    const eventDate = parseCommunityCalendarDate(title, referenceDate);
    if (!eventDate) return;
    events.push({
      title,
      description: "Official live comedy listing. Most shows are 18+ unless otherwise stated; confirm details with the venue.",
      eventDate,
      endDate: null,
      venueName: "The Laughing Tap Comedy Club",
      venueAddress: "761 N. Jefferson St, Milwaukee, WI 53202",
      venueCity: "Milwaukee, WI",
      category: "comedy",
      sourceUrl: href,
      sourceName: "The Laughing Tap",
      isFree: false,
      isOnCampus: false,
    });
  };
  $("a[href]").each((_, el) => {
    addEvent($(el).text().replace(/\s+/g, " ").trim(), $(el).attr("href") ?? "");
  });
  $("a[href] img[alt]").each((_, el) => {
    addEvent($(el).attr("alt")?.replace(/\s+/g, " ").trim() ?? "", $(el).closest("a[href]").attr("href") ?? "");
  });
  return futureEvents(dedupeScrapedEvents(events), 45, referenceDate);
}

export async function scrapeLaughingTapComedy(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://laughingtap.com/");
  return html ? parseLaughingTapComedyEvents(html) : [];
}

// ─── Milwaukee Improv, Brookfield ────────────────────────────────────────────

export function parseMilwaukeeImprovEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const url = "https://improv.com/milwaukee/calendar/";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $(".cal-list a.item[href]").each((_, el) => {
    const month = $(el).find(".dates dt").first().text().trim();
    const day = $(el).find(".dates dd").first().clone().children().remove().end().text().trim();
    const title = $(el).find("h3").first().text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href") ?? "";
    const eventDate = parseCommunityCalendarDate(`${month} ${day}`, referenceDate);
    if (!title || !eventDate || !href) return;
    events.push({
      title,
      description: "Official Milwaukee Improv show listing. Unless otherwise specified, guests must be at least 21; confirm show details and venue policies before booking.",
      eventDate,
      endDate: null,
      venueName: "Milwaukee Improv",
      venueAddress: "20110 Lower Union Street, Brookfield, WI",
      venueCity: "Brookfield, WI",
      category: "comedy",
      sourceUrl: new URL(href, url).toString(),
      sourceName: "Milwaukee Improv",
      isFree: /two cents tuesday/i.test(title),
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 60, referenceDate);
}

export async function scrapeMilwaukeeImprov(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://improv.com/milwaukee/calendar/");
  return html ? parseMilwaukeeImprovEvents(html) : [];
}

// ─── OnMilwaukee Weekend Preview ─────────────────────────────────────────────
export async function scrapeOnMilwaukee(): Promise<ScrapedEvent[]> {
  const url = "https://onmilwaukee.com/articles/weekend-preview";
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  // OnMilwaukee uses article cards
  $("article, .article-item, .story-item, .card").each((_, el) => {
    const title = $(el).find("h2, h3, h4, .title, a").first().text().trim();
    if (!title || title.length < 5 || title.length > 150) return;

    const description = $(el).find("p, .summary, .excerpt").first().text().trim().slice(0, 300) || null;
    const link = $(el).find("a").first().attr("href");
    const fullUrl = link ? (link.startsWith("http") ? link : `https://onmilwaukee.com${link}`) : url;
    const dateText = $(el).find("time, .date, .published").first().attr("datetime") || $(el).find("time, .date").first().text().trim();

    events.push({
      title,
      description,
      eventDate: parseDate(dateText),
      endDate: null,
      venueName: null,
      venueAddress: null,
      venueCity: "Milwaukee, WI",
      category: guessCategory(title + " " + (description ?? "")),
      sourceUrl: fullUrl,
      sourceName: "OnMilwaukee",
      isFree: false,
      isOnCampus: false,
    });
  });

  return events.slice(0, 20);
}

// ─── Madison official public calendars ───────────────────────────────────────

function addMadisonHeadingEvents($: cheerio.CheerioAPI, options: {
  selector: string;
  sourceUrl: string;
  sourceName: string;
  venueName: string;
  venueAddress?: string;
  categoryText?: string;
  isFree: boolean;
  isOnCampus?: boolean;
  excludedTitles?: string[];
}) {
  const events: ScrapedEvent[] = [];
  const excluded = new Set((options.excludedTitles ?? []).map((title) => title.toLowerCase()));
  $(options.selector).each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (title.length < 3 || title.length > 180 || excluded.has(title.toLowerCase()) || isDateOnlyHeading(title)) return;
    const card = $(el).closest("article, li, .event, .views-row, .card");
    const nearbyText = [card.text(), $(el).parent().text(), $(el).next().text(), $(el).next().next().text()].join(" ").replace(/\s+/g, " ").trim();
    const eventDate = parseCommunityCalendarDate(nearbyText);
    if (!eventDate) return;
    const link = card.find("a[href]").first().attr("href") ?? $(el).find("a[href]").first().attr("href");
    const sourceUrl = link ? (link.startsWith("http") ? link : new URL(link, options.sourceUrl).toString()) : options.sourceUrl;
    const description = nearbyText.replace(title, "").slice(0, 500).trim() || null;
    events.push({
      title,
      description,
      eventDate,
      endDate: null,
      venueName: options.venueName,
      venueAddress: options.venueAddress ?? null,
      venueCity: "Madison, WI",
      category: guessCategory(`${title} ${options.categoryText ?? ""} ${description ?? ""}`),
      sourceUrl,
      sourceName: options.sourceName,
      isFree: options.isFree,
      isOnCampus: options.isOnCampus ?? false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events));
}

function isDateOnlyHeading(title: string) {
  return /^(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:\s*\||\s|,|$)/i.test(title);
}

export async function scrapeMadisonLibrary(): Promise<ScrapedEvent[]> {
  const url = "https://www.madisonpubliclibrary.org/spaces/events";
  const html = await fetchHtml(url);
  if (!html) return [];
  return addMadisonHeadingEvents(cheerio.load(html), {
    selector: "h3, .event-title, .views-row h2",
    sourceUrl: url,
    sourceName: "Madison Public Library",
    venueName: "Madison Public Library",
    categoryText: "library books reading storytime author talk",
    isFree: true,
    excludedTitles: ["Events Calendar", "Find more events", "Around Madison", "Online"],
  });
}

export async function scrapeCityOfMadisonEvents(): Promise<ScrapedEvent[]> {
  const url = "https://www.cityofmadison.com/events";
  const html = await fetchHtml(url);
  if (!html) return [];
  return addMadisonHeadingEvents(cheerio.load(html), {
    selector: "article h2, article h3, .event h2, .event h3, main h2, main h3",
    sourceUrl: url,
    sourceName: "City of Madison",
    venueName: "City of Madison public event",
    categoryText: "park recreation community public event",
    isFree: true,
    excludedTitles: ["Events", "Annual & Special Events", "Search Events"],
  });
}

export async function scrapeOvertureCenter(): Promise<ScrapedEvent[]> {
  const url = "https://www.overture.org/";
  const html = await fetchHtml(url);
  if (!html) return [];
  return addMadisonHeadingEvents(cheerio.load(html), {
    selector: "article h2, article h3, .event h2, .event h3, .card h2, .card h3",
    sourceUrl: url,
    sourceName: "Overture Center",
    venueName: "Overture Center for the Arts",
    venueAddress: "201 State St, Madison, WI 53703",
    categoryText: "theater theatre performing arts music comedy dance",
    isFree: false,
    excludedTitles: ["Coming Up", "Overture’s 2025/26 Season", "Subscriptions available now"],
  });
}

export async function scrapeCityChurchMadison(): Promise<ScrapedEvent[]> {
  const url = "https://citychurchmadison.org/events";
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("h2, h3, .event-title").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!title || title.length > 180 || isDateOnlyHeading(title) || ["events", "calendar", "for additional event registrations"].includes(title.toLowerCase())) return;
    const nearbyText = [$(el).next().text(), $(el).next().next().text(), $(el).next().next().next().text()].join(" ").replace(/\s+/g, " ").trim();
    const eventDate = parseCommunityCalendarDate(nearbyText);
    if (!eventDate) return;
    const link = $(el).nextAll("a[href]").first().attr("href");
    events.push({
      title,
      description: nearbyText.slice(0, 500) || null,
      eventDate,
      endDate: null,
      venueName: "City Church Madison",
      venueAddress: "4909 East Buckeye Road, Madison, WI 53716",
      venueCity: "Madison, WI",
      category: "church",
      sourceUrl: link ? (link.startsWith("http") ? link : new URL(link, url).toString()) : url,
      sourceName: "City Church Madison",
      isFree: true,
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events));
}

type UWMadisonCalendarEvent = {
  id: number | string;
  title?: string;
  description?: string;
  startDate?: string;
  startDateUnix?: number;
  endDateUnix?: number | null;
  cost?: string;
  url?: string;
  location?: string;
  latlon?: string;
  sponsor?: string;
  tags?: string[];
};

type UWMArtsCalendarEvent = {
  id: number | string;
  title?: string;
  description?: string;
  url?: string;
  start_date?: string;
  end_date?: string;
  cost?: string;
  venue?: {
    venue?: string;
    address?: string;
    city?: string;
  };
};

function plainText(value: string | undefined) {
  if (!value) return "";
  return cheerio.load(value).text().replace(/\s+/g, " ").trim();
}

function parseApiDate(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseUWMArtsCalendarEvents(events: UWMArtsCalendarEvent[], now = new Date()): ScrapedEvent[] {
  const normalized = events.flatMap((event) => {
    const title = plainText(event.title);
    const eventDate = parseApiDate(event.start_date);
    if (!title || !eventDate) return [];
    const description = plainText(event.description).slice(0, 1000) || null;
    const cost = plainText(event.cost);
    const venue = event.venue;
    return [{
      title,
      description,
      eventDate,
      endDate: parseApiDate(event.end_date),
      venueName: venue?.venue?.trim() || "UW–Milwaukee Peck School of the Arts",
      venueAddress: venue?.address?.trim() || null,
      venueCity: venue?.city?.trim() ? `${venue.city.trim()}, WI` : "Milwaukee, WI",
      category: "arts",
      sourceUrl: event.url?.startsWith("http") ? event.url : "https://uwm.edu/arts/events/",
      sourceName: "UW–Milwaukee Peck School of the Arts",
      isFree: !cost || /free|no charge|\$0(?:\.00)?\b/i.test(cost),
      isOnCampus: true,
    } satisfies ScrapedEvent];
  });
  return dedupeScrapedEvents(normalized)
    .filter((event) => event.eventDate && event.eventDate.getTime() >= now.getTime() - 6 * 60 * 60 * 1000)
    .slice(0, 60);
}

// ─── UW–Milwaukee Peck School of the Arts ─────────────────────────────────────
export async function scrapeUWMArtsPerformingEvents(): Promise<ScrapedEvent[]> {
  const url = "https://uwm.edu/arts/wp-json/tribe/events/v1/events?per_page=60";
  try {
    const response = await axios.get<{ events?: UWMArtsCalendarEvent[] }>(url, {
      headers: { ...HEADERS, Accept: "application/json" },
      timeout: 15000,
      maxRedirects: 5,
    });
    return parseUWMArtsCalendarEvents(response.data.events ?? []);
  } catch (err: any) {
    console.warn(`[communityScraper] Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

export function isLocalMadisonCampusEvent(event: UWMadisonCalendarEvent) {
  const location = (event.location ?? "").toLowerCase();
  if (location.includes("online") || location.includes("virtual")) return false;
  const [lat, lng] = (event.latlon ?? "").split(",").map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return Math.abs(lat - 43.0731) < 0.28 && Math.abs(lng + 89.4012) < 0.32;
  return /(madison|university|arboretum|memorial union|campus)/i.test(event.location ?? "");
}

export async function scrapeUWMadisonEvents(): Promise<ScrapedEvent[]> {
  const url = "https://today.wisc.edu/events.json?limit=100";
  try {
    const response = await axios.get<UWMadisonCalendarEvent[]>(url, {
      headers: { ...HEADERS, Accept: "application/json" },
      timeout: 15000,
      maxRedirects: 5,
    });
    if (!Array.isArray(response.data)) return [];
    const events = response.data.flatMap((event) => {
      const eventDate = event.startDateUnix ? new Date(event.startDateUnix * 1000) : parseDate(event.startDate);
      if (!event.title || !eventDate || !isLocalMadisonCampusEvent(event)) return [];
      const detailsUrl = event.url?.startsWith("http") ? event.url : `https://today.wisc.edu/events/view/${event.id}`;
      const cost = (event.cost ?? "").trim();
      return [{
        title: event.title.trim(),
        description: event.description?.trim().slice(0, 1000) || null,
        eventDate,
        endDate: event.endDateUnix ? new Date(event.endDateUnix * 1000) : null,
        venueName: event.location?.trim() || "UW–Madison campus",
        venueAddress: null,
        venueCity: "Madison, WI",
        category: guessCategory(`${event.title} ${(event.tags ?? []).join(" ")} ${event.description ?? ""}`),
        sourceUrl: detailsUrl,
        sourceName: "UW–Madison Events Calendar",
        isFree: !cost || /free|no charge/i.test(cost),
        isOnCampus: true,
      } satisfies ScrapedEvent];
    });
    return futureEvents(dedupeScrapedEvents(events), 75);
  } catch (err: any) {
    console.warn(`[communityScraper] Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

// ─── Official Church & Lions Club public calendars ───────────────────────────

function publicCommunityTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 180) return false;
  return !/\b(staff|member|members|committee|board|council|leadership|closed session|internal)\b/i.test(normalized);
}

function parseCalendarTime(dateText: string, timeText: string, referenceDate: Date) {
  const isoDate = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const rawDate = isoDate
    ? chicagoCalendarDate(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 12, 0)
    : parseCommunityCalendarDate(dateText, referenceDate);
  if (!rawDate) return null;
  const timeMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) return rawDate;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  const meridiem = timeMatch[3].toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return chicagoCalendarDate(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), hour, minute);
}

/** Eastbrook's official public calendar exposes date-bearing day cells and direct event handoffs. */
export function parseEastbrookChurchEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const sourceUrl = "https://eastbrook.org/events-calendar/";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("td.jubilee-calendar-table-day[data-date]").each((_, dayCell) => {
    const dateText = $(dayCell).attr("data-date") ?? "";
    $(dayCell).find("li a[href]").each((__, link) => {
      const title = $(link).text().replace(/\s+/g, " ").trim();
      // Keep the discovery feed focused on public, in-person activity candidates;
      // recurring worship/classes and known virtual-prayer formats remain on the church calendar.
      if (!publicCommunityTitle(title) || /\b(prayer|bible study|sunday school|worship services?|class|nursery|zoom)\b/i.test(title)) return;
      const timeText = $(link).siblings(".jubilee-calendar-table-day-event-time").first().text().replace(/\s+/g, " ").trim();
      const eventDate = parseCalendarTime(dateText, timeText, referenceDate);
      const href = $(link).attr("href")?.trim();
      if (!eventDate || !href) return;
      events.push({
        title,
        description: "Official Eastbrook Church public event. Confirm details and accessibility with the host before attending.",
        eventDate,
        endDate: null,
        venueName: "Eastbrook Church",
        venueAddress: "5353 N Green Bay Ave, Milwaukee, WI 53209",
        venueCity: "Milwaukee, WI",
        category: "church",
        sourceUrl: href.startsWith("http") ? href : new URL(href, sourceUrl).toString(),
        sourceName: "Eastbrook Church",
        isFree: false,
        isOnCampus: false,
      });
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 90, referenceDate);
}

export async function scrapeEastbrookChurch(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://eastbrook.org/events-calendar/");
  return html ? parseEastbrookChurchEvents(html) : [];
}

/** Corpus Christi's official calendar uses dated event cards with public detail pages. */
export function parseCorpusChristiWaukeshaEvents(html: string, referenceDate = new Date()): ScrapedEvent[] {
  const sourceUrl = "https://ccwauk.org/events";
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("article, .event-card, .event, li").each((_, card) => {
    const titleLink = $(card).find('a[href*="/events/"]').filter((__, link) => !/read more/i.test($(link).text())).first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    if (!publicCommunityTitle(title)) return;
    const cardText = $(card).text().replace(/\s+/g, " ").trim();
    const eventDate = parseCommunityCalendarDate(cardText, referenceDate);
    const href = titleLink.attr("href")?.trim();
    if (!eventDate || !href) return;
    events.push({
      title,
      description: cardText.replace(title, "").replace(/Read More/gi, "").trim().slice(0, 1000) || null,
      eventDate,
      endDate: null,
      // The listing is city-precise but individual event venues vary; do not guess a parish building.
      venueName: null,
      venueAddress: null,
      venueCity: "Waukesha, WI",
      category: "church",
      sourceUrl: href.startsWith("http") ? href : new URL(href, sourceUrl).toString(),
      sourceName: "Corpus Christi Parish",
      isFree: /\bfree\b|no charge|donation/i.test(cardText),
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 90, referenceDate);
}

/** The official eCatholic feed is used when the webpage is edge-protected; it contains only public calendar fields. */
export function parseCorpusChristiWaukeshaIcal(ical: string, referenceDate = new Date()): ScrapedEvent[] {
  const sourceUrl = "https://ccwauk.org/events";
  const unfolded = ical.replace(/\r?\n[ \t]/g, "");
  const events: ScrapedEvent[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const event = block.split("END:VEVENT")[0] ?? "";
    const title = (event.match(/\nSUMMARY:(.+)/)?.[1] ?? "").replace(/\\[,;]/g, (match) => match.slice(1)).trim();
    const start = event.match(/\nDTSTART(?:;[^:]+)?:(\d{8})(?:T(\d{2})(\d{2})(\d{2})?)?/);
    if (!publicCommunityTitle(title) || !start || /STATUS:CANCELLED|\bRRULE:/i.test(event)) continue;
    const datePart = start[1];
    const eventDate = chicagoCalendarDate(Number(datePart.slice(0, 4)), Number(datePart.slice(4, 6)) - 1, Number(datePart.slice(6, 8)), Number(start[2] ?? 12), Number(start[3] ?? 0));
    const end = event.match(/\nDTEND(?:;[^:]+)?:(\d{8})(?:T(\d{2})(\d{2})(\d{2})?)?/);
    const endDate = end
      ? chicagoCalendarDate(Number(end[1].slice(0, 4)), Number(end[1].slice(4, 6)) - 1, Number(end[1].slice(6, 8)), Number(end[2] ?? 12), Number(end[3] ?? 0))
      : null;
    const description = (event.match(/\nDESCRIPTION:(.+)/)?.[1] ?? "").replace(/\\[,;]/g, (match) => match.slice(1)).trim();
    if (/\bsold out\b/i.test(description)) continue;
    events.push({
      title,
      description: description.slice(0, 1000) || null,
      eventDate,
      endDate,
      venueName: null,
      venueAddress: null,
      venueCity: "Waukesha, WI",
      category: "church",
      sourceUrl,
      sourceName: "Corpus Christi Parish",
      isFree: /\bfree\b|no charge|donation/i.test(description),
      isOnCampus: false,
    });
  }
  return futureEvents(dedupeScrapedEvents(events), 90, referenceDate);
}

export async function scrapeCorpusChristiWaukesha(): Promise<ScrapedEvent[]> {
  const ical = await fetchPublicText("https://ccwauk.org/icalendar0.ics", "text/calendar,text/plain,*/*");
  return ical ? parseCorpusChristiWaukeshaIcal(ical) : [];
}

function parseLionsCalendarEvents(html: string, options: {
  sourceUrl: string;
  sourceName: "Cudahy Lions Club" | "Waukesha Lions Club";
  city: "Cudahy" | "Waukesha";
  defaultZip?: string;
}, referenceDate = new Date()): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  $("div").each((_, card) => {
    const strongNodes = $(card).children("strong");
    if (strongNodes.length < 2) return;
    const title = strongNodes.first().text().replace(/\s+/g, " ").trim().replace(/[.]$/, "");
    const dateText = strongNodes.eq(1).text().replace(/\s+/g, " ").trim();
    if (!publicCommunityTitle(title)) return;
    const textParts = ($(card).html() ?? "").split(/<br\s*\/?\s*>/i)
      .map((part) => cheerio.load(part).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const allText = $(card).text().replace(/\s+/g, " ").trim();
    const eventDate = parseCalendarTime(dateText, allText.replace(dateText, ""), referenceDate);
    if (!eventDate) return;
    const locationCandidates = textParts.filter((part) => /\b(?:park|ranch|kranch|avenue|ave\.?|street|st\.?)\b/i.test(part));
    const rawLocation = locationCandidates.find((part) => !/\b(meeting|member|board)\b/i.test(part)) ?? "";
    const addressMatch = rawLocation.match(/^(.*?)\s+(\d{1,5}\s+.+)$/);
    const venueName = addressMatch?.[1]?.trim() || rawLocation || null;
    const rawAddress = addressMatch?.[2]?.trim() ?? "";
    const addressHasCity = new RegExp(`\\b${options.city}\\b`, "i").test(rawAddress);
    const addressHasState = /,\s*WI(?:\s+\d{5})?$/i.test(rawAddress);
    const venueAddress = rawAddress
      ? `${rawAddress}${addressHasCity ? "" : `, ${options.city}`}${addressHasState ? "" : `, WI${options.defaultZip ? ` ${options.defaultZip}` : ""}`}`
      : null;
    const description = textParts
      .filter((part) => part !== title && part !== dateText && part !== rawLocation && !/^\d{1,2}:\d{2}\s*(?:am|pm)/i.test(part) && !/^varies$/i.test(part))
      .join(" ")
      .slice(0, 1000) || null;
    events.push({
      title,
      description,
      eventDate,
      endDate: null,
      venueName,
      venueAddress,
      venueCity: `${options.city}, WI`,
      category: "community",
      sourceUrl: options.sourceUrl,
      sourceName: options.sourceName,
      isFree: /\bfree\b|no charge|donation/i.test(allText),
      isOnCampus: false,
    });
  });
  return futureEvents(dedupeScrapedEvents(events), 60, referenceDate);
}

export function parseCudahyLionsClubEvents(html: string, referenceDate = new Date()) {
  return parseLionsCalendarEvents(html, {
    sourceUrl: "https://e-clubhouse.org/sites/cudahy_wi/calendar.php",
    sourceName: "Cudahy Lions Club",
    city: "Cudahy",
    defaultZip: "53110",
  }, referenceDate);
}

export async function scrapeCudahyLionsClub(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://e-clubhouse.org/sites/cudahy_wi/calendar.php");
  return html ? parseCudahyLionsClubEvents(html) : [];
}

export function parseWaukeshaLionsClubEvents(html: string, referenceDate = new Date()) {
  return parseLionsCalendarEvents(html, {
    sourceUrl: "https://e-clubhouse.org/sites/waukesha_noon/calendar.php",
    sourceName: "Waukesha Lions Club",
    city: "Waukesha",
  }, referenceDate);
}

export async function scrapeWaukeshaLionsClub(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://e-clubhouse.org/sites/waukesha_noon/calendar.php");
  return html ? parseWaukeshaLionsClubEvents(html) : [];
}

// ─── Official community-help public calendars ─────────────────────────────────

function publicCalendarCityFromAddress(address: string, fallbackCity: string) {
  const normalized = address.replace(/\s+/g, " ").trim();
  const cityMatch = normalized.match(/,\s*([A-Za-z .'-]+?)(?:,\s*(?:WI|Wisconsin))?(?:,\s*United States)?\s*$/i);
  return cityMatch?.[1]?.trim() ? `${cityMatch[1].trim()}, WI` : fallbackCity;
}

function parseOfficialCommunityHelpCalendar(html: string, options: {
  sourceUrl: string;
  sourceName: "James Place Waukesha" | "Hope Center WI";
  fallbackCity: "Waukesha, WI";
}, referenceDate = new Date()): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const sourceHost = new URL(options.sourceUrl).hostname;
  const events: ScrapedEvent[] = [];

  $("article.tribe-events-calendar-list__event").each((_, card) => {
    const titleLink = $(card).find(".tribe-events-calendar-list__event-title-link[href]").first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    const href = titleLink.attr("href")?.trim();
    const dateNode = $(card).find("time.tribe-events-calendar-list__event-datetime").first();
    const rawDate = dateNode.attr("datetime") ?? "";
    const dateText = dateNode.text().replace(/\s+/g, " ").trim();
    const eventDate = parseCalendarTime(rawDate, dateText, referenceDate);
    if (!publicCommunityTitle(title) || !href || !eventDate) return;

    const sourceUrl = new URL(href, options.sourceUrl);
    if (sourceUrl.hostname !== sourceHost) return;

    const venueName = $(card).find(".tribe-events-calendar-list__event-venue-title").first().text().replace(/\s+/g, " ").trim() || null;
    const venueAddress = $(card).find(".tribe-events-calendar-list__event-venue-address").first().text().replace(/\s+/g, " ").trim() || null;
    const description = $(card).find(".tribe-events-calendar-list__event-description").first().text().replace(/\s+/g, " ").trim();
    const cost = $(card).find(".tribe-events-calendar-list__event-cost").first().text().replace(/\s+/g, " ").trim();

    events.push({
      title,
      description: description.slice(0, 1000) || null,
      eventDate,
      endDate: null,
      venueName,
      venueAddress,
      venueCity: venueAddress ? publicCalendarCityFromAddress(venueAddress, options.fallbackCity) : options.fallbackCity,
      category: "community",
      sourceUrl: sourceUrl.toString(),
      sourceName: options.sourceName,
      isFree: /\bfree\b|no charge|donation/i.test(cost),
      isOnCampus: false,
    });
  });

  return futureEvents(dedupeScrapedEvents(events), 90, referenceDate);
}

/** James Place's public calendar provides dated Waukesha activities and direct official handoffs. */
export function parseJamesPlaceWaukeshaEvents(html: string, referenceDate = new Date()) {
  return parseOfficialCommunityHelpCalendar(html, {
    sourceUrl: "https://jamesplacewi.org/events/",
    sourceName: "James Place Waukesha",
    fallbackCity: "Waukesha, WI",
  }, referenceDate);
}

export async function scrapeJamesPlaceWaukesha(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://jamesplacewi.org/events/");
  return html ? parseJamesPlaceWaukeshaEvents(html) : [];
}

/** Hope Center's public calendar is retained separately from its service directory card. */
export function parseHopeCenterWaukeshaEvents(html: string, referenceDate = new Date()) {
  return parseOfficialCommunityHelpCalendar(html, {
    sourceUrl: "https://hopecenterwi.org/events/",
    sourceName: "Hope Center WI",
    fallbackCity: "Waukesha, WI",
  }, referenceDate);
}

export async function scrapeHopeCenterWaukesha(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml("https://hopecenterwi.org/events/");
  return html ? parseHopeCenterWaukeshaEvents(html) : [];
}

// ─── Master scrape functions ──────────────────────────────────────────────────
async function runNamedSourceScrapers(sources: NamedSourceScraper[]) {
  const results = await Promise.allSettled(sources.map((source) => source.run()));
  const all: ScrapedEvent[] = [];
  const outcomes: ScrapeSourceOutcome[] = results.map((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      const eventsFound = result.value.length;
      console.log(`[communityScraper] ${source.sourceLabel}: ${eventsFound} events`);
      all.push(...result.value);
      return { sourceKey: source.sourceKey, sourceLabel: source.sourceLabel, city: source.city, status: eventsFound > 0 ? "healthy" : "empty", eventsFound };
    }
    const errorMessage = String(result.reason instanceof Error ? result.reason.message : result.reason).slice(0, 1000);
    console.warn(`[communityScraper] ${source.sourceLabel} failed: ${errorMessage}`);
    return { sourceKey: source.sourceKey, sourceLabel: source.sourceLabel, city: source.city, status: "failed", eventsFound: 0, errorMessage };
  });
  return { events: dedupeScrapedEvents(all), outcomes };
}

export async function scrapeAllMilwaukeeEventsWithHealth() {
  return runNamedSourceScrapers([
    { sourceKey: "milwaukee_library", sourceLabel: "Milwaukee Public Library", city: "Milwaukee", run: scrapeMilwaukeeLibrary },
    { sourceKey: "waukesha_library", sourceLabel: "Waukesha Public Library", city: "Waukesha", run: scrapeWaukeshaLibrary },
    { sourceKey: "waukesha_county_parks", sourceLabel: "Waukesha County Parks", city: "Waukesha County", run: scrapeWaukeshaCountyParks },
    { sourceKey: "brookfield_library", sourceLabel: "Brookfield Public Library", city: "Brookfield", run: scrapeBrookfieldLibrary },
    { sourceKey: "visit_waukesha", sourceLabel: "Visit Waukesha", city: "Waukesha–Pewaukee", run: scrapeVisitWaukesha },
    { sourceKey: "downtown_waukesha", sourceLabel: "Downtown Waukesha", city: "Waukesha", run: scrapeDowntownWaukesha },
    { sourceKey: "waukesha_chamber", sourceLabel: "Waukesha Area Chamber", city: "Waukesha area", run: scrapeWaukeshaChamber },
    { sourceKey: "uwm", sourceLabel: "UW–Milwaukee", city: "Milwaukee", run: scrapeUWMilwaukee },
    { sourceKey: "uwm_arts", sourceLabel: "UW–Milwaukee Peck School of the Arts", city: "Milwaukee", run: scrapeUWMArtsPerformingEvents },
    { sourceKey: "marquette", sourceLabel: "Marquette University", city: "Milwaukee", run: scrapeMarquette },
    { sourceKey: "eastbrook_church", sourceLabel: "Eastbrook Church", city: "Milwaukee", run: scrapeEastbrookChurch },
    { sourceKey: "corpus_christi_church", sourceLabel: "Corpus Christi Parish", city: "Waukesha", run: scrapeCorpusChristiWaukesha },
    { sourceKey: "james_place_waukesha", sourceLabel: "James Place Waukesha", city: "Waukesha", run: scrapeJamesPlaceWaukesha },
    { sourceKey: "hope_center_waukesha", sourceLabel: "Hope Center WI", city: "Waukesha", run: scrapeHopeCenterWaukesha },
    { sourceKey: "cudahy_lions", sourceLabel: "Cudahy Lions Club", city: "Cudahy", run: scrapeCudahyLionsClub },
    { sourceKey: "waukesha_lions", sourceLabel: "Waukesha Lions Club", city: "Waukesha", run: scrapeWaukeshaLionsClub },
    { sourceKey: "club_400", sourceLabel: "Club 400", city: "Waukesha", run: scrapeClub400Entertainment },
    { sourceKey: "milwaukee_comedy", sourceLabel: "Milwaukee Comedy", city: "Milwaukee", run: scrapeMilwaukeeComedy },
    { sourceKey: "laughing_tap", sourceLabel: "The Laughing Tap", city: "Milwaukee", run: scrapeLaughingTapComedy },
    { sourceKey: "milwaukee_improv", sourceLabel: "Milwaukee Improv", city: "Brookfield", run: scrapeMilwaukeeImprov },
    { sourceKey: "onmilwaukee", sourceLabel: "OnMilwaukee", city: "Milwaukee", run: scrapeOnMilwaukee },
  ]);
}

export async function scrapeAllMilwaukeeEvents(): Promise<ScrapedEvent[]> {
  return (await scrapeAllMilwaukeeEventsWithHealth()).events;
}

export async function scrapeAllMadisonEventsWithHealth() {
  return runNamedSourceScrapers([
    { sourceKey: "madison_library", sourceLabel: "Madison Public Library", city: "Madison", run: scrapeMadisonLibrary },
    { sourceKey: "city_madison", sourceLabel: "City of Madison", city: "Madison", run: scrapeCityOfMadisonEvents },
    { sourceKey: "overture", sourceLabel: "Overture Center", city: "Madison", run: scrapeOvertureCenter },
    { sourceKey: "city_church_madison", sourceLabel: "City Church Madison", city: "Madison", run: scrapeCityChurchMadison },
    { sourceKey: "uw_madison", sourceLabel: "UW–Madison", city: "Madison", run: scrapeUWMadisonEvents },
  ]);
}

export async function scrapeAllMadisonEvents(): Promise<ScrapedEvent[]> {
  return (await scrapeAllMadisonEventsWithHealth()).events;
}

export async function scrapeAllLaCrosseEventsWithHealth() {
  return runNamedSourceScrapers([
    { sourceKey: "la_crosse_library", sourceLabel: "La Crosse Public Library", city: "La Crosse", run: scrapeLaCrosseLibrary },
    { sourceKey: "la_crosse_parks", sourceLabel: "City of La Crosse Parks & Recreation", city: "La Crosse", run: scrapeLaCrosseParks },
  ]);
}

export async function scrapeAllLaCrosseEvents(): Promise<ScrapedEvent[]> {
  return (await scrapeAllLaCrosseEventsWithHealth()).events;
}
