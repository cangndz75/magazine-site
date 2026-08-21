import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VIDEO_ERROR,
  VIDEO_PROVIDER,
  assertProviderVideoId,
  assertVideoDurationSeconds,
  canonicalizeEditorialVideoWrite,
  parseVideoProviderInput,
  toPublicEditorialVideoProjection,
} from "./editorial-video";

function assertOk<T>(value: { ok: true; value: T } | { ok: false; code: string }): T {
  assert.equal(value.ok, true, JSON.stringify(value));
  return value.value as T;
}

function assertCode(
  value: { ok: true; value: unknown } | { ok: false; code: string },
  code: string,
): void {
  assert.equal(value.ok, false);
  assert.equal((value as { ok: false; code: string }).code, code);
}

describe("editorial video provider parsing", () => {
  it("accepts supported YouTube URL forms and canonicalizes playback URLs", () => {
    for (const raw of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ]) {
      const parsed = assertOk(parseVideoProviderInput(raw));
      assert.equal(parsed.provider, VIDEO_PROVIDER.YOUTUBE);
      assert.equal(parsed.providerVideoId, "dQw4w9WgXcQ");
      assert.equal(
        parsed.embedUrl,
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      );
      assert.equal(
        parsed.canonicalUrl,
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );
      assert.equal(
        parsed.providerThumbnailUrl,
        "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      );
    }
  });

  it("accepts supported Vimeo URL forms and canonicalizes playback URLs", () => {
    for (const raw of [
      "https://vimeo.com/123456789",
      "https://www.vimeo.com/123456789",
      "https://player.vimeo.com/video/123456789",
      "123456789",
    ]) {
      const parsed = assertOk(parseVideoProviderInput(raw));
      assert.equal(parsed.provider, VIDEO_PROVIDER.VIMEO);
      assert.equal(parsed.providerVideoId, "123456789");
      assert.equal(parsed.embedUrl, "https://player.vimeo.com/video/123456789");
      assert.equal(parsed.canonicalUrl, "https://vimeo.com/123456789");
      assert.equal(parsed.providerThumbnailUrl, null);
    }
  });

  it("rejects lookalike hosts, unsafe schemes, relative URLs, and bad ids", () => {
    for (const raw of [
      "https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ",
      "https://evil-youtube.example/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "data:text/html,video",
      "/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=",
      "https://youtu.be/too-short",
      "https://vimeo.com/not-a-number",
    ]) {
      const parsed = parseVideoProviderInput(raw);
      assert.equal(parsed.ok, false, raw);
    }
  });

  it("keeps provider-id validation finite", () => {
    assert.equal(
      assertProviderVideoId({
        provider: VIDEO_PROVIDER.YOUTUBE,
        providerVideoId: "dQw4w9WgXcQ",
      }).ok,
      true,
    );
    assertCode(
      assertProviderVideoId({
        provider: VIDEO_PROVIDER.YOUTUBE,
        providerVideoId: "dQw4w9WgXcQ<script>",
      }),
      VIDEO_ERROR.INVALID_PROVIDER_ID,
    );
    assertCode(
      assertProviderVideoId({
        provider: VIDEO_PROVIDER.VIMEO,
        providerVideoId: "abc123",
      }),
      VIDEO_ERROR.INVALID_PROVIDER_ID,
    );
  });
});

describe("editorial video metadata and public projection", () => {
  it("validates duration and text bounds", () => {
    assert.equal(assertVideoDurationSeconds(null).ok, true);
    assert.equal(assertVideoDurationSeconds(1).ok, true);
    assertCode(assertVideoDurationSeconds(0), VIDEO_ERROR.INVALID_METADATA);
    assertCode(assertVideoDurationSeconds(86_401), VIDEO_ERROR.INVALID_METADATA);

    assertCode(
      canonicalizeEditorialVideoWrite({
        providerUrlOrId: "https://youtu.be/dQw4w9WgXcQ",
        title: "",
      }),
      VIDEO_ERROR.INVALID_METADATA,
    );
    assertCode(
      canonicalizeEditorialVideoWrite({
        providerUrlOrId: "https://youtu.be/dQw4w9WgXcQ",
        title: "x".repeat(201),
      }),
      VIDEO_ERROR.INVALID_METADATA,
    );
  });

  it("canonicalizes a safe editor write", () => {
    const write = assertOk(
      canonicalizeEditorialVideoWrite({
        providerUrlOrId: " https://youtu.be/dQw4w9WgXcQ ",
        title: " Launch video ",
        caption: " Caption ",
        description: " Description ",
        durationSeconds: 42,
        posterMediaId: "poster-id",
        rightsNote: " cleared by provider agreement ",
        provenance: " desk supplied ",
      }),
    );

    assert.equal(write.provider, VIDEO_PROVIDER.YOUTUBE);
    assert.equal(write.title, "Launch video");
    assert.equal(write.caption, "Caption");
    assert.equal(write.durationSeconds, 42);
    assert.equal(write.posterMediaId, "poster-id");
    assert.equal(write.rightsNote, "cleared by provider agreement");
    assert.equal(write.provenance, "desk supplied");
  });

  it("projects only trusted playback/display fields to public output", () => {
    const projected = toPublicEditorialVideoProjection({
      provider: VIDEO_PROVIDER.YOUTUBE,
      providerVideoId: "dQw4w9WgXcQ",
      title: "Public video",
      caption: "<b>stored as text</b>",
      durationSeconds: 50,
      editorialPoster: {
        publicUrl: "https://media.example.test/poster.jpg",
        width: 1200,
        height: 675,
        altText: "Poster",
        attachmentCredit: "Desk",
        creditLine: "Library",
      },
    });

    assert.deepEqual(projected, {
      provider: VIDEO_PROVIDER.YOUTUBE,
      videoId: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Public video",
      caption: "<b>stored as text</b>",
      durationSeconds: 50,
      poster: {
        url: "https://media.example.test/poster.jpg",
        width: 1200,
        height: 675,
        altText: "Poster",
        credit: "Desk",
        source: "EDITORIAL",
      },
    });
    assert.equal(JSON.stringify(projected).includes("rightsNote"), false);
  });

  it("falls back to trusted provider thumbnails when no editorial poster exists", () => {
    const projected = toPublicEditorialVideoProjection({
      provider: VIDEO_PROVIDER.YOUTUBE,
      providerVideoId: "dQw4w9WgXcQ",
      title: "Public video",
      caption: null,
      durationSeconds: null,
      editorialPoster: null,
    });

    assert.equal(projected?.poster?.source, "PROVIDER");
    assert.equal(projected?.poster?.url, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
