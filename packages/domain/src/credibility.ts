export const CREDIBILITY = {
  CLAIM: "CLAIM",
  CONFIRMED: "CONFIRMED",
  DENIED: "DENIED",
} as const;

export type Credibility = (typeof CREDIBILITY)[keyof typeof CREDIBILITY];

export const CREDIBILITY_VALUES = [
  CREDIBILITY.CLAIM,
  CREDIBILITY.CONFIRMED,
  CREDIBILITY.DENIED,
] as const;
