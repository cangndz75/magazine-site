"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { formatDateTime } from "@/lib/content/format-date";
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
  const [selectedItem, setSelectedItem] = useState<EditorialCalendarItemDto | null>(
    null,
  );
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
  const todayKey = formatDateKey(new Date());

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
  const hasScheduledItems = items.length > 0;

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedItem(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItem]);

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-magenta">
            Yayın planlama
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[1.75rem]">
            Yayın Takvimi
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">
            Planlanan haber ve foto galeri yayınlarını tek görünümden izleyin.
          </p>
        </div>

        <div className="grid shrink-0 gap-2 text-sm sm:grid-cols-3">
          <SummaryPill label="Zamanlanmış" value={summary.scheduled} />
          <SummaryPill label="Bugün" value={summary.today} highlight />
          <SummaryPill label="Bu hafta" value={summary.thisWeek} />
        </div>
      </div>

      <div
        className="rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40"
        aria-busy={isPending}
      >
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link
              className="inline-flex h-8 items-center rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
              href={todayHref}
            >
              Bugün
            </Link>
            <div className="flex items-center gap-0.5">
              <Link
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-base font-semibold text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
                href={previousHref}
                aria-label="Önceki ay"
              >
                ‹
              </Link>
              <Link
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-base font-semibold text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
                href={nextHref}
                aria-label="Sonraki ay"
              >
                ›
              </Link>
            </div>
            <p className="min-w-0 truncate px-1 text-sm font-semibold capitalize text-zinc-950 sm:text-base">
              {monthLabel}
            </p>
            <span className="rounded bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
              Ay
            </span>
          </div>

          <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,9rem)_auto]">
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
              className="h-9 min-w-0 rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700"
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
                className="h-9 rounded px-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              >
                Temizle
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {!hasScheduledItems ? (
        <div className="mt-4 rounded border border-zinc-200 bg-white px-4 py-8 text-center shadow-sm shadow-zinc-200/40">
          <p className="text-sm font-medium text-zinc-900">
            Bu dönemde planlanmış yayın bulunmuyor.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Farklı bir ay seçin veya filtreleri temizleyin.
          </p>
        </div>
      ) : (
        <>
          <section
            className="mt-4 hidden min-w-0 overflow-hidden rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40 sm:block"
          >
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="px-2.5 py-2">
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <DayCell
                  key={day.key}
                  day={day}
                  todayKey={todayKey}
                  onSelectItem={setSelectedItem}
                />
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
                  <div className="mt-2.5 space-y-1.5">
                    {day.items.map((item) => (
                      <CalendarEventCard
                        key={item.contentItemId}
                        item={item}
                        onSelect={() => setSelectedItem(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        </>
      )}

      {selectedItem ? (
        <CalendarItemPopover
          item={selectedItem}
          returnTo={returnTo}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </div>
  );
}

function DayCell({
  day,
  todayKey,
  onSelectItem,
}: {
  day: CalendarDay;
  todayKey: string;
  onSelectItem: (item: EditorialCalendarItemDto) => void;
}) {
  const visible = day.items.slice(0, VISIBLE_ITEMS_PER_DAY);
  const hiddenCount = day.items.length - visible.length;
  const isToday = day.key === todayKey && day.inMonth;

  return (
    <div
      className={`min-h-32 border-b border-r border-zinc-100 p-1.5 ${
        day.inMonth ? "bg-white" : "bg-zinc-50/60 text-zinc-400"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold ${
            isToday
              ? "bg-brand-magenta text-white"
              : day.inMonth
                ? "text-zinc-800"
                : "text-zinc-400"
          }`}
        >
          {day.date.getUTCDate()}
        </span>
        {day.items.length > 0 ? (
          <span className="text-[10px] font-medium tabular-nums text-zinc-500">
            {day.items.length}
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        {visible.map((item) => (
          <CalendarEventCard
            key={item.contentItemId}
            item={item}
            onSelect={() => onSelectItem(item)}
          />
        ))}
        {hiddenCount > 0 ? (
          <span className="block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
            +{hiddenCount} içerik
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CalendarEventCard({
  item,
  onSelect,
}: {
  item: EditorialCalendarItemDto;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="block w-full rounded border border-zinc-200/90 bg-zinc-50/50 px-1.5 py-1 text-left hover:border-zinc-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
    >
      <span className="flex items-center gap-1 text-[10px] font-semibold tabular-nums text-zinc-500">
        <span>{formatTime(item.scheduledAt)}</span>
        <span className="text-zinc-300">·</span>
        <span className="truncate text-zinc-600">
          {contentKindLabel(item.contentKind)}
        </span>
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[11px] font-semibold leading-4 text-zinc-950">
        {item.title}
      </span>
      <span className="mt-0.5 block">
        <StatusBadge
          label={editorialStateLabel(item)}
          variant={editorialStateVariant(item)}
        />
      </span>
    </button>
  );
}

function CalendarItemPopover({
  item,
  returnTo,
  onClose,
}: {
  item: EditorialCalendarItemDto;
  returnTo: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const editorHref = buildArticleHref({
    contentItemId: item.contentItemId,
    versionId: item.scheduledVersionId,
    returnTo,
  });
  const authorLabel =
    item.authors.length > 0
      ? item.authors.map((author) => author.displayName).join(", ")
      : "Yazar atanmadı";

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/20"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-item-popover-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-t-xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/10 sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-magenta">
              {contentKindLabel(item.contentKind)}
            </p>
            <h2
              id="calendar-item-popover-title"
              className="mt-1 text-base font-semibold leading-snug text-zinc-950"
            >
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            Kapat
          </button>
        </div>
        <dl className="space-y-2 px-4 py-3 text-sm">
          <DetailRow label="Zaman" value={formatDateTime(item.scheduledAt)} />
          <DetailRow
            label="Kategori"
            value={item.primaryCategory?.name ?? "Kategori yok"}
          />
          <DetailRow label="Yazar" value={authorLabel} />
          <DetailRow label="Durum" value={editorialStateLabel(item)} />
        </dl>
        <div className="border-t border-zinc-100 px-4 py-3">
          <Link
            href={editorHref}
            className="inline-flex h-9 items-center rounded bg-brand-magenta px-3 text-sm font-medium text-white hover:bg-brand-magenta-hover"
          >
            İçeriği Aç
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded border border-zinc-200 bg-white px-3 py-2 shadow-sm shadow-zinc-200/30">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          highlight ? "text-brand-magenta" : "text-zinc-950"
        }`}
      >
        {value}
      </p>
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

function editorialStateLabel(item: EditorialCalendarItemDto): string {
  const workflow = workflowStatusLabel(item.workflowStatus);
  if (item.publicationStatus === "PUBLISHED") {
    return `${workflow} · Yayında`;
  }
  if (item.publicationStatus === "UNPUBLISHED") {
    return `${workflow} · Yayından kalktı`;
  }
  return workflow;
}

function editorialStateVariant(
  item: EditorialCalendarItemDto,
): "neutral" | "success" | "warning" | "info" | "danger" {
  if (item.workflowStatus === "APPROVED") {
    return "success";
  }
  if (item.workflowStatus === "IN_REVIEW") {
    return "warning";
  }
  return "neutral";
}
