const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.error("RESEND_API_KEY is not configured.");
  process.exit(1);
}

const response = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${apiKey}` },
});

if (!response.ok) {
  console.error(`Resend domain lookup failed with HTTP ${response.status}.`);
  process.exit(1);
}

const body = await response.json();
const domain = (body.data ?? []).find((entry) => entry.name === "justputzit.com");

if (!domain) {
  console.log("Resend does not yet list justputzit.com as a configured domain.");
  process.exit(0);
}

console.log(JSON.stringify({
  name: domain.name,
  status: domain.status,
  createdAt: domain.created_at ?? null,
}, null, 2));
