export const OUTREACH_TEMPLATES = [
  {
    id: "community-venue",
    label: "Community venue introduction",
    subject: "A community discovery partnership idea for {venueName}",
    body: `Hello {venueName} team,

I’m reaching out from Just Putzit, a free community platform that helps local people discover current public events and activities in {city}.

We would like to learn whether {venueName} would be open to sharing public programs, classes, or social activities with our members. We can link people to your official event and booking pages, while keeping member identities private.

Would you be open to a short conversation about how we could help more local people find and attend your public offerings?

Thank you,
Just Putzit Community Partnerships`,
  },
  {
    id: "fitness-partner",
    label: "Gym or fitness partner introduction",
    subject: "A local fitness discovery idea for {venueName}",
    body: `Hello {venueName} team,

I’m reaching out from Just Putzit, a free local community platform for real-world activities and safe social connections in {city}.

We are building a fitness discovery experience that can direct interested local members to official public classes, introductory sessions, and booking pages at participating gyms and recreation providers. We would like to understand which programs at {venueName} are open to the community and how you prefer people to book.

Would you be open to a brief conversation about listing your public fitness opportunities?

Thank you,
Just Putzit Community Partnerships`,
  },
  {
    id: "college-arts",
    label: "College performing arts calendar request",
    subject: "Request to share public performing-arts events from {venueName}",
    body: `Hello {venueName} performing arts team,

I’m reaching out from Just Putzit, a free local platform that helps people discover current public events and activities in {city}.

We would like to direct community members to your official public performances, including music, theater, and other arts events, using the dates, ticket links, and event details you approve. We do not share member identities with partners.

Could you point us to the best official calendar, feed, or contact for public performing-arts events at {venueName}?

Thank you,
Just Putzit Community Partnerships`,
  },
] as const;

export function hydrateOutreachTemplate(templateId: string, venue: { name: string; city: string | null }) {
  const template = OUTREACH_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) return null;
  const hydrate = (text: string) => text.replaceAll("{venueName}", venue.name).replaceAll("{city}", venue.city || "your community");
  return { subject: hydrate(template.subject), body: hydrate(template.body) };
}
