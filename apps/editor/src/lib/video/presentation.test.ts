import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VIDEO_ERROR, VIDEO_PROVIDER } from "@magazine/domain";
import {
  ARTICLE_VIDEO_EMPTY,
  formatVideoDuration,
  isValidExpectedUpdatedAt,
  presentVideoUrlError,
  toArticleVideoPutItems,
  videoPosterFallbackLabel,
  videoProviderLabel,
} from "./presentation";
import {
  pickerCardHasInternalFields,
  serializeVideoPickerCard,
} from "./serialize";

describe("video editor presentation", () => {
  it("labels supported providers without relying on color", () => {
    assert.equal(videoProviderLabel(VIDEO_PROVIDER.YOUTUBE), "YouTube");
    assert.equal(videoProviderLabel(VIDEO_PROVIDER.VIMEO), "Vimeo");
  });

  it("exposes the article empty state copy", () => {
    assert.equal(ARTICLE_VIDEO_EMPTY, "Videodan içerik seç");
  });

  it("falls back to a Vimeo placeholder when no editorial poster exists", () => {
    assert.equal(
      videoPosterFallbackLabel({
        provider: VIDEO_PROVIDER.VIMEO,
        posterSource: "NONE",
      }).includes("Vimeo"),
      true,
    );
    assert.equal(
      videoPosterFallbackLabel({
        provider: VIDEO_PROVIDER.YOUTUBE,
        posterSource: "PROVIDER",
      }).includes("YouTube"),
      true,
    );
  });

  it("maps backend URL error codes to Turkish copy", () => {
    assert.equal(
      presentVideoUrlError(VIDEO_ERROR.UNSUPPORTED_PROVIDER),
      "Şu anda yalnızca YouTube ve Vimeo destekleniyor.",
    );
    assert.equal(
      presentVideoUrlError(
        VIDEO_ERROR.INVALID_VIDEO_URL,
        "https://www.youtube.com/watch?v=",
      ),
      "Bu YouTube bağlantısı geçerli görünmüyor.",
    );
    assert.equal(
      presentVideoUrlError(
        VIDEO_ERROR.INVALID_VIDEO_URL,
        "https://vimeo.com/not-an-id",
      ),
      "Bu Vimeo bağlantısı geçerli görünmüyor.",
    );
    assert.equal(
      presentVideoUrlError(VIDEO_ERROR.DUPLICATE_VIDEO),
      "Bu video zaten kayıtlı.",
    );
  });

  it("serializes picker cards without internal fields", () => {
    const card = serializeVideoPickerCard({
      id: "11111111-1111-4111-8111-111111111111",
      provider: "YOUTUBE",
      providerVideoId: "abcdefghijk",
      canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      title: "Launch",
      caption: "internal-caption",
      durationSeconds: 12,
      posterMediaId: null,
      posterSource: "PROVIDER",
      posterPreviewUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
      posterWidth: null,
      posterHeight: null,
      hasRightsNote: true,
      hasProvenance: true,
      usageCount: 1,
      updatedAt: "2026-08-19T00:00:00.000Z",
    });
    assert.equal(pickerCardHasInternalFields(card), false);
    assert.equal("rightsNote" in card, false);
    assert.equal("submittedUrl" in card, false);
    assert.equal("embedUrl" in card, false);
    assert.equal("description" in card, false);
    assert.equal(card.provider, "YOUTUBE");
  });

  it("builds a single ordered PUT payload and validates expectedUpdatedAt", () => {
    const items = toArticleVideoPutItems([
      { id: "a", caption: "  one  " },
      { id: "b", caption: null },
    ]);
    assert.deepEqual(items, [
      { videoAssetId: "a", caption: "one" },
      { videoAssetId: "b", caption: null },
    ]);
    assert.equal(isValidExpectedUpdatedAt("2026-08-19T12:00:00.000Z"), true);
    assert.equal(isValidExpectedUpdatedAt(""), false);
    assert.equal(isValidExpectedUpdatedAt("not-a-date"), false);
  });

  it("formats duration without fabricating missing values", () => {
    assert.equal(formatVideoDuration(null), "Süre yok");
    assert.equal(formatVideoDuration(65), "1:05");
  });
});
