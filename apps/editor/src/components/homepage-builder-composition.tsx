"use client";

import type { HomepageSlotKey } from "@magazine/domain";
import type { HomepageBuilderView, HomepageStorySummary, HomepageVideoSummary } from "@/lib/homepage/builder-types";
import {
  HOMEPAGE_FEATURED_KEYS,
  HOMEPAGE_SLOT_LABEL,
  HOMEPAGE_SLOT_SHORT_LABEL,
} from "@/lib/homepage/slot-meta";
import { StatusBadge } from "@/components/status-badge";
import { deriveContentStatus } from "@/lib/content/status";
import { HomepageBuilderHeroThumbnail } from "@/components/homepage-builder-hero-thumbnail";

import {
  formatVideoDuration,
  videoPosterFallbackLabel,
  videoProviderLabel,
} from "@/lib/video/presentation";

type Props = {
  builder: HomepageBuilderView;
  selectedSlotKey: HomepageSlotKey | null;
  pendingSlotKey: HomepageSlotKey | null;
  videoPickerOpen: boolean;
  videoPending: boolean;
  onSelectSlot: (slotKey: HomepageSlotKey) => void;
  onClearSlot: (slotKey: HomepageSlotKey) => void;
  onMoveFeatured: (slotKey: HomepageSlotKey, direction: "left" | "right") => void;
  onSelectVideo: () => void;
  onClearVideo: () => void;
  disabled?: boolean;
};

export function HomepageBuilderComposition({
  builder,
  selectedSlotKey,
  pendingSlotKey,
  videoPickerOpen,
  videoPending,
  onSelectSlot,
  onClearSlot,
  onMoveFeatured,
  onSelectVideo,
  onClearVideo,
  disabled = false,
}: Props) {
  const draftMap = new Map(
    builder.draft.slots.map((slot) => [slot.slotKey, slot.contentItemId]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <LeadSlotCard
          slotKey="LEAD"
          contentItemId={draftMap.get("LEAD") ?? null}
          story={
            draftMap.get("LEAD")
              ? builder.stories[draftMap.get("LEAD")!]
              : undefined
          }
          selected={selectedSlotKey === "LEAD"}
          pending={pendingSlotKey === "LEAD"}
          disabled={disabled}
          onSelect={() => onSelectSlot("LEAD")}
          onClear={() => onClearSlot("LEAD")}
        />
        <div className="grid gap-3">
          {(["SUPPORT_1", "SUPPORT_2"] as const).map((slotKey) => (
            <SupportSlotCard
              key={slotKey}
              slotKey={slotKey}
              contentItemId={draftMap.get(slotKey) ?? null}
              story={
                draftMap.get(slotKey)
                  ? builder.stories[draftMap.get(slotKey)!]
                  : undefined
              }
              selected={selectedSlotKey === slotKey}
              pending={pendingSlotKey === slotKey}
              disabled={disabled}
              onSelect={() => onSelectSlot(slotKey)}
              onClear={() => onClearSlot(slotKey)}
            />
          ))}
        </div>
      </div>

      <section aria-label="Video">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Video
          </h2>
          <span className="text-xs text-zinc-400">Tek editorial video</span>
        </div>
        <VideoSlotCard
          videoAssetId={builder.draft.videoAssetId}
          video={
            builder.draft.videoAssetId
              ? builder.videos[builder.draft.videoAssetId]
              : undefined
          }
          selected={videoPickerOpen}
          pending={videoPending}
          disabled={disabled}
          onSelect={onSelectVideo}
          onClear={onClearVideo}
        />
      </section>

      <section aria-label="Öne Çıkanlar">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Öne Çıkanlar
          </h2>
          <span className="text-xs text-zinc-400">Sıra 1–5</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {HOMEPAGE_FEATURED_KEYS.map((slotKey, index) => (
            <FeaturedSlotCard
              key={slotKey}
              slotKey={slotKey}
              rank={index + 1}
              contentItemId={draftMap.get(slotKey) ?? null}
              story={
                draftMap.get(slotKey)
                  ? builder.stories[draftMap.get(slotKey)!]
                  : undefined
              }
              selected={selectedSlotKey === slotKey}
              pending={pendingSlotKey === slotKey}
              disabled={disabled}
              canMoveLeft={index > 0}
              canMoveRight={index < HOMEPAGE_FEATURED_KEYS.length - 1}
              onSelect={() => onSelectSlot(slotKey)}
              onClear={() => onClearSlot(slotKey)}
              onMoveLeft={() => onMoveFeatured(slotKey, "left")}
              onMoveRight={() => onMoveFeatured(slotKey, "right")}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function VideoSlotCard({
  videoAssetId,
  video,
  selected,
  pending,
  disabled,
  onSelect,
  onClear,
}: {
  videoAssetId: string | null;
  video?: HomepageVideoSummary;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  const hasContent = Boolean(videoAssetId && video);

  return (
    <SlotShell
      label="Video"
      selected={selected}
      pending={pending}
      disabled={disabled}
      onSelect={onSelect}
      onClear={onClear}
      hasContent={hasContent}
      emptyLabel="Video seç"
    >
      {video && (
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-16 w-28 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-500"
            aria-hidden={video.posterPreviewUrl ? undefined : true}
          >
            {video.posterPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.posterPreviewUrl}
                alt=""
                className="h-full w-full rounded object-cover"
              />
            ) : (
              videoPosterFallbackLabel({
                provider: video.provider,
                posterSource: video.posterSource,
              })
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug text-zinc-900">{video.title}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {videoProviderLabel(video.provider)}
              {video.durationSeconds
                ? ` · ${formatVideoDuration(video.durationSeconds)}`
                : " · Süre yok"}
            </p>
            <p className="mt-1 text-[10px] text-zinc-400">{video.providerVideoId}</p>
          </div>
        </div>
      )}
    </SlotShell>
  );
}

function StoryMeta({ story }: { story: HomepageStorySummary }) {
  const status = deriveContentStatus({
    publicationStatus: story.publicationStatus,
    workflowStatus: story.workflowStatus,
    publishedVersionId: story.isPublishEligible ? story.id : null,
    draftVersionId: null,
    scheduledVersionId: null,
    scheduledAt: null,
    displayVersionId: story.id,
  });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {story.primaryCategory && (
        <span className="text-xs text-zinc-500">{story.primaryCategory.name}</span>
      )}
      <StatusBadge
        label={status.publicationLabel}
        variant={status.publicationVariant}
      />
      {!story.isPublishEligible && (
        <span className="text-xs text-amber-700">Henüz yayında değil</span>
      )}
    </div>
  );
}

function SlotShell({
  label,
  selected,
  pending,
  disabled,
  onSelect,
  onClear,
  children,
  emptyLabel,
  hasContent,
  size = "default",
}: {
  label: string;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClear: () => void;
  children?: React.ReactNode;
  emptyLabel: string;
  hasContent: boolean;
  size?: "lead" | "default";
}) {
  return (
    <div
      className={`group flex flex-col rounded-lg border bg-white transition-colors ${
        selected
          ? "border-zinc-900 ring-1 ring-zinc-900"
          : "border-zinc-200 hover:border-zinc-300"
      } ${pending ? "opacity-60" : ""} ${
        size === "lead" ? "min-h-[220px]" : "min-h-[120px]"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </span>
          {hasContent && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Atandı
            </span>
          )}
        </div>
        {hasContent && (
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className={`shrink-0 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
              selected
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
            }`}
            aria-label={`${label} slotunu boşalt`}
          >
            Boşalt
          </button>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="flex min-h-0 flex-1 flex-col p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500"
        aria-pressed={selected}
        aria-label={`${label} slotunu seç`}
      >
        {hasContent ? (
          children
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <p className="text-sm font-medium text-zinc-700">{emptyLabel}</p>
            <p className="mt-1 text-xs text-zinc-400">İçerik havuzundan seç</p>
          </div>
        )}
      </button>
    </div>
  );
}

function LeadSlotCard({
  slotKey,
  contentItemId,
  story,
  selected,
  pending,
  disabled,
  onSelect,
  onClear,
}: {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
  story?: HomepageStorySummary;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <SlotShell
      label={HOMEPAGE_SLOT_LABEL[slotKey]}
      selected={selected}
      pending={pending}
      disabled={disabled}
      onSelect={onSelect}
      onClear={onClear}
      hasContent={Boolean(contentItemId && story)}
      emptyLabel="Lead haberi seç"
      size="lead"
    >
      {story && (
        <div>
          <HomepageBuilderHeroThumbnail
            hero={story.heroThumbnail}
            size="lead"
            loading="eager"
          />
          <p className="text-lg font-semibold leading-snug text-zinc-900">
            {story.title}
          </p>
          <StoryMeta story={story} />
        </div>
      )}
    </SlotShell>
  );
}

function SupportSlotCard({
  slotKey,
  contentItemId,
  story,
  selected,
  pending,
  disabled,
  onSelect,
  onClear,
}: {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
  story?: HomepageStorySummary;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <SlotShell
      label={HOMEPAGE_SLOT_LABEL[slotKey]}
      selected={selected}
      pending={pending}
      disabled={disabled}
      onSelect={onSelect}
      onClear={onClear}
      hasContent={Boolean(contentItemId && story)}
      emptyLabel="Destek haberi seç"
    >
      {story && (
        <div className="flex min-w-0 gap-3">
          <HomepageBuilderHeroThumbnail
            hero={story.heroThumbnail}
            size="support"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug text-zinc-900">{story.title}</p>
            <StoryMeta story={story} />
          </div>
        </div>
      )}
    </SlotShell>
  );
}

function FeaturedSlotCard({
  slotKey,
  rank,
  contentItemId,
  story,
  selected,
  pending,
  disabled,
  canMoveLeft,
  canMoveRight,
  onSelect,
  onClear,
  onMoveLeft,
  onMoveRight,
}: {
  slotKey: HomepageSlotKey;
  rank: number;
  contentItemId: string | null;
  story?: HomepageStorySummary;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSelect: () => void;
  onClear: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <SlotShell
        label={`${HOMEPAGE_SLOT_SHORT_LABEL[slotKey]}`}
        selected={selected}
        pending={pending}
        disabled={disabled}
        onSelect={onSelect}
        onClear={onClear}
        hasContent={Boolean(contentItemId && story)}
        emptyLabel={`Öne çıkan ${rank}`}
      >
        {story && (
          <div>
            <HomepageBuilderHeroThumbnail
              hero={story.heroThumbnail}
              size="featured"
            />
            <p className="text-sm font-medium leading-snug text-zinc-900 line-clamp-3">
              {story.title}
            </p>
            <StoryMeta story={story} />
          </div>
        )}
      </SlotShell>
      <div className="flex justify-center gap-1">
        <button
          type="button"
          disabled={disabled || !canMoveLeft}
          onClick={onMoveLeft}
          className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
          aria-label={`${HOMEPAGE_SLOT_LABEL[slotKey]} sola taşı`}
        >
          ←
        </button>
        <button
          type="button"
          disabled={disabled || !canMoveRight}
          onClick={onMoveRight}
          className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
          aria-label={`${HOMEPAGE_SLOT_LABEL[slotKey]} sağa taşı`}
        >
          →
        </button>
      </div>
    </div>
  );
}
