/**
 * SEO routes: /sitemap.xml and /robots.txt
 * Registered before the tRPC middleware so they're served as plain text/XML.
 */
import type { Express } from "express";

const BASE_URL = "https://justputzit.com";

// All city slugs we have dedicated landing pages for
const CITY_SLUGS = [
  "jackson-ms",
  "madison-wi",
  "milwaukee-wi",
  "chicago-il",
  "atlanta-ga",
];

// Static public pages
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/safety", priority: "0.6", changefreq: "monthly" },
  { path: "/campus", priority: "0.7", changefreq: "weekly" },
  { path: "/campus/carroll", priority: "0.7", changefreq: "weekly" },
  { path: "/activity-board", priority: "0.8", changefreq: "daily" },
  { path: "/community", priority: "0.7", changefreq: "weekly" },
  { path: "/events", priority: "0.8", changefreq: "daily" },
];

function buildSitemap(): string {
  const now = new Date().toISOString().split("T")[0];

  const staticEntries = STATIC_PAGES.map(
    ({ path, priority, changefreq }) => `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  ).join("");

  const cityEntries = CITY_SLUGS.map(
    slug => `
  <url>
    <loc>${BASE_URL}/city/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${cityEntries}
</urlset>`;
}

export function registerSEORoutes(app: Express) {
  // ── Sitemap ───────────────────────────────────────────────────────────────
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h cache
    res.send(buildSitemap());
  });

  // ── Robots.txt ────────────────────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`User-agent: *
Allow: /
Allow: /city/
Allow: /events
Allow: /activity-board
Allow: /community
Allow: /safety
Allow: /campus

# Block private/auth pages from indexing
Disallow: /api/
Disallow: /onboarding
Disallow: /interview
Disallow: /profile
Disallow: /matches
Disallow: /chat/
Disallow: /games/
Disallow: /admin
Disallow: /verify-account
Disallow: /concierge
Disallow: /marketplace
Disallow: /bookings
Disallow: /vendor
Disallow: /couples

Sitemap: ${BASE_URL}/sitemap.xml
`);
  });
}
