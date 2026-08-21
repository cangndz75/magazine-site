import {
  ANALYTICS_REPORTING_TIMEZONE,
  ANALYTICS_TIME_BUCKET,
  type AnalyticsTimeBucket,
} from "./aggregation-policy";

const HOUR_MS = 60 * 60 * 1000;

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const named = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(named.year),
    month: Number(named.month),
    day: Number(named.day),
    hour: Number(named.hour),
    minute: Number(named.minute),
    second: Number(named.second),
  };
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

/**
 * Convert a civil datetime in an IANA zone to a UTC instant.
 * Uses Intl timezone data (including DST), never a hardcoded offset.
 */
export function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const instant = utcGuess - tzOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - tzOffsetMs(new Date(instant), timeZone));
}

function addCalendarDay(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function utcHourBucketStart(occurredAt: Date): Date {
  return new Date(
    Date.UTC(
      occurredAt.getUTCFullYear(),
      occurredAt.getUTCMonth(),
      occurredAt.getUTCDate(),
      occurredAt.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

/** UTC calendar day. Not the product reporting day. */
export function utcDayBucketStart(occurredAt: Date): Date {
  return new Date(
    Date.UTC(
      occurredAt.getUTCFullYear(),
      occurredAt.getUTCMonth(),
      occurredAt.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function reportingDayBucketStart(
  occurredAt: Date,
  timeZone: string = ANALYTICS_REPORTING_TIMEZONE,
): Date {
  const parts = zonedParts(occurredAt, timeZone);
  return zonedLocalToUtc(timeZone, parts.year, parts.month, parts.day, 0, 0, 0);
}

export function nextReportingDayBucketStart(
  bucketStart: Date,
  timeZone: string = ANALYTICS_REPORTING_TIMEZONE,
): Date {
  const parts = zonedParts(bucketStart, timeZone);
  const next = addCalendarDay(parts.year, parts.month, parts.day, 1);
  return zonedLocalToUtc(timeZone, next.year, next.month, next.day, 0, 0, 0);
}

export function reportingCalendarDate(
  occurredAt: Date,
  timeZone: string = ANALYTICS_REPORTING_TIMEZONE,
): string {
  const parts = zonedParts(occurredAt, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function reportingDateToUtcRange(
  year: number,
  month: number,
  day: number,
  timeZone: string = ANALYTICS_REPORTING_TIMEZONE,
): { fromInclusive: Date; toExclusive: Date } {
  const fromInclusive = zonedLocalToUtc(timeZone, year, month, day, 0, 0, 0);
  const next = addCalendarDay(year, month, day, 1);
  const toExclusive = zonedLocalToUtc(timeZone, next.year, next.month, next.day, 0, 0, 0);
  return { fromInclusive, toExclusive };
}

export function utcBucketStart(
  occurredAt: Date,
  granularity: AnalyticsTimeBucket,
): Date {
  return granularity === ANALYTICS_TIME_BUCKET.HOUR
    ? utcHourBucketStart(occurredAt)
    : reportingDayBucketStart(occurredAt);
}

export function nextUtcBucketStart(
  bucketStart: Date,
  granularity: AnalyticsTimeBucket,
): Date {
  if (granularity === ANALYTICS_TIME_BUCKET.HOUR) {
    return new Date(bucketStart.getTime() + HOUR_MS);
  }
  return nextReportingDayBucketStart(bucketStart);
}

export function enumerateUtcBuckets(input: {
  fromInclusive: Date;
  toExclusive: Date;
  granularity: AnalyticsTimeBucket;
}): Date[] {
  const starts: Date[] = [];
  let cursor = utcBucketStart(input.fromInclusive, input.granularity);
  if (cursor.getTime() < input.fromInclusive.getTime()) {
    cursor = nextUtcBucketStart(cursor, input.granularity);
  }
  while (cursor.getTime() < input.toExclusive.getTime()) {
    starts.push(cursor);
    cursor = nextUtcBucketStart(cursor, input.granularity);
  }
  return starts;
}

export function bucketKey(bucketStart: Date): string {
  return bucketStart.toISOString();
}
