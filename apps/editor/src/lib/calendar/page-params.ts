import { CONTENT_KINDS, isUuid, type ContentKind } from "@magazine/domain";
import { editorialWallTimeToUtcIso } from "@/lib/content/editorial-timezone";

export type CalendarPageFilters = {
  month: string;
  start: Date;
  end: Date;
  categoryId: string | undefined;
  authorId: string | undefined;
  contentKind: ContentKind | undefined;
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function parseCalendarPageSearchParams(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): CalendarPageFilters {
  const monthRaw = typeof params.month === "string" ? params.month : undefined;
  const month = validMonth(monthRaw) ?? formatMonthKey(now);
  const [year, monthNumber] = month.split("-").map(Number);
  const start = editorialBoundaryToUtcDate(year!, monthNumber! - 1);
  const end = editorialBoundaryToUtcDate(year!, monthNumber!);

  const categoryRaw =
    typeof params.categoryId === "string" ? params.categoryId : undefined;
  const authorRaw =
    typeof params.authorId === "string" ? params.authorId : undefined;
  const kindRaw =
    typeof params.contentKind === "string" ? params.contentKind : undefined;
  const contentKind = (CONTENT_KINDS as readonly string[]).includes(kindRaw ?? "")
    ? (kindRaw as ContentKind)
    : undefined;

  return {
    month,
    start,
    end,
    categoryId: categoryRaw && isUuid(categoryRaw) ? categoryRaw : undefined,
    authorId: authorRaw && isUuid(authorRaw) ? authorRaw : undefined,
    contentKind,
  };
}

export function calendarMonthDelta(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return formatMonthKey(new Date(Date.UTC(year!, monthNumber! - 1 + delta, 1)));
}

export function formatMonthKey(input: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(input);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    return `${input.getUTCFullYear()}-${String(input.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${year}-${month}`;
}

function editorialBoundaryToUtcDate(year: number, zeroBasedMonth: number): Date {
  const boundary = new Date(Date.UTC(year, zeroBasedMonth, 1));
  const date = `${boundary.getUTCFullYear()}-${String(boundary.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const iso = editorialWallTimeToUtcIso(date, "00:00");
  if (!iso) {
    return new Date(Date.UTC(year, zeroBasedMonth, 1));
  }
  return new Date(iso);
}

function validMonth(raw: string | undefined): string | null {
  if (!raw || !MONTH_PATTERN.test(raw)) {
    return null;
  }

  const [year, month] = raw.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return raw;
}
