import {
  aggregateAnalyticsWindow,
  aggregateRecentAnalyticsWindow,
} from "../src/analytics/aggregate";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseBoundary(raw: string): Date {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${raw}`);
  }
  return parsed;
}

const fromRaw = argValue("--from");
const toRaw = argValue("--to");

const result =
  fromRaw && toRaw
    ? await aggregateAnalyticsWindow({
        from: parseBoundary(fromRaw),
        to: parseBoundary(toRaw),
      })
    : await aggregateRecentAnalyticsWindow();

if (!result.ok) {
  console.error(result.code);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      fromInclusive: result.fromInclusive.toISOString(),
      toExclusive: result.toExclusive.toISOString(),
      quality: result.quality,
    },
    null,
    2,
  ),
);
