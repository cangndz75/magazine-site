import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  publicPublisherLeaksInternal,
  resolvePublicPublisherIdentity,
  toNewsArticlePublisherOrganization,
} from "./publisher";

describe("public publisher identity", () => {
  it("omits publisher entirely when the configured name is empty", () => {
    assert.equal(
      resolvePublicPublisherIdentity({
        name: "  ",
        url: "https://www.example.com",
        logoUrl: "https://cdn.example.com/logo.png",
      }),
      null,
    );
  });

  it("keeps a valid name and drops invalid URL and logo fields", () => {
    const identity = resolvePublicPublisherIdentity({
      name: " Dergi ",
      url: "javascript:alert(1)",
      logoUrl: "not-a-url",
    });
    assert.deepEqual(identity, {
      name: "Dergi",
      url: null,
      logoUrl: null,
    });
    const organization = toNewsArticlePublisherOrganization(identity);
    assert.deepEqual(organization, {
      "@type": "Organization",
      name: "Dergi",
    });
  });

  it("does not default publisher URL to SITE_URL and never leaks storage keys", () => {
    const identity = resolvePublicPublisherIdentity({
      name: "Dergi",
      url: null,
      logoUrl: "https://cdn.example.com/logo.png",
    });
    assert.equal(identity?.url, null);
    assert.equal(identity?.logoUrl, "https://cdn.example.com/logo.png");
    const organization = toNewsArticlePublisherOrganization(identity);
    assert.equal(organization?.url, undefined);
    assert.deepEqual(organization?.logo, {
      "@type": "ImageObject",
      url: "https://cdn.example.com/logo.png",
    });
    assert.equal(publicPublisherLeaksInternal(organization), false);
    assert.equal(publicPublisherLeaksInternal({ storageKey: "secret" }), true);
  });
});
