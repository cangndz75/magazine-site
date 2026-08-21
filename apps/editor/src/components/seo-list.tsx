import Link from "next/link";
import type { SeoListDto } from "@/lib/seo/serialize";
import { formatRelativeDate } from "@/lib/content/format-date";
import { buildArticleHref } from "@/lib/content/content-href";
import { StatusBadge } from "./status-badge";
import {
  canonicalStatusLabel,
  heroStatusLabel,
  legalWithdrawalLabel,
  presentDiscoverReadiness,
  presentIndexability,
  publicationStatusLabel,
  seoHealthLabel,
} from "@/lib/seo/presentation";

export type SeoWorkspaceItem = SeoListDto;

type Props = {
  items: SeoWorkspaceItem[];
  isPending: boolean;
  returnTo: string;
};

export function SeoList({ items, isPending, returnTo }: Props) {
  return (
    <div
      className={`border-y border-zinc-200 bg-white ${isPending ? "opacity-60" : ""}`}
      role="region"
      aria-label="SEO içerik listesi"
    >
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5">Başlık</th>
              <th className="px-4 py-2.5">Yayın</th>
              <th className="px-4 py-2.5">SEO</th>
              <th className="px-4 py-2.5">Hata</th>
              <th className="px-4 py-2.5">Uyarı</th>
              <th className="px-4 py-2.5">İndeks</th>
              <th className="px-4 py-2.5">Discover</th>
              <th className="px-4 py-2.5">Canonical</th>
              <th className="px-4 py-2.5">HERO</th>
              <th className="px-4 py-2.5">Kategori</th>
              <th className="px-4 py-2.5">Güncelleme</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <SeoRow key={item.contentItemId} item={item} returnTo={returnTo} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-zinc-100 lg:hidden">
        {items.map((item) => (
          <SeoCard key={item.contentItemId} item={item} returnTo={returnTo} />
        ))}
      </ul>
    </div>
  );
}

function inspectorHref(item: SeoWorkspaceItem, returnTo: string): string {
  const params = new URLSearchParams();
  if (returnTo !== "/seo") {
    params.set("returnTo", returnTo);
  }
  const qs = params.toString();
  return qs ? `/seo/${item.contentItemId}?${qs}` : `/seo/${item.contentItemId}`;
}

function SeoRow({
  item,
  returnTo,
}: {
  item: SeoWorkspaceItem;
  returnTo: string;
}) {
  const health = seoHealthLabel(item);
  const indexability = presentIndexability({
    indexable: item.indexability.indexable,
    reason: item.indexability.reason,
    robots: { index: item.indexability.indexable, follow: item.indexability.indexable },
  });
  const hero = heroStatusLabel(item);
  const legal = legalWithdrawalLabel(item.legalWithdrawal?.kind);
  const href = inspectorHref(item, returnTo);
  const title = item.title || "Başlıksız";

  return (
    <tr className="relative border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={href}
            aria-label={`${title} SEO incelemesini aç`}
            className="font-medium text-zinc-900 underline-offset-2 after:absolute after:inset-0 hover:underline focus:outline-none focus-visible:relative focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {item.title || <span className="italic text-zinc-400">Başlıksız</span>}
          </Link>
          <p className="pointer-events-none mt-0.5 break-all text-xs text-zinc-500">
            {item.slug}
          </p>
        </div>
      </td>
      <td className="pointer-events-none px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <StatusBadge
            label={publicationStatusLabel(item.publicationStatus)}
            variant={item.publicationStatus === "PUBLISHED" ? "success" : "neutral"}
          />
          {legal && <StatusBadge label={legal} variant="warning" />}
        </div>
      </td>
      <td className="pointer-events-none px-4 py-3">
        <StatusBadge
          label={`${health.label} · ${item.score}`}
          variant={
            health.tone === "good"
              ? "success"
              : health.tone === "warning"
                ? "warning"
                : "neutral"
          }
        />
      </td>
      <td className="pointer-events-none px-4 py-3 tabular-nums">{item.errorCount}</td>
      <td className="pointer-events-none px-4 py-3 tabular-nums">{item.warningCount}</td>
      <td className="pointer-events-none px-4 py-3">
        <StatusBadge
          label={indexability.label}
          variant={item.indexability.indexable ? "success" : "neutral"}
        />
      </td>
      <td className="pointer-events-none px-4 py-3">
        <StatusBadge
          label={presentDiscoverReadiness(item.discoverReadiness).label}
          variant={
            item.discoverReadiness === "READY"
              ? "success"
              : item.discoverReadiness === "NEEDS_ATTENTION"
                ? "warning"
                : "neutral"
          }
        />
      </td>
      <td className="pointer-events-none px-4 py-3 text-xs text-zinc-600">
        {canonicalStatusLabel(item.findingCodes)}
      </td>
      <td className="pointer-events-none px-4 py-3">
        <StatusBadge
          label={hero.label}
          variant={hero.tone === "good" ? "success" : "warning"}
        />
      </td>
      <td className="pointer-events-none px-4 py-3 text-xs text-zinc-600">
        {item.primaryCategory?.name ?? "—"}
      </td>
      <td className="pointer-events-none px-4 py-3 text-xs text-zinc-500">
        {formatRelativeDate(item.lastModified)}
      </td>
    </tr>
  );
}

function SeoCard({
  item,
  returnTo,
}: {
  item: SeoWorkspaceItem;
  returnTo: string;
}) {
  const health = seoHealthLabel(item);
  const indexability = presentIndexability({
    indexable: item.indexability.indexable,
    reason: item.indexability.reason,
    robots: { index: item.indexability.indexable, follow: item.indexability.indexable },
  });
  const hero = heroStatusLabel(item);
  const legal = legalWithdrawalLabel(item.legalWithdrawal?.kind);
  const editorHref = buildArticleHref({
    contentItemId: item.contentItemId,
    returnTo,
  });

  return (
    <li className="px-4 py-3">
      <Link
        href={inspectorHref(item, returnTo)}
        className="block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        <p className="font-medium text-zinc-900">{item.title || "Başlıksız"}</p>
        <p className="mt-0.5 break-all text-xs text-zinc-500">{item.slug}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <StatusBadge label={health.label} variant={health.tone === "good" ? "success" : "warning"} />
          <StatusBadge
            label={publicationStatusLabel(item.publicationStatus)}
            variant={item.publicationStatus === "PUBLISHED" ? "success" : "neutral"}
          />
          <StatusBadge
            label={indexability.label}
            variant={item.indexability.indexable ? "success" : "neutral"}
          />
          <StatusBadge
            label={presentDiscoverReadiness(item.discoverReadiness).label}
            variant={
              item.discoverReadiness === "READY"
                ? "success"
                : item.discoverReadiness === "NEEDS_ATTENTION"
                  ? "warning"
                  : "neutral"
            }
          />
          <StatusBadge label={hero.label} variant={hero.tone === "good" ? "success" : "warning"} />
          {legal && <StatusBadge label={legal} variant="warning" />}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Skor {item.score} · Hata {item.errorCount} · Uyarı {item.warningCount} ·{" "}
          {item.primaryCategory?.name ?? "Kategori yok"} · {formatRelativeDate(item.lastModified)}
        </p>
      </Link>
      <Link
        href={editorHref}
        className="mt-2 inline-block text-xs text-zinc-600 underline hover:text-zinc-800"
      >
        Makale editörünü aç
      </Link>
    </li>
  );
}
