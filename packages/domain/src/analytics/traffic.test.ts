import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_TRAFFIC_KIND,
  ANALYTICS_TRAFFIC_SOURCE,
  canonicalizeAnalyticsUtm,
  classifyAnalyticsTrafficKind,
  classifyAnalyticsTrafficSource,
  userAgentLooksLikeKnownBot,
} from "./index";

describe("analytics traffic classification", () => {
  it("classifies missing referrer as DIRECT, including privacy-stripped cases", () => {
    assert.deepEqual(
      classifyAnalyticsTrafficSource({
        referrerUrl: null,
        trustedSiteOrigin: "https://www.example.com",
      }),
      { source: ANALYTICS_TRAFFIC_SOURCE.DIRECT, referrerHost: null },
    );
  });

  it("classifies same-origin referrers as INTERNAL", () => {
    const classified = classifyAnalyticsTrafficSource({
      referrerUrl: "https://www.example.com/onceki-haber?utm=1",
      trustedSiteOrigin: "https://www.example.com",
    });
    assert.equal(classified.source, ANALYTICS_TRAFFIC_SOURCE.INTERNAL);
    assert.equal(classified.referrerHost, "example.com");
  });

  it("classifies known search and social hosts without storing the full URL", () => {
    assert.equal(
      classifyAnalyticsTrafficSource({
        referrerUrl: "https://www.google.com/search?q=email@example.com",
        trustedSiteOrigin: "https://www.example.com",
      }).source,
      ANALYTICS_TRAFFIC_SOURCE.SEARCH,
    );
    assert.equal(
      classifyAnalyticsTrafficSource({
        referrerUrl: "https://t.co/abc",
        trustedSiteOrigin: "https://www.example.com",
      }).source,
      ANALYTICS_TRAFFIC_SOURCE.SOCIAL,
    );
    const referral = classifyAnalyticsTrafficSource({
      referrerUrl: "https://news.other-site.test/path?token=secret",
      trustedSiteOrigin: "https://www.example.com",
    });
    assert.equal(referral.source, ANALYTICS_TRAFFIC_SOURCE.REFERRAL);
    assert.equal(referral.referrerHost, "news.other-site.test");
  });

  it("ignores spoofable query markers and requires trusted evidence for INTERNAL/TEST", () => {
    assert.equal(
      classifyAnalyticsTrafficKind({
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        signals: {},
      }),
      ANALYTICS_TRAFFIC_KIND.HUMAN,
    );
    assert.equal(
      classifyAnalyticsTrafficKind({
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        signals: { trustedInternalEvidence: true },
      }),
      ANALYTICS_TRAFFIC_KIND.INTERNAL,
    );
    assert.equal(
      classifyAnalyticsTrafficKind({
        appEnv: ANALYTICS_APP_ENV.STAGING,
        signals: {},
      }),
      ANALYTICS_TRAFFIC_KIND.TEST,
    );
    assert.equal(
      classifyAnalyticsTrafficKind({
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        signals: { trustedTestEvidence: true },
      }),
      ANALYTICS_TRAFFIC_KIND.TEST,
    );
    assert.equal(
      classifyAnalyticsTrafficKind({
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        signals: {
          userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
        },
      }),
      ANALYTICS_TRAFFIC_KIND.BOT,
    );
    assert.equal(userAgentLooksLikeKnownBot("facebookexternalhit/1.1"), true);
    assert.equal(
      canonicalizeAnalyticsUtm({
        source: " Newsletter ",
        medium: "email!",
        campaign: "spring-2026",
      }).medium,
      null,
    );
  });
});
