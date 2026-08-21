import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { VIDEO_PLAY_MEASUREMENT } from "@magazine/domain/analytics-client";
import { createAnalyticsTracker } from "./track";

const srcRoot = fileURLToPath(new URL("../..", import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(srcRoot, rel), "utf8");
}

describe("video analytics instrumentation", () => {
  it("keeps VIDEO_PLAY deferred and does not emit a fake play event", () => {
    assert.equal(VIDEO_PLAY_MEASUREMENT.STATUS, "DEFERRED");
    assert.equal(
      VIDEO_PLAY_MEASUREMENT.REASON,
      "PUBLIC_IFRAME_WITHOUT_TRUSTED_PLAYER_API",
    );

    const tracker = createAnalyticsTracker({
      transport: () => {
        throw new Error("should not send");
      },
    });
    assert.equal("trackVideoPlay" in tracker, false);

    const trackSource = read("lib/analytics/track.ts");
    assert.equal(trackSource.includes("VIDEO_PLAY"), false);
    assert.equal(trackSource.includes("trackVideoPlay"), false);

    const videos = read("components/public-article-videos.tsx");
    const homepageVideo = read("components/homepage-video.tsx");
    assert.equal(videos.includes("AnalyticsVideoImpression"), true);
    assert.equal(homepageVideo.includes("AnalyticsVideoImpression"), true);
    assert.equal(videos.includes("youtube.com/iframe_api"), false);
    assert.equal(homepageVideo.includes("player.vimeo.com/api"), false);
  });
});
