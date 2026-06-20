export type MaterialSafetyStatus = "ok" | "review" | "blocked";

export interface MaterialSafetyResult {
  status: MaterialSafetyStatus;
  triggers: string[];
}

const BLOCKED_TERMS = [
  "porn",
  "nsfw",
  "nude",
  "sex",
  "escort",
  "threesome",
  "bdsm",
  "fetish",
  "rape",
  "fuck",
  "shit",
];

const REVIEW_TERMS = [
  "vaccine",
  "clinical trial",
  "off-label",
  "adverse event",
  "contraindication",
  "dosage",
  "oncology",
  "drug",
  "therapy",
  "prescription",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(text: string, terms: string[]): string[] {
  const lowered = text.toLowerCase();
  // Match whole words only so "grapefruit" doesn't trigger "rape",
  // "Essex" doesn't trigger "sex", etc. (the Scunthorpe problem).
  return terms.filter((term) => {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, "i");
    return pattern.test(lowered);
  });
}

export function evaluateMaterialSafety(textToScan: string): MaterialSafetyResult {
  const text = (textToScan || "").trim();
  if (!text) {
    return { status: "ok", triggers: [] };
  }

  const blockedHits = findMatches(text, BLOCKED_TERMS);
  if (blockedHits.length > 0) {
    return { status: "blocked", triggers: blockedHits };
  }

  const reviewHits = findMatches(text, REVIEW_TERMS);
  if (reviewHits.length > 0) {
    return { status: "review", triggers: reviewHits };
  }

  return { status: "ok", triggers: [] };
}
