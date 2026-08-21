import type {
  ContentVersionDiffScalarSnapshot,
  ContentVersionFieldDiff,
} from "./diff-types";

const SCALAR_FIELDS = [
  "title",
  "subtitle",
  "excerpt",
  "seoTitle",
  "seoDescription",
  "canonicalUrl",
  "robots",
  "credibility",
  "credibilitySource",
  "source",
  "sourceOrganization",
  "sourceUrl",
  "syndicated",
  "isMaterialUpdate",
] as const;

type ScalarField = (typeof SCALAR_FIELDS)[number];

function changeType(
  before: string | boolean | null,
  after: string | boolean | null,
): ContentVersionFieldDiff["changeType"] | null {
  if (Object.is(before, after)) {
    return null;
  }

  if (before === null || before === undefined) {
    return "ADDED";
  }

  if (after === null || after === undefined) {
    return "REMOVED";
  }

  return "MODIFIED";
}

export function diffScalarFields(
  from: ContentVersionDiffScalarSnapshot,
  to: ContentVersionDiffScalarSnapshot,
): ContentVersionFieldDiff[] {
  const fields: ContentVersionFieldDiff[] = [];
  for (const field of SCALAR_FIELDS) {
    const before = from[field as ScalarField];
    const after = to[field as ScalarField];
    const type = changeType(before, after);
    if (!type) {
      continue;
    }
    fields.push({ field, changeType: type, before, after });
  }
  return fields;
}
