export type ProfileSummaryEvidence = {
  facts: string[];
  terms: string[];
};

const INTERNAL_TRAIT_KEYS = new Set([
  "aiSummary",
  "connectionPreferences",
  "competitiveStyle",
]);

const GENERIC_PHRASES = [
  "vibrant connections",
  "infectious energy",
  "passion for life",
  "absolute joy",
  "incredible friend",
  "everyone, meet",
  "whipping up a fantastic",
  "always up for an adventure",
];

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

function addFact(facts: string[], value: unknown) {
  if (typeof value !== "string") return;
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length >= 3 && !facts.some((fact) => normalize(fact) === normalize(clean))) {
    facts.push(clean);
  }
}

/**
 * Builds the factual material Sally may use. It deliberately excludes internal
 * metadata and treats member interview answers as the strongest evidence.
 */
export function buildProfileSummaryEvidence(
  traits: Record<string, unknown> | null | undefined,
  interviewResponses: string[] = [],
): ProfileSummaryEvidence {
  const facts: string[] = [];

  for (const response of interviewResponses) addFact(facts, response);

  for (const [key, value] of Object.entries(traits ?? {})) {
    if (INTERNAL_TRAIT_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) addFact(facts, item);
    } else {
      addFact(facts, value);
    }
  }

  const terms = Array.from(new Set(
    facts
      .flatMap((fact) => normalize(fact).split(" "))
      .filter((term) => term.length >= 4)
      .filter((term) => !new Set(["that", "this", "with", "from", "they", "their", "about", "would", "could", "have", "just", "like", "really", "want", "looking", "people"]).has(term)),
  ));

  return { facts: facts.slice(0, 16), terms: terms.slice(0, 80) };
}

/**
 * Rejects canned or weakly supported copy before it replaces a member’s prior
 * summary. The check is intentionally conservative: when evidence is sparse,
 * the generator is allowed to write a short, factual line rather than invent.
 */
export function isEvidenceGroundedProfileSummary(
  summary: string | null | undefined,
  evidence: ProfileSummaryEvidence,
): boolean {
  const clean = summary?.trim() ?? "";
  if (clean.length < 45 || clean.length > 520) return false;

  const normalized = normalize(clean);
  if (GENERIC_PHRASES.some((phrase) => normalized.includes(phrase))) return false;

  const sentenceCount = clean.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0).length;
  if (sentenceCount < 1 || sentenceCount > 3) return false;

  if (evidence.terms.length === 0) return false;
  const supportedTerms = evidence.terms.filter((term) => normalized.includes(term));
  const requiredTerms = evidence.terms.length >= 2 ? 2 : 1;
  return new Set(supportedTerms).size >= requiredTerms;
}
