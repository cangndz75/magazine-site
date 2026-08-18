/**
 * Editorial wall-clock timezone for scheduling UI.
 * The backend stores absolute UTC instants (`scheduledAt`).
 * No application env timezone exists; the product UI is Turkish, so
 * Europe/Istanbul is the canonical editorial zone and is labeled in the UI.
 * Do not silently treat browser-local time as the scheduled instant.
 */
export const EDITORIAL_TIMEZONE = "Europe/Istanbul";
export const EDITORIAL_TIMEZONE_LABEL = "Türkiye saati (Europe/Istanbul)";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function istanbulOffsetMs(instant: Date): number | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDITORIAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const asWallUtc = Date.UTC(
    Number(readPart(parts, "year")),
    Number(readPart(parts, "month")) - 1,
    Number(readPart(parts, "day")),
    Number(readPart(parts, "hour")),
    Number(readPart(parts, "minute")),
    Number(readPart(parts, "second")),
  );
  if (Number.isNaN(asWallUtc)) {
    return null;
  }

  return asWallUtc - instant.getTime();
}

export function editorialWallTimeToUtcIso(
  date: string,
  time: string,
): string | null {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    hour > 23 ||
    minute > 59 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  if (Number.isNaN(wallAsUtcMs)) {
    return null;
  }

  const guess = new Date(wallAsUtcMs);
  const offsetMs = istanbulOffsetMs(guess);
  if (offsetMs === null) {
    return null;
  }

  const instant = new Date(wallAsUtcMs - offsetMs);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const roundTrip = utcIsoToEditorialInputs(instant.toISOString());
  if (!roundTrip || roundTrip.date !== date || roundTrip.time !== time) {
    return null;
  }

  return instant.toISOString();
}

export function utcIsoToEditorialInputs(
  iso: string,
): { date: string; time: string } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EDITORIAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const date = `${readPart(parts, "year")}-${readPart(parts, "month")}-${readPart(parts, "day")}`;
  const time = `${readPart(parts, "hour")}:${readPart(parts, "minute")}`;
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return null;
  }

  return { date, time };
}

export function formatEditorialDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }

  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return "—";
  }

  const formatted = new Intl.DateTimeFormat("tr-TR", {
    timeZone: EDITORIAL_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);

  return `${formatted} ${EDITORIAL_TIMEZONE_LABEL}`;
}

export function isUtcIsoInTheFuture(iso: string, now = new Date()): boolean {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return false;
  }
  return instant.getTime() > now.getTime();
}
