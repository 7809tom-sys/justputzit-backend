export type ProfileCompletenessInput = {
  bio?: string | null;
  aiSummary?: string | null;
  city?: string | null;
  interviewCount?: number | null;
};

export type ProfileCompletenessItem = {
  id: "about" | "location" | "sally";
  label: string;
  description: string;
  actionLabel: string;
  complete: boolean;
};

export function getProfileCompleteness(input: ProfileCompletenessInput) {
  const hasAbout = (input.bio?.trim().length ?? 0) >= 20 || (input.aiSummary?.trim().length ?? 0) >= 60;
  const hasLocation = (input.city?.trim().length ?? 0) >= 2;
  const hasSallyContext = (input.interviewCount ?? 0) > 0;
  const items: ProfileCompletenessItem[] = [
    { id: "about", label: "A little about you", description: "Add a bio or let Sally summarize what matters to you.", actionLabel: "Add a bio", complete: hasAbout },
    { id: "location", label: "Your local area", description: "Choose a city to personalize nearby events and activities.", actionLabel: "Set location", complete: hasLocation },
    { id: "sally", label: "A Sally conversation", description: "A short chat helps Sally learn your interests for better introductions.", actionLabel: "Chat with Sally", complete: hasSallyContext },
  ];
  const completed = items.filter((item) => item.complete).length;
  return { items, completed, total: items.length, score: Math.round((completed / items.length) * 100) };
}
