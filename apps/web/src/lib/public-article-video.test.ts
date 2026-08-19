import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VIDEO_PROVIDER,
  videoEmbedUrl,
  type PublicEditorialVideoProjection,
} from "@magazine/domain";
import { PublicArticleVideos } from "../components/public-article-videos";
import {
  toTrustedPublicArticleVideo,
  trustedPublicArticleVideos,
} from "./public-article-video";
import {
  PUBLIC_VIDEO_FRAME_SRC_ORIGINS,
  publicWebContentSecurityPolicy,
} from "./web-csp";

const YOUTUBE_ID = "dQw4w9WgXcQ";
const VIMEO_ID = "123456789";

function publishedYoutube(
  overrides: Partial<PublicEditorialVideoProjection> = {},
): PublicEditorialVideoProjection {
  return {
    provider: VIDEO_PROVIDER.YOUTUBE,
    videoId: YOUTUBE_ID,
    embedUrl: videoEmbedUrl(VIDEO_PROVIDER.YOUTUBE, YOUTUBE_ID),
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Yayınlanan YouTube videosu",
    caption: "Kamuoyuna açıklanan görüntü",
    durationSeconds: 42,
    poster: null,
    ...overrides,
  };
}

function publishedVimeo(
  overrides: Partial<PublicEditorialVideoProjection> = {},
): PublicEditorialVideoProjection {
  return {
    provider: VIDEO_PROVIDER.VIMEO,
    videoId: VIMEO_ID,
    embedUrl: videoEmbedUrl(VIDEO_PROVIDER.VIMEO, VIMEO_ID),
    canonicalUrl: "https://vimeo.com/123456789",
    title: "Yayınlanan Vimeo videosu",
    caption: "Belgesel klibi",
    durationSeconds: 90,
    poster: null,
    ...overrides,
  };
}

function renderVideos(
  videos: readonly PublicEditorialVideoProjection[],
): string {
  return renderToStaticMarkup(
    createElement(PublicArticleVideos, { videos }),
  );
}

describe("public article trusted video playback", () => {
  it("renders a YouTube trusted nocookie embed from the published projection", () => {
    const html = renderVideos([publishedYoutube()]);

    assert.match(
      html,
      /src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/,
    );
    assert.match(html, /title="Yayınlanan YouTube videosu \(YouTube\)"/);
    assert.match(html, /loading="lazy"/);
    assert.equal(html.includes("autoplay=1"), false);
    assert.equal(html.includes("youtube.com/embed"), false);
  });

  it("renders a Vimeo trusted player embed from the published projection", () => {
    const html = renderVideos([publishedVimeo()]);

    assert.match(
      html,
      /src="https:\/\/player\.vimeo\.com\/video\/123456789"/,
    );
    assert.match(html, /title="Yayınlanan Vimeo videosu \(Vimeo\)"/);
    assert.match(html, />Vimeo</);
  });

  it("does not emit rightsNote, provenance, or submittedUrl in public output", () => {
    const poisoned = {
      ...publishedYoutube(),
      rightsNote: "internal-rights-secret",
      provenance: "internal-provenance-secret",
      submittedUrl: "https://submitted.example/watch?v=leak",
    };
    const html = renderVideos([poisoned]);
    const trusted = trustedPublicArticleVideos([poisoned]);

    assert.equal(html.includes("internal-rights-secret"), false);
    assert.equal(html.includes("internal-provenance-secret"), false);
    assert.equal(html.includes("submitted.example"), false);
    assert.equal(html.includes("rightsNote"), false);
    assert.equal(html.includes("provenance"), false);
    assert.equal(html.includes("submittedUrl"), false);
    assert.equal("rightsNote" in trusted[0]!, false);
    assert.equal("provenance" in trusted[0]!, false);
    assert.equal("submittedUrl" in trusted[0]!, false);
  });

  it("treats arbitrary iframe HTML as caption text, not a nested frame", () => {
    const html = renderVideos([
      publishedYoutube({
        caption: `<iframe src="https://evil.example/embed"></iframe>`,
      }),
    ]);

    assert.equal(html.includes("<iframe src=\"https://evil.example/embed\">"), false);
    assert.equal(html.includes("evil.example"), true);
    assert.equal((html.match(/<iframe\b/g) ?? []).length, 1);
    assert.match(
      html,
      /src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/,
    );
  });

  it("does not leak a draft video that is absent from the published list", () => {
    const draftOnly = publishedYoutube({
      videoId: "AAAAAAAAAAA",
      embedUrl: videoEmbedUrl(VIDEO_PROVIDER.YOUTUBE, "AAAAAAAAAAA"),
      title: "Draft-only video",
      caption: "draft-caption-secret",
    });
    const html = renderVideos([publishedVimeo()]);

    assert.equal(html.includes("AAAAAAAAAAA"), false);
    assert.equal(html.includes("Draft-only video"), false);
    assert.equal(html.includes("draft-caption-secret"), false);
    assert.equal(html.includes("youtube-nocookie.com"), false);
    assert.match(html, /src="https:\/\/player\.vimeo\.com\/video\/123456789"/);
    assert.equal(toTrustedPublicArticleVideo(draftOnly)?.videoId, "AAAAAAAAAAA");
  });

  it("refuses unsupported providers and untrusted embed sources", () => {
    const unsupportedProvider = {
      ...publishedYoutube(),
      provider: "DAILYMOTION" as PublicEditorialVideoProjection["provider"],
    };
    const youtubeComEmbed = publishedYoutube({
      embedUrl: `https://www.youtube.com/embed/${YOUTUBE_ID}`,
    });
    const autoplayEmbed = publishedYoutube({
      embedUrl: `${videoEmbedUrl(VIDEO_PROVIDER.YOUTUBE, YOUTUBE_ID)}?autoplay=1`,
    });
    const javascriptEmbed = publishedYoutube({
      embedUrl: "javascript:alert(1)",
    });
    const mismatchedId = publishedYoutube({
      videoId: YOUTUBE_ID,
      embedUrl: videoEmbedUrl(VIDEO_PROVIDER.YOUTUBE, "BBBBBBBBBBB"),
    });

    const html = renderVideos([
      unsupportedProvider,
      youtubeComEmbed,
      autoplayEmbed,
      javascriptEmbed,
      mismatchedId,
    ]);

    assert.equal(html, "");
    assert.equal(trustedPublicArticleVideos([
      unsupportedProvider,
      youtubeComEmbed,
      autoplayEmbed,
      javascriptEmbed,
      mismatchedId,
    ]).length, 0);
  });

  it("keeps public article playback on published videos only", () => {
    const pageSource = readFileSync(
      path.join(fileURLToPath(new URL("../app/[slug]/page.tsx", import.meta.url))),
      "utf8",
    );

    assert.equal(pageSource.includes("PublicArticleVideos"), true);
    assert.equal(pageSource.includes("article.videos"), true);
    assert.equal(pageSource.includes("draftVersionId"), false);
    assert.equal(pageSource.includes("scheduledVersionId"), false);
    assert.equal(pageSource.includes("dangerouslySetInnerHTML"), false);
  });
});

describe("public web video CSP", () => {
  it("allows only the intended video frame origins", () => {
    const policy = publicWebContentSecurityPolicy();

    assert.equal(
      policy,
      "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
    );
    assert.deepEqual(PUBLIC_VIDEO_FRAME_SRC_ORIGINS, [
      "https://www.youtube-nocookie.com",
      "https://player.vimeo.com",
    ]);
    assert.equal(policy.includes("*"), false);
    assert.equal(policy.includes("https://www.youtube.com"), false);
    assert.equal(policy.includes("https://youtube.com"), false);
    assert.equal(policy.includes("default-src"), false);
    assert.equal(policy.includes("script-src"), false);
  });
});
