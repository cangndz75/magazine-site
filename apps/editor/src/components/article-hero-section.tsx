"use client";

import { useId, useState } from "react";
import {
  ARTICLE_HERO_ALT_TEXT_MAX,
  MEDIA_RIGHTS_STATUS,
  MEDIA_RIGHTS_TEXT_MAX,
  MEDIA_TYPE,
  type MediaPublicIneligibilityReason,
  type MediaRightsStatus,
} from "@magazine/domain";
import {
  formatDimensions,
  INELIGIBILITY_REASON_LABELS,
} from "@/lib/media/presentation";
import { ArticleHeroPicker } from "./article-hero-picker";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";
import type { ArticleEditorMedia } from "@/lib/content/article-relation-state";

type ArticleHeroSectionProps = {
  hero: ArticleEditorMedia | null;
  disabled: boolean;
  busy: boolean;
  onSelect: (next: ArticleEditorMedia) => void;
  onRemove: () => void;
  onPresentationChange: (patch: { altText: string | null; credit: string | null }) => void;
};

function publicCredit(hero: ArticleEditorMedia): string {
  const override = hero.credit?.trim();
  if (override) {
    return override;
  }
  return hero.creditLine?.trim() || "Kredi yok";
}

export function ArticleHeroSection({
  hero,
  disabled,
  busy,
  onSelect,
  onRemove,
  onPresentationChange,
}: ArticleHeroSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const altId = useId();
  const creditId = useId();
  const warningId = useId();

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-zinc-700">Kapak görseli</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Yalnızca açık taslağı değiştirir. Yayındaki kapak, haber yayımlanana kadar
          aynı kalır.
        </p>
      </div>

      {hero ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="aspect-[3/2] w-full max-w-xs overflow-hidden rounded bg-zinc-100 sm:w-56">
            {hero.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.previewUrl}
                alt={hero.altText?.trim() || ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <p className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-500">
                Önizleme yok
              </p>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-sm font-medium text-zinc-950">{hero.label}</p>
            <p className="text-xs text-zinc-500">
              {formatDimensions(hero.width, hero.height) ?? "Boyut yok"}
            </p>
            {hero.eligibility ? (
              <>
                <MediaRightsStatusBadge
                  status={
                    (hero.eligibility.status as MediaRightsStatus) ??
                    MEDIA_RIGHTS_STATUS.INCOMPLETE
                  }
                  eligible={hero.eligibility.eligible}
                />
                {!hero.eligibility.eligible ? (
                  <div
                    id={warningId}
                    className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950"
                    role="status"
                  >
                    <p>
                      Hak uyarısı — bilgilendirme içindir; yayını bu aşamada
                      engellemez.
                    </p>
                    {hero.eligibility.reasons.length > 0 ? (
                      <ul className="mt-1 list-disc pl-4">
                        {hero.eligibility.reasons.map((reason) => (
                          <li key={reason}>
                            {INELIGIBILITY_REASON_LABELS[
                              reason as MediaPublicIneligibilityReason
                            ] ?? reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            <p className="text-xs text-zinc-600">
              Yayında görünecek kredi: {publicCredit(hero)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => setPickerOpen(true)}
                className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Değiştir
              </button>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={onRemove}
                className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Kaldır
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-28 flex-col items-start justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5">
          <p className="text-sm text-zinc-600">Kapak görseli seçilmedi.</p>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPickerOpen(true)}
            className="mt-3 h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            Medya kütüphanesinden seç
          </button>
        </div>
      )}

      {hero ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={altId} className="block text-sm font-medium text-zinc-700">
              Bu habere özel alt metin
            </label>
            <textarea
              id={altId}
              rows={3}
              maxLength={ARTICLE_HERO_ALT_TEXT_MAX}
              disabled={disabled}
              value={hero.altText ?? ""}
              onChange={(event) =>
                onPresentationChange({
                  altText: event.target.value,
                  credit: hero.credit,
                })
              }
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor={creditId}
              className="block text-sm font-medium text-zinc-700"
            >
              Habere özel kredi
            </label>
            <input
              id={creditId}
              maxLength={MEDIA_RIGHTS_TEXT_MAX.CREDIT}
              disabled={disabled}
              value={hero.credit ?? ""}
              onChange={(event) =>
                onPresentationChange({
                  altText: hero.altText,
                  credit: event.target.value,
                })
              }
              className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Boşsa yayında medya kredi satırı kullanılır.
            </p>
          </div>
        </div>
      ) : null}

      {busy ? (
        <p className="text-xs text-zinc-500" role="status">
          Kapak görseli kaydediliyor…
        </p>
      ) : null}

      {pickerOpen ? (
        <ArticleHeroPicker
          open={pickerOpen}
          initialHero={hero}
          disabled={busy}
          onClose={() => setPickerOpen(false)}
          onConfirm={({ media, altText, credit }) => {
            if (media.mediaType !== MEDIA_TYPE.IMAGE) {
              return;
            }
            onSelect({
              id: media.id,
              label: media.label,
              mediaType: media.mediaType,
              width: media.width,
              height: media.height,
              role: "HERO",
              sortOrder: 0,
              caption: hero?.id === media.id ? hero.caption : null,
              altText: altText.trim() || null,
              credit: credit.trim() || null,
              previewUrl: media.previewUrl,
              creatorName: media.creatorName,
              creditLine: media.creditLine,
              eligibility: media.eligibility,
            });
            setPickerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
