"use client";

import Link from "next/link";
import type { HomepageSlotKey } from "@magazine/domain";
import { StatusBadge } from "@/components/status-badge";
import { buildArticleHref } from "@/lib/content/content-href";
import { formatEditorialDateTime } from "@/lib/content/editorial-timezone";
import { deriveContentStatus } from "@/lib/content/status";
import type { HomepageBuilderView } from "@/lib/homepage/builder-types";
import { HOMEPAGE_SLOT_LABEL } from "@/lib/homepage/slot-meta";
import { HomepageBuilderHeroThumbnail } from "@/components/homepage-builder-hero-thumbnail";

type Props = {
  builder: HomepageBuilderView;
  selectedSlotKey: HomepageSlotKey | null;
  onAssignToSlot: () => void;
  onClearSlot: (slotKey: HomepageSlotKey) => void;
  disabled?: boolean;
};

export function HomepageBuilderInspector({
  builder,
  selectedSlotKey,
  onAssignToSlot,
  onClearSlot,
  disabled = false,
}: Props) {
  if (!selectedSlotKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
        <p className="text-sm font-medium text-zinc-700">Slot seçin</p>
        <p className="mt-1 text-xs text-zinc-500">
          Düzenlemek için bir homepage pozisyonu veya içerik havuzundan haber
          seçin.
        </p>
      </div>
    );
  }

  const slot = builder.draft.slots.find((entry) => entry.slotKey === selectedSlotKey);
  const contentItemId = slot?.contentItemId ?? null;
  const story = contentItemId ? builder.stories[contentItemId] : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Slot detayı
        </h2>
        <p className="mt-1 text-sm font-medium text-zinc-900">
          {HOMEPAGE_SLOT_LABEL[selectedSlotKey]}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!contentItemId || !story ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Bu slot boş.</p>
            <p className="text-xs text-zinc-500">
              İçerik havuzundan bir haber seçip bu slota atayın. Boş slotlar
              yayın sonrası güvenli geri dönüşle doldurulabilir.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={onAssignToSlot}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            >
              İçerik seç
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <HomepageBuilderHeroThumbnail
              hero={story.heroThumbnail}
              size="featured"
            />
            <div>
              <p className="text-base font-semibold leading-snug text-zinc-900">
                {story.title}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{story.slug}</p>
            </div>

            {story.primaryCategory && (
              <p className="text-sm text-zinc-600">{story.primaryCategory.name}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={
                  deriveContentStatus({
                    publicationStatus: story.publicationStatus,
                    workflowStatus: story.workflowStatus,
                    publishedVersionId: story.isPublishEligible ? story.id : null,
                    draftVersionId: null,
                    scheduledVersionId: null,
                    scheduledAt: null,
                    displayVersionId: story.id,
                  }).publicationLabel
                }
                variant={
                  deriveContentStatus({
                    publicationStatus: story.publicationStatus,
                    workflowStatus: story.workflowStatus,
                    publishedVersionId: story.isPublishEligible ? story.id : null,
                    draftVersionId: null,
                    scheduledVersionId: null,
                    scheduledAt: null,
                    displayVersionId: story.id,
                  }).publicationVariant
                }
              />
            </div>

            {story.publishedAt && (
              <p className="text-xs text-zinc-500">
                Yayın: {formatEditorialDateTime(story.publishedAt)}
              </p>
            )}

            {!story.isPublishEligible && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Bu içerik henüz yayında değil. Ana sayfa taslağında kalabilir
                ancak ana sayfa yayınlanamaz.
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={buildArticleHref({ contentItemId: story.id, returnTo: "/homepage" })}
                className="text-sm text-zinc-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                Makaleyi aç
              </Link>
              <button
                type="button"
                disabled={disabled}
                onClick={onAssignToSlot}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
              >
                Değiştir
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onClearSlot(selectedSlotKey)}
                className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Slotu boşalt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
