import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  SITE_HEALTH_STATUS,
  assertSafeSiteHealthDto,
  type SiteHealthDto,
} from "@magazine/domain";

function source(): string {
  return readFileSync(new URL("./site-health.ts", import.meta.url), "utf8");
}

function sampleSiteHealth(): SiteHealthDto {
  return {
    generatedAt: "2026-08-22T09:00:00.000Z",
    overall: {
      status: SITE_HEALTH_STATUS.UNAVAILABLE,
      label: "Kullanılamıyor",
      summary: "En az bir operasyonel sinyal okunamadı.",
    },
    database: {
      status: SITE_HEALTH_STATUS.HEALTHY,
      availability: "AVAILABLE",
      label: "Veritabanı",
      summary: "Sınırlı sağlık okuması veritabanından başarıyla döndü.",
      updatedAt: "2026-08-22T09:00:00.000Z",
      metrics: { available: true, queryTimestamp: "2026-08-22T09:00:00.000Z" },
      actionTarget: null,
    },
    outbox: {
      status: SITE_HEALTH_STATUS.ATTENTION,
      availability: "AVAILABLE",
      label: "Outbox",
      summary: "Terminal DEAD outbox kayıtları var.",
      updatedAt: null,
      metrics: { pending: 0, processing: 0, dead: 1 },
      actionTarget: null,
    },
    scheduledPublishing: {
      status: SITE_HEALTH_STATUS.HEALTHY,
      availability: "AVAILABLE",
      label: "Zamanlanmış yayın",
      summary: "Zamanlanmış yayın göstergeleri okunabiliyor.",
      updatedAt: null,
      metrics: { scheduledCount: 0, overdueCount: 0, nextScheduledAt: null },
      actionTarget: "/calendar",
    },
    analytics: {
      status: SITE_HEALTH_STATUS.UNAVAILABLE,
      availability: "UNAVAILABLE",
      label: "Analytics",
      summary: "Analytics agregasyonu mevcut değil; bu durum sıfır trafik değildir.",
      updatedAt: null,
      metrics: {
        availability: "UNAVAILABLE",
        reason: "AGGREGATION_PENDING",
        lastSuccessfulThrough: null,
        lastCompletedAt: null,
      },
      actionTarget: "/analytics",
    },
    seo: {
      status: SITE_HEALTH_STATUS.HEALTHY,
      availability: "AVAILABLE",
      label: "SEO",
      summary: "SEO denetim özetleri mevcut sözleşmeden okunuyor.",
      updatedAt: null,
      metrics: { healthy: 1, attention: 0, critical: 0 },
      actionTarget: "/seo",
    },
    homepage: {
      status: SITE_HEALTH_STATUS.HEALTHY,
      availability: "AVAILABLE",
      label: "Ana sayfa",
      summary: "Yayınlanmış ana sayfa durumu okunabiliyor.",
      updatedAt: null,
      metrics: {
        liveVersionAvailable: true,
        lastPublishedAt: null,
        publishedSlotCount: 1,
        activeConversationItemCount: 1,
      },
      actionTarget: "/homepage",
    },
    media: {
      status: SITE_HEALTH_STATUS.HEALTHY,
      availability: "AVAILABLE",
      label: "Medya",
      summary: "Medya hak özetleri okunabiliyor.",
      updatedAt: null,
      metrics: { total: 0, rightsIneligible: 0, expiredLicenses: 0, missingCredit: 0 },
      actionTarget: "/media?rightsStatus=INCOMPLETE",
    },
    cache: {
      status: SITE_HEALTH_STATUS.DEGRADED,
      availability: "PARTIAL",
      label: "Cache / invalidation",
      summary: "Runtime cache sağlığı gözlemlenemiyor.",
      updatedAt: null,
      metrics: {
        runtimeObservable: false,
        invalidationOutboxObservable: true,
        pending: 0,
        processing: 0,
        dead: 0,
      },
      actionTarget: null,
    },
    featureControls: {
      status: SITE_HEALTH_STATUS.HEALTHY,
      availability: "AVAILABLE",
      label: "Feature controls",
      summary: "Runtime controls are at their default production posture.",
      updatedAt: null,
      metrics: { featureFlagsDisabled: 0, killSwitchesActive: 0 },
      actionTarget: null,
    },
  };
}

describe("Site Health read model contract", () => {
  it("accepts the bounded safe DTO shape", () => {
    assert.doesNotThrow(() => assertSafeSiteHealthDto(sampleSiteHealth()));
  });

  it("uses DEAD as the terminal outbox attention signal without inventing FAILED", () => {
    const text = source();
    assert.match(text, /outbox\.DEAD > 0/);
    assert.equal(text.includes("outbox.FAILED"), false);
    assert.equal(text.includes("FAILED"), false);
  });

  it("keeps analytics unavailable distinct from zero metrics", () => {
    const text = source();
    const fn = text.slice(
      text.indexOf("async function loadAnalyticsHealth"),
      text.indexOf("async function loadSeoHealth"),
    );
    assert.match(fn, /freshness\.status === "UNAVAILABLE"/);
    assert.match(fn, /sıfır trafik değildir/);
    assert.equal(fn.includes("articleViews: 0"), false);
  });

  it("keeps partial subsystem failure explicit", () => {
    const text = source();
    assert.match(text, /async function section/);
    assert.match(text, /unavailableSection/);
    assert.match(text, /Kaynak okunamadı/);
  });

  it("uses bounded aggregate reads instead of hydrating operational rows", () => {
    const text = source();
    assert.match(text, /count\(\*\)/);
    assert.match(text, /min\(/);
    assert.equal(/select\s+\*/i.test(text), false);
    assert.equal(text.includes(".select()"), false);
  });

  it("marks runtime cache observability as partial rather than healthy", () => {
    const text = source();
    const fn = text.slice(text.indexOf("async function loadCacheHealth"));
    assert.match(fn, /runtimeObservable: false/);
    assert.match(fn, /availability: "PARTIAL"/);
    assert.match(fn, /SITE_HEALTH_STATUS\.DEGRADED/);
  });
});
