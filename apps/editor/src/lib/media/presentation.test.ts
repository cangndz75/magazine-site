import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_RIGHTS_STATUS } from "@magazine/domain";
import {
  LICENSE_EXPIRY_SIGNAL_LABELS,
  presentLicenseExpirySignal,
  presentPublicEligibilityBlockedLabel,
  RIGHTS_STATUS_PRESENTATION,
} from "./presentation";
import {
  serializeMediaInspector,
  serializeMediaLibraryItem,
} from "./serialize";

describe("media presentation", () => {
  it("maps every rights status to Turkish labels with non-color cues", () => {
    for (const status of Object.values(MEDIA_RIGHTS_STATUS)) {
      const presentation = RIGHTS_STATUS_PRESENTATION[status];
      assert.ok(presentation.label.length > 0);
      assert.ok(presentation.icon.length > 0);
      assert.ok(
        ["ok", "warn", "danger", "muted"].includes(presentation.tone),
      );
    }
  });

  it("uses editorial Turkish labels for restricted and expired statuses", () => {
    assert.equal(
      RIGHTS_STATUS_PRESENTATION[MEDIA_RIGHTS_STATUS.RESTRICTED].label,
      "Kullanım kısıtlı",
    );
    assert.equal(
      RIGHTS_STATUS_PRESENTATION[MEDIA_RIGHTS_STATUS.EXPIRED].label,
      "Lisans süresi dolmuş",
    );
  });

  it("maps license expiry horizons for presentation only", () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    assert.equal(
      presentLicenseExpirySignal("2026-08-10T00:00:00.000Z", now),
      "expired",
    );
    assert.equal(
      presentLicenseExpirySignal("2026-08-22T00:00:00.000Z", now),
      "within_7_days",
    );
    assert.equal(
      presentLicenseExpirySignal("2026-09-10T00:00:00.000Z", now),
      "within_30_days",
    );
    assert.equal(presentLicenseExpirySignal(null, now), null);
    for (const key of Object.keys(LICENSE_EXPIRY_SIGNAL_LABELS)) {
      assert.ok(
        LICENSE_EXPIRY_SIGNAL_LABELS[
          key as keyof typeof LICENSE_EXPIRY_SIGNAL_LABELS
        ].length > 0,
      );
    }
  });

  it("labels blocked public eligibility in Turkish", () => {
    assert.equal(presentPublicEligibilityBlockedLabel(false), "Public kullanım engelli");
    assert.equal(presentPublicEligibilityBlockedLabel(true), null);
  });
});

describe("media serialize", () => {
  const baseListItem = {
    id: "media-1",
    label: "photo.jpg",
    mediaType: "IMAGE",
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    previewUrl: "https://cdn.example/photo.jpg",
    creatorName: "Fotoğrafçı",
    sourceName: "Ajans",
    creditLine: "Foto: Ajans",
    licenseExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
    eligibility: {
      eligible: true,
      status: MEDIA_RIGHTS_STATUS.CLEARED,
      reasons: [],
    },
    usageCount: 2,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("serializes list items without internal storage fields", () => {
    const serialized = serializeMediaLibraryItem({
      ...baseListItem,
      storageKey: "private/path.jpg",
    } as typeof baseListItem & { storageKey: string });

    assert.equal(serialized.id, "media-1");
    assert.equal(serialized.sourceName, "Ajans");
    assert.equal(serialized.licenseExpiresAt, "2027-01-01T00:00:00.000Z");
    assert.equal("storageKey" in serialized, false);
    assert.equal("bucket" in serialized, false);
  });

  it("serializes inspector with renditions but no storage keys", () => {
    const serialized = serializeMediaInspector({
      id: "media-1",
      label: "photo.jpg",
      mediaType: "IMAGE",
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      byteSize: 1024,
      previewUrl: "https://cdn.example/photo.jpg",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      rights: {
        sourceKind: "AGENCY",
        sourceName: "Ajans",
        creatorName: "Fotoğrafçı",
        rightsHolder: "Ajans",
        licenseType: "EDITORIAL",
        licenseReference: null,
        licenseNote: "staff only",
        licenseStartsAt: null,
        licenseExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
        creditLine: "Foto: Ajans",
        usageRestriction: "NONE",
        territoryRestriction: null,
        storageKey: "secret/key",
      },
      eligibility: {
        eligible: true,
        status: MEDIA_RIGHTS_STATUS.CLEARED,
        reasons: [],
      },
      usages: [],
      usageCount: 0,
      renditions: [{ variant: "thumb", width: 200, height: 133 }],
    });

    assert.deepEqual(serialized.renditions, [
      { variant: "thumb", width: 200, height: 133 },
    ]);
    assert.equal("storageKey" in serialized, false);
    assert.equal(serialized.rights.licenseNote, "staff only");
  });
});
