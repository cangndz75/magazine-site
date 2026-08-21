import Link from "next/link";
import { buildArticleHref } from "@/lib/content/content-href";
import type { SeoInspectorDto } from "@/lib/seo/serialize";
import {
  legalWithdrawalLabel,
  presentCanonicalRejection,
  presentDiscoverFinding,
  presentDiscoverReadiness,
  presentIndexability,
  presentSeoFinding,
  publicationStatusLabel,
  seoHealthLabel,
  seoKindLabel,
  seoSeverityLabel,
} from "@/lib/seo/presentation";
import { StatusBadge } from "./status-badge";
import { SeoSlugHistory } from "./seo-slug-history";
import { SeoPreviewPanels } from "./seo-preview-panels";

export function SeoInspector({
  detail,
  returnHref,
}: {
  detail: SeoInspectorDto;
  returnHref: string;
}) {
  const health = seoHealthLabel(detail);
  const indexability = presentIndexability({
    indexable: detail.indexability.indexable,
    reason: detail.indexability.reason,
    robots: {
      index: detail.indexability.indexable,
      follow: detail.indexability.indexable,
    },
  });
  const legal = legalWithdrawalLabel(detail.legalWithdrawal?.kind);
  const editorHref = buildArticleHref({
    contentItemId: detail.contentItemId,
    returnTo: returnHref,
  });
  const errors = detail.findings.filter((finding) => finding.severity === "ERROR");
  const warnings = detail.findings.filter((finding) => finding.severity === "WARNING");
  const infos = detail.findings.filter((finding) => finding.severity === "INFO");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm text-zinc-500">
        <Link href={returnHref} className="underline hover:text-zinc-700">
          ← SEO
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            {detail.articleTitle || "Başlıksız"}
          </h1>
          <p className="mt-1 break-all text-sm text-zinc-500">{detail.slug}</p>
        </div>
        <Link
          href={editorHref}
          className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium leading-9 text-white hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          Makale editörünü aç
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        <StatusBadge
          label={`${health.label} · ${detail.score}`}
          variant={health.tone === "good" ? "success" : "warning"}
        />
        <StatusBadge
          label={publicationStatusLabel(detail.publicationStatus)}
          variant={detail.publicationStatus === "PUBLISHED" ? "success" : "neutral"}
        />
        <StatusBadge
          label={indexability.label}
          variant={detail.indexability.indexable ? "success" : "neutral"}
        />
        {legal && <StatusBadge label={legal} variant="warning" />}
      </div>

      {!detail.inspectedVersionIsPublicAuthority && (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Bu inceleme taslak veya yayında olmayan sürüme bakıyor. Kamuya açık metadata
          yalnızca yayınlanmış yetkili sürümden gelir.
        </p>
      )}

      <section className="mt-8" aria-labelledby="seo-health-heading">
        <h2 id="seo-health-heading" className="text-sm font-semibold text-zinc-900">
          SEO sağlığı
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Skor {detail.score}. Kritik bulgular yayın/teknik sorunlardır; uyarılar
          editoryal öneridir.
        </p>
        <FindingGroup title="Kritik" findings={errors} />
        <FindingGroup title="Uyarı" findings={warnings} />
        <FindingGroup title="Bilgi" findings={infos} />
        {detail.findings.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">Aktif SEO bulgusu yok.</p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="seo-index-heading">
        <h2 id="seo-index-heading" className="text-sm font-semibold text-zinc-900">
          İndekslenebilirlik
        </h2>
        <p className="mt-2 text-sm text-zinc-800">{indexability.label}</p>
        <p className="mt-1 text-sm text-zinc-600">{indexability.detail}</p>
        {!indexability.canEditorOverride && (
          <p className="mt-2 text-sm text-zinc-600">
            Bu noindex sistem veya hukuki politikadan gelir. Editör indeksi açamaz.
          </p>
        )}
        {legal && (
          <p className="mt-2 text-sm text-zinc-600">
            Hukuki geri çekme veya kaldırmada SEO alanları kamuyu değiştirmez.
          </p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="seo-discover-heading">
        <h2 id="seo-discover-heading" className="text-sm font-semibold text-zinc-900">
          Discover Hazırlığı
        </h2>
        <p className="mt-2 text-sm font-medium text-zinc-900">
          {presentDiscoverReadiness(detail.discover.state).label}
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {presentDiscoverReadiness(detail.discover.state).detail}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          max-image-preview:large{" "}
          {detail.discover.largeImagePreviewAvailable ? "yayımlanır" : "yayımlanmaz"}.
          Yayımcı {detail.discover.publisherConfigured ? "yapılandırılmış" : "yapılandırılmamış"}.
        </p>
        <ul className="mt-3 space-y-2">
          {detail.discover.findings.map((finding) => {
            const presented = presentDiscoverFinding(finding);
            return (
              <li key={finding.code} className="text-sm text-zinc-700">
                <span className="font-medium">{presented.classification}:</span>{" "}
                {presented.title}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="seo-meta-heading">
        <h2 id="seo-meta-heading" className="text-sm font-semibold text-zinc-900">
          Metadata
        </h2>
        <dl className="mt-3 grid gap-3 text-sm">
          <MetaRow label="Görünen başlık (H1)" value={detail.articleTitle || "—"} />
          <MetaRow label="Kamuya açık başlık" value={detail.publicTitle || "—"} />
          <MetaRow
            label="Kamuya açık açıklama"
            value={detail.publicDescription ?? "Yok (gövdeden üretilmez)"}
          />
          <MetaRow
            label="Canonical URL"
            value={detail.canonical.resolvedUrl ?? "Üretilemedi"}
            wrap
          />
          <MetaRow
            label="Canonical kaynağı"
            value={
              detail.canonical.appliedOverride
                ? "Açık override"
                : detail.canonical.rejection
                  ? `Override geçersiz: ${presentCanonicalRejection(detail.canonical.rejection)}`
                  : "Varsayılan (site adresi + slug)"
            }
          />
          <MetaRow
            label="Robots"
            value={
              detail.robots.editorRestrictionActive
                ? "Noindex (editör kısıtı)"
                : detail.robots.systemForcedNoindex
                  ? "Noindex (sistem)"
                  : "Varsayılan"
            }
          />
        </dl>
      </section>

      <SeoPreviewPanels
        title={detail.publicTitle}
        visibleTitle={detail.articleTitle}
        description={detail.publicDescription}
        url={detail.canonical.resolvedUrl}
        imageUrl={detail.hero.publicUrl}
      />

      <section className="mt-8" aria-labelledby="seo-jsonld-heading">
        <h2 id="seo-jsonld-heading" className="text-sm font-semibold text-zinc-900">
          Yapılandırılmış veri
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          NewsArticle {detail.structuredData.wouldEmit ? "yayına çıkar" : "baskılanmış"}.
          {detail.structuredData.complete
            ? " Zorunlu alanlar tamam."
            : " Zorunlu veya önerilen alanlar eksik."}
        </p>
        {detail.structuredData.missingRequiredFields.length > 0 && (
          <p className="mt-2 text-sm text-zinc-600">
            Eksik zorunlu alanlar: {detail.structuredData.missingRequiredFields.join(", ")}
          </p>
        )}
        {detail.structuredData.missingRecommendedFields.length > 0 && (
          <p className="mt-1 text-sm text-zinc-600">
            Eksik önerilen alanlar: {detail.structuredData.missingRecommendedFields.join(", ")}
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Ham JSON-LD bu yüzeyde gösterilmez.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="seo-hero-heading">
        <h2 id="seo-hero-heading" className="text-sm font-semibold text-zinc-900">
          Görsel SEO
        </h2>
        {detail.hero.assigned ? (
          <dl className="mt-3 grid gap-3 text-sm">
            <MetaRow label="Alt metin" value={detail.hero.altText?.trim() || "Eksik"} />
            <MetaRow
              label="Boyutlar"
              value={
                detail.hero.width && detail.hero.height
                  ? `${detail.hero.width}×${detail.hero.height}`
                  : "Bilinmiyor"
              }
            />
            <MetaRow
              label="Türev"
              value={
                detail.hero.preferredRenditionAvailable
                  ? "Tercih edilen türev var"
                  : detail.hero.usedLegacyOriginalFallback
                    ? "Eski görsele düşüyor"
                    : "Türev yok"
              }
            />
            {detail.hero.rightsInformational && (
              <MetaRow
                label="Haklar"
                value="Bilgi amaçlı hak uyarısı var. İç hak notu gösterilmez."
              />
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">HERO görseli atanmamış.</p>
        )}
      </section>

      <SeoSlugHistory entries={detail.slugHistory} />
    </div>
  );
}

function FindingGroup({
  title,
  findings,
}: {
  title: string;
  findings: SeoInspectorDto["findings"];
}) {
  if (findings.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</h3>
      <ul className="mt-2 space-y-3">
        {findings.map((finding) => {
          const copy = presentSeoFinding(finding);
          return (
            <li
              key={finding.code}
              className="rounded border border-zinc-200 bg-white px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge
                  label={seoSeverityLabel(finding.severity)}
                  variant={finding.severity === "ERROR" ? "warning" : "neutral"}
                />
                <StatusBadge label={seoKindLabel(finding.kind)} variant="info" />
              </div>
              <p className="mt-2 font-medium text-zinc-900">{copy.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{copy.why}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {copy.actionable ? `Nereden düzeltirim: ${copy.where}` : copy.where}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MetaRow({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-1 text-zinc-800 ${wrap ? "break-all" : ""}`}>{value}</dd>
    </div>
  );
}
