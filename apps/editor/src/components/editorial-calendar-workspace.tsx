"use client";

import Link from "next/link";
import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ContentKind } from "@magazine/domain";
import type { CalendarPageFilters } from "@/lib/calendar/page-params";
import {
  calendarMonthDelta,
  formatMonthKey,
} from "@/lib/calendar/page-params";
import {
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import { buildArticleHref, buildListReturnTo } from "@/lib/content/content-href";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
} from "@/lib/content/lookup-labels";
import { AuthorFilterPicker, CategoryFilterPicker } from "./filter-pickers";
import { StatusBadge } from "./status-badge";

export type EditorialCalendarItemDto = {
  contentItemId: string;
  slug: string;
  contentKind: "ARTICLE" | "GALLERY";
  publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
  workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
  scheduledVersionId: string;
  scheduledAt: string;
  scheduleGeneration: number;
  title: string;
  primaryCategory: { id: string; name: string; slug: string } | null;
  authors: { id: string; displayName: string; slug: string }[];
};

type Props = {
  items: EditorialCalendarItemDto[];
  summary: { scheduled: number; today: number; thisWeek: number };
  filters: CalendarPageFilters;
  categoryOptions: CategoryLookupOption[];
  authorOptions: AuthorLookupOption[];
  selectedCategory: CategoryLookupOption | null;
  selectedAuthor: AuthorLookupOption | null;
};

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
const VISIBLE_ITEMS_PER_DAY = 3;

export function EditorialCalendarWorkspace({
  items,
  summary,
  filters,
  categoryOptions,
  authorOptions,
  selectedCategory,
  selectedAuthor,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const returnTo = buildListReturnTo(searchParams.toString(), "/calendar");
  const [displayYear, displayMonth] = filters.month.split("-").map(Number);
  const displayMonthStart = new Date(
    Date.UTC(displayYear!, displayMonth! - 1, 1),
  );
  const displayMonthEnd = new Date(Date.UTC(displayYear!, displayMonth!, 1));
  const monthLabel = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(displayMonthStart);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/calendar", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("month", filters.month);
      router.push(hrefWithQuery("/calendar", params));
    });
  }, [filters.month, router, startTransition]);

  const hasFilters = Boolean(
    filters.categoryId || filters.authorId || filters.contentKind,
  );
  const todayHref = hrefWithQuery(
    "/calendar",
    applyFilterUpdates(searchParams, { month: formatMonthKey(new Date()) }),
  );
  const previousHref = hrefWithQuery(
    "/calendar",
    applyFilterUpdates(searchParams, {
      month: calendarMonthDelta(filters.month, -1),
    }),
  );
  const nextHref = hrefWithQuery(
    "/calendar",
    applyFilterUpdates(searchParams, {
      month: calendarMonthDelta(filters.month, 1),
    }),
  );
  const days = buildCalendarDays(displayMonthStart, displayMonthEnd, items);

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Yayın
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Yayın Takvimi
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Planlanan yayınları ve editoryal takvimi tek görünümden yönetin.
          </p>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <SummaryPill label="Zamanlanmış" value={summary.scheduled} />
          <SummaryPill label="Bugün" value={summary.today} />
          <SummaryPill label="Bu hafta" value={summary.thisWeek} />
        </div>
      </div>

      <div className="rounded border border-zinc-200 bg-white p-3 shadow-sm shadow-zinc-200/40">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex h-9 items-center rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              href={todayHref}
            >
              Bugün
            </Link>
            <Link
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 text-lg font-semibold text-zinc-800 hover:bg-zinc-50"
              href={previousHref}
              aria-label="Önceki ay"
            >
              ‹
            </Link>
            <Link
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 text-lg font-semibold text-zinc-800 hover:bg-zinc-50"
              href={nextHref}
              aria-label="Sonraki ay"
            >
              ›
            </Link>
            <p className="min-w-44 text-base font-semibold capitalize text-zinc-950">
              {monthLabel}
            </p>
            <span className="rounded bg-zinc-950 px-2.5 py-1 text-xs font-medium text-white">
              Ay
            </span>
          </div>

          <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_150px_auto]">
            <CategoryFilterPicker
              selected={selectedCategory}
              initialOptions={categoryOptions}
              onSelect={(id) => updateParams({ categoryId: id })}
            />
            <AuthorFilterPicker
              selected={selectedAuthor}
              initialOptions={authorOptions}
              onSelect={(id) => updateParams({ authorId: id })}
            />
            <select
              value={filters.contentKind ?? ""}
              onChange={(event) =>
                updateParams({
                  contentKind: event.target.value || null,
                })
              }
              className="h-10 rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              disabled={isPending}
              aria-label="İçerik türü"
            >
              <option value="">Haber / Foto Galeri</option>
              <option value="ARTICLE">Haber</option>
              <option value="GALLERY">Foto Galeri</option>
            </select>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="h-10 rounded px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              >
                Temizle
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className="mt-4 hidden min-w-0 overflow-hidden rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40 sm:block">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-3 py-2">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <DayCell key={day.key} day={day} returnTo={returnTo} />
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 sm:hidden">
        {days
          .filter((day) => day.inMonth && day.items.length > 0)
          .map((day) => (
            <div
              key={day.key}
              className="rounded border border-zinc-200 bg-white p-3 shadow-sm shadow-zinc-200/40"
            >
              <p className="text-sm font-semibold text-zinc-950">
                {formatDayLabel(day.date)}
              </p>
              <div className="mt-3 space-y-2">
                {day.items.map((item) => (
                  <CalendarItemLink
                    key={item.contentItemId}
                    item={item}
                    returnTo={returnTo}
                  />
                ))}
              </div>
            </div>
          ))}
        {items.length === 0 ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Bu ay için planlanmış içerik bulunmuyor.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DayCell({
  day,
  returnTo,
}: {
  day: CalendarDay;
  returnTo: string;
}) {
  const visible = day.items.slice(0, VISIBLE_ITEMS_PER_DAY);
  const hiddenCount = day.items.length - visible.length;

  return (
    <div
      className={`min-h-36 border-b border-r border-zinc-200 p-2 ${
        day.inMonth ? "bg-white" : "bg-zinc-50 text-zinc-400"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{day.date.getUTCDate()}</span>
        {day.items.length > 0 ? (
          <span className="text-[11px] font-medium text-zinc-500">
            {day.items.length}
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {visible.map((item) => (
          <CalendarItemLink
            key={item.contentItemId}
            item={item}
            returnTo={returnTo}
          />
        ))}
        {hiddenCount > 0 ? (
          <span className="block rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
            +{hiddenCount} içerik
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CalendarItemLink({
  item,
  returnTo,
}: {
  item: EditorialCalendarItemDto;
  returnTo: string;
}) {
  return (
    <Link
      href={buildArticleHref({
        contentItemId: item.contentItemId,
        versionId: item.scheduledVersionId,
        returnTo,
      })}
      className="block rounded border border-zinc-200 bg-white px-2 py-1.5 text-left hover:border-zinc-400 hover:bg-zinc-50"
    >
      <span className="block text-[11px] font-semibold text-zinc-500">
        {formatTime(item.scheduledAt)} · {contentKindLabel(item.contentKind)}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-xs font-semibold leading-4 text-zinc-950">
        {item.title}
      </span>
      <span className="mt-1 flex flex-wrap gap-1">
        <StatusBadge
          label={workflowStatusLabel(item.workflowStatus)}
          variant={item.workflowStatus === "APPROVED" ? "success" : "neutral"}
        />
        <StatusBadge
          label={publicationStatusLabel(item.publicationStatus)}
          variant={item.publicationStatus === "PUBLISHED" ? "info" : "neutral"}
        />
      </span>
    </Link>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

type CalendarDay = {
  key: string;
  date: Date;
  inMonth: boolean;
  items: EditorialCalendarItemDto[];
};

function buildCalendarDays(
  start: Date,
  end: Date,
  items: EditorialCalendarItemDto[],
): CalendarDay[] {
  const monthStartWeekday = (start.getUTCDay() + 6) % 7;
  const gridStart = addUtcDays(start, -monthStartWeekday);
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86400000);
  const totalDays = Math.ceil((monthStartWeekday + daysInMonth) / 7) * 7;
  const byDay = new Map<string, EditorialCalendarItemDto[]>();

  for (const item of items) {
    const key = formatEditorialDateKey(new Date(item.scheduledAt));
    const dayItems = byDay.get(key) ?? [];
    dayItems.push(item);
    byDay.set(key, dayItems);
  }

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addUtcDays(gridStart, index);
    const key = formatDateKey(date);
    return {
      key,
      date,
      inMonth: date >= start && date < end,
      items: byDay.get(key) ?? [],
    };
  });
}

function addUtcDays(input: Date, days: number): Date {
  return new Date(input.getTime() + days * 86400000);
}

function formatDateKey(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function formatEditorialDateKey(input: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

function formatDayLabel(input: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: "UTC",
  }).format(input);
}

function contentKindLabel(kind: ContentKind): string {
  return kind === "GALLERY" ? "Foto Galeri" : "Haber";
}

function workflowStatusLabel(status: string): string {
  if (status === "APPROVED") {
    return "Onaylı";
  }
  if (status === "IN_REVIEW") {
    return "İncelemede";
  }
  return "Taslak";
}

function publicationStatusLabel(status: string): string {
  if (status === "PUBLISHED") {
    return "Yayında";
  }
  if (status === "UNPUBLISHED") {
    return "Yayından kalktı";
  }
  return "İlk yayın";
}
