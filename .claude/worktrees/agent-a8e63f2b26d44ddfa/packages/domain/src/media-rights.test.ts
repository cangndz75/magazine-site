import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "./staff-role";
import {
  MEDIA_LICENSE_TYPE,
  MEDIA_PUBLIC_INELIGIBILITY_REASON,
  MEDIA_RIGHTS_ERROR,
  MEDIA_RIGHTS_STATUS,
  MEDIA_SOURCE_KIND,
  MEDIA_USAGE_RESTRICTION,
  authorizeMediaRightsRead,
  authorizeMediaRightsWrite,
  canonicalizeMediaRightsWrite,
  defaultMediaRights,
  evaluateMediaPublicEligibility,
  toPublicMediaProjection,
} from "./media-rights";

const NOW = new Date("2026-08-19T00:00:00.000Z");

function clearedRights() {
  return {
    sourceKind: MEDIA_SOURCE_KIND.OWNED,
    sourceName: "Newsroom",
    creatorName: "Ada Photo",
    rightsHolder: "Magazine Ltd",
    licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
    licenseReference: "CONTRACT-1",
    licenseNote: "Internal legal file on shelf A",
    licenseStartsAt: new Date("2024-01-01T00:00:00.000Z"),
    licenseExpiresAt: null as Date | null,
    creditLine: "Ada Photo / Magazine Ltd",
    usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
    territoryRestriction: null as string | null,
  };
}

describe("media rights authorization", () => {
  it("lets editors read and authors write media rights via existing capabilities", () => {
    assert.deepEqual(authorizeMediaRightsRead({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: true,
      value: true,
    });
    assert.deepEqual(authorizeMediaRightsWrite({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: true,
      value: true,
    });
  });

  it("forbids empty roles", () => {
    assert.deepEqual(authorizeMediaRightsRead({ roles: [] }), {
      ok: false,
      code: MEDIA_RIGHTS_ERROR.FORBIDDEN,
    });
    assert.deepEqual(authorizeMediaRightsWrite({ roles: [] }), {
      ok: false,
      code: MEDIA_RIGHTS_ERROR.FORBIDDEN,
    });
  });
});

describe("evaluateMediaPublicEligibility", () => {
  it("accepts complete cleared rights with no expiration", () => {
    const result = evaluateMediaPublicEligibility(clearedRights(), NOW);
    assert.deepEqual(result, {
      eligible: true,
      status: MEDIA_RIGHTS_STATUS.CLEARED,
      reasons: [],
    });
  });

  it("treats existing-media defaults as incomplete", () => {
    const result = evaluateMediaPublicEligibility(defaultMediaRights(), NOW);
    assert.deepEqual(result, {
      eligible: false,
      status: MEDIA_RIGHTS_STATUS.INCOMPLETE,
      reasons: [MEDIA_PUBLIC_INELIGIBILITY_REASON.RIGHTS_INCOMPLETE],
    });
  });

  it("marks a restricted asset ineligible even when other fields are complete", () => {
    const result = evaluateMediaPublicEligibility(
      {
        ...clearedRights(),
        usageRestriction: MEDIA_USAGE_RESTRICTION.RESTRICTED,
      },
      NOW,
    );
    assert.equal(result.eligible, false);
    assert.equal(result.status, MEDIA_RIGHTS_STATUS.RESTRICTED);
    assert.deepEqual(result.reasons, [
      MEDIA_PUBLIC_INELIGIBILITY_REASON.USAGE_RESTRICTED,
    ]);
  });

  it("allows editorial-only usage for public magazine publication", () => {
    const result = evaluateMediaPublicEligibility(
      {
        ...clearedRights(),
        usageRestriction: MEDIA_USAGE_RESTRICTION.EDITORIAL_ONLY,
      },
      NOW,
    );
    assert.equal(result.eligible, true);
    assert.equal(result.status, MEDIA_RIGHTS_STATUS.CLEARED);
  });

  it("treats a license as expired at the expiry instant", () => {
    const expiry = new Date("2026-08-19T00:00:00.000Z");
    const result = evaluateMediaPublicEligibility(
      {
        ...clearedRights(),
        licenseExpiresAt: expiry,
      },
      expiry,
    );
    assert.deepEqual(result, {
      eligible: false,
      status: MEDIA_RIGHTS_STATUS.EXPIRED,
      reasons: [MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_EXPIRED],
    });
  });

  it("keeps a license eligible one millisecond before expiry", () => {
    const expiry = new Date("2026-08-19T00:00:00.000Z");
    const result = evaluateMediaPublicEligibility(
      {
        ...clearedRights(),
        licenseExpiresAt: expiry,
      },
      new Date(expiry.getTime() - 1),
    );
    assert.equal(result.eligible, true);
    assert.equal(result.status, MEDIA_RIGHTS_STATUS.CLEARED);
  });

  it("rejects a license that has not started yet", () => {
    const result = evaluateMediaPublicEligibility(
      {
        ...clearedRights(),
        licenseStartsAt: new Date("2026-08-20T00:00:00.000Z"),
      },
      NOW,
    );
    assert.deepEqual(result, {
      eligible: false,
      status: MEDIA_RIGHTS_STATUS.NOT_STARTED,
      reasons: [MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_NOT_STARTED],
    });
  });
});

describe("canonicalizeMediaRightsWrite", () => {
  it("trims bounded text and rejects inverted license windows", () => {
    const ok = canonicalizeMediaRightsWrite({
      sourceKind: MEDIA_SOURCE_KIND.AGENCY,
      sourceName: "  Reuters  ",
      creatorName: "  ",
      rightsHolder: "Reuters",
      licenseType: MEDIA_LICENSE_TYPE.EDITORIAL,
      creditLine: "Reuters",
      usageRestriction: MEDIA_USAGE_RESTRICTION.EDITORIAL_ONLY,
      licenseStartsAt: "2026-01-01T00:00:00.000Z",
      licenseExpiresAt: "2026-12-31T00:00:00.000Z",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.sourceName, "Reuters");
      assert.equal(ok.value.creatorName, null);
      assert.equal(ok.value.licenseStartsAt?.toISOString(), "2026-01-01T00:00:00.000Z");
    }

    assert.deepEqual(
      canonicalizeMediaRightsWrite({
        sourceKind: MEDIA_SOURCE_KIND.OWNED,
        rightsHolder: "Holder",
        licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
        creditLine: "Credit",
        usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
        licenseStartsAt: "2026-08-19T00:00:00.000Z",
        licenseExpiresAt: "2026-08-19T00:00:00.000Z",
      }),
      { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS },
    );
  });
});

describe("toPublicMediaProjection", () => {
  it("exposes only safe public media fields and prefers attachment credit", () => {
    const projection = toPublicMediaProjection({
      publicUrl: "https://cdn.example/hero.jpg",
      width: 1600,
      height: 900,
      altText: "Crowd",
      attachmentCredit: "On-article credit",
      creditLine: "Asset credit line",
    });
    assert.deepEqual(projection, {
      url: "https://cdn.example/hero.jpg",
      width: 1600,
      height: 900,
      altText: "Crowd",
      credit: "On-article credit",
    });
    assert.deepEqual(Object.keys(projection).sort(), [
      "altText",
      "credit",
      "height",
      "url",
      "width",
    ]);
  });

  it("falls back to the asset credit line and never copies internal rights fields", () => {
    const rights = clearedRights();
    const projection = toPublicMediaProjection({
      publicUrl: "https://cdn.example/hero.jpg",
      width: 800,
      height: 600,
      altText: "Portrait",
      attachmentCredit: null,
      creditLine: rights.creditLine,
    });
    assert.equal(projection.credit, rights.creditLine);
    assert.equal(
      Object.prototype.hasOwnProperty.call(projection, "licenseNote"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(projection, "storageKey"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(projection, "licenseReference"),
      false,
    );
  });
});
