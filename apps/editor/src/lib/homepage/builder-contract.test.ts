import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseMoveHomepageFeaturedBody,
  parsePublishHomepageBody,
  parseSetHomepageSlotBody,
  parseSetHomepageVideoBody,
} from "./builder-payload";
import { EditorHttpError } from "@/lib/content/http";
import { analyzePublishEligibility, countEmptySlots } from "./builder-utils";
import type { HomepageBuilderView } from "./builder-types";

const homepageApiRoot = path.join(
  fileURLToPath(new URL("../../app/api/homepage", import.meta.url)),
);

describe("homepage builder payload", () => {
  it("parses slot mutation body with concurrency token", () => {
    const parsed = parseSetHomepageSlotBody({
      expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
      slotKey: "LEAD",
      contentItemId: "00000000-0000-4000-8000-000000000099",
    });
    assert.equal(parsed.slotKey, "LEAD");
    assert.equal(parsed.expectedUpdatedAt, "2026-08-18T12:00:00.000Z");
  });

  it("parses publish body", () => {
    const parsed = parsePublishHomepageBody({
      expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
    });
    assert.equal(parsed.expectedUpdatedAt, "2026-08-18T12:00:00.000Z");
  });

  it("parses homepage video mutation body", () => {
    const parsed = parseSetHomepageVideoBody({
      expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
      videoAssetId: "00000000-0000-4000-8000-000000000099",
    });
    assert.equal(parsed.videoAssetId, "00000000-0000-4000-8000-000000000099");
  });

  it("parses featured neighbor move body with concurrency token", () => {
    const parsed = parseMoveHomepageFeaturedBody({
      expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
      slotKey: "FEATURED_1",
      direction: "right",
    });
    assert.equal(parsed.slotKey, "FEATURED_1");
    assert.equal(parsed.direction, "right");
    assert.equal(parsed.expectedUpdatedAt, "2026-08-18T12:00:00.000Z");
  });

  it("rejects a featured move without a concurrency token or neighbor", () => {
    assert.throws(
      () =>
        parseMoveHomepageFeaturedBody({
          slotKey: "FEATURED_1",
          direction: "right",
        }),
      (error: unknown) =>
        error instanceof EditorHttpError && error.code === "INVALID_REQUEST",
    );
    assert.throws(
      () =>
        parseMoveHomepageFeaturedBody({
          expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
          slotKey: "LEAD",
          direction: "right",
        }),
      (error: unknown) =>
        error instanceof EditorHttpError && error.code === "INVALID_REQUEST",
    );
    assert.throws(
      () =>
        parseMoveHomepageFeaturedBody({
          expectedUpdatedAt: "2026-08-18T12:00:00.000Z",
          slotKey: "FEATURED_1",
          direction: "left",
        }),
      (error: unknown) =>
        error instanceof EditorHttpError && error.code === "INVALID_REQUEST",
    );
  });
});

describe("homepage builder eligibility", () => {
  const builder: HomepageBuilderView = {
    updatedAt: "2026-08-18T12:00:00.000Z",
    published: null,
    draft: {
      versionId: "draft-1",
      publishedAt: null,
      videoAssetId: null,
      slots: [
        { slotKey: "LEAD", contentItemId: "a" },
        { slotKey: "SUPPORT_1", contentItemId: null },
        { slotKey: "SUPPORT_2", contentItemId: null },
        { slotKey: "FEATURED_1", contentItemId: "b" },
        { slotKey: "FEATURED_2", contentItemId: null },
        { slotKey: "FEATURED_3", contentItemId: null },
        { slotKey: "FEATURED_4", contentItemId: null },
        { slotKey: "FEATURED_5", contentItemId: null },
      ],
    },
    stories: {
      a: {
        id: "a",
        slug: "live-a",
        title: "Live A",
        publicationStatus: "PUBLISHED",
        workflowStatus: "APPROVED",
        primaryCategory: { name: "Cat", slug: "cat" },
        publishedAt: "2026-08-18T10:00:00.000Z",
        isPublishEligible: true,
        heroThumbnail: null,
      },
      b: {
        id: "b",
        slug: "draft-b",
        title: "Draft B",
        publicationStatus: "NEVER_PUBLISHED",
        workflowStatus: "DRAFT",
        primaryCategory: null,
        publishedAt: null,
        isPublishEligible: false,
        heroThumbnail: null,
      },
    },
    videos: {},
  };

  it("treats empty slots as informational not blocking", () => {
    assert.equal(countEmptySlots(builder), 6);
    const eligibility = analyzePublishEligibility(builder);
    assert.equal(eligibility.blockingCount, 1);
    assert.equal(eligibility.emptyCount, 6);
  });

  it("does not treat a thumbnail as homepage publication authority", () => {
    const withThumbnails: HomepageBuilderView = {
      ...builder,
      stories: {
        a: {
          ...builder.stories.a!,
          heroThumbnail: {
            url: "https://media.example.test/qa/hero.jpg",
            width: 1600,
            height: 900,
            altText: null,
            credit: null,
          },
        },
        b: {
          ...builder.stories.b!,
          heroThumbnail: {
            url: "https://media.example.test/qa/draft.jpg",
            width: 800,
            height: 600,
            altText: null,
            credit: null,
          },
        },
      },
    };
    const eligibility = analyzePublishEligibility(withThumbnails);
    assert.equal(eligibility.blockingCount, 1);
    assert.equal(withThumbnails.stories.b?.isPublishEligible, false);
  });
});

describe("homepage builder API routes", () => {
  it("uses HOMEPAGE_MANAGE and editor write wrapper for mutations", () => {
    const slots = readFileSync(path.join(homepageApiRoot, "builder/slots/route.ts"), "utf8");
    const move = readFileSync(
      path.join(homepageApiRoot, "builder/slots/move/route.ts"),
      "utf8",
    );
    const publish = readFileSync(
      path.join(homepageApiRoot, "builder/publish/route.ts"),
      "utf8",
    );
    const video = readFileSync(
      path.join(homepageApiRoot, "builder/video/route.ts"),
      "utf8",
    );
    const get = readFileSync(path.join(homepageApiRoot, "builder/route.ts"), "utf8");

    assert.equal(slots.includes("withEditorWrite"), true);
    assert.equal(slots.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(slots.includes("session.staffUserId"), true);

    assert.equal(move.includes("withEditorWrite"), true);
    assert.equal(move.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(move.includes("session.staffUserId"), true);
    assert.equal(move.includes("moveHomepageFeaturedSlot"), true);
    assert.equal(move.includes(".update("), false);
    assert.equal(move.includes(".insert("), false);

    assert.equal(publish.includes("withEditorWrite"), true);
    assert.equal(publish.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(publish.includes("session.staffUserId"), true);

    assert.equal(video.includes("withEditorWrite"), true);
    assert.equal(video.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(video.includes("setHomepageVideo"), true);

    assert.equal(get.includes("withEditorRead"), true);
    assert.equal(get.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
  });
});

describe("homepage builder featured move client contract", () => {
  it("performs one logical featured move mutation", () => {
    const workspace = readFileSync(
      path.join(
        fileURLToPath(
          new URL("../../components/homepage-builder-workspace.tsx", import.meta.url),
        ),
      ),
      "utf8",
    );
    const start = workspace.indexOf("const handleMoveFeatured");
    const end = workspace.indexOf("const handlePublish");
    assert.equal(start >= 0, true);
    assert.equal(end > start, true);
    const moveFn = workspace.slice(start, end);
    assert.equal(moveFn.includes("/api/homepage/builder/slots/move"), true);
    assert.equal(moveFn.includes('fetch("/api/homepage/builder/slots"'), false);
    assert.equal((moveFn.match(/fetch\(/g) ?? []).length, 1);
    assert.equal(moveFn.includes("contentItemId:"), false);
  });
});

describe("homepage builder page authorization", () => {
  it("requires HOMEPAGE_MANAGE on the server page", () => {
    const page = readFileSync(
      path.join(
        fileURLToPath(new URL("../../app/(workspace)/homepage/page.tsx", import.meta.url)),
      ),
      "utf8",
    );
    assert.equal(page.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(page.includes("requireCapability"), true);
    assert.equal(page.includes("env.SITE_URL"), true);
    assert.equal(page.includes("localhost"), false);
  });
});

describe("homepage builder hero thumbnail contracts", () => {
  it("batches editor HERO thumbnails instead of per-card media fetches", () => {
    const presentation = readFileSync(
      path.join(
        fileURLToPath(new URL("./builder-presentation.ts", import.meta.url)),
      ),
      "utf8",
    );
    const pool = readFileSync(
      path.join(
        fileURLToPath(
          new URL("../../components/homepage-builder-content-pool.tsx", import.meta.url),
        ),
      ),
      "utf8",
    );
    const contentRoute = readFileSync(
      path.join(
        fileURLToPath(new URL("../../app/api/content/route.ts", import.meta.url)),
      ),
      "utf8",
    );

    assert.equal(presentation.includes("loadEditorHeroThumbnailsByVersionIds"), true);
    assert.equal(presentation.includes("revalidateTag"), false);
    assert.equal(presentation.includes("getEditorMediaDetail"), false);
    assert.equal(pool.includes("/api/media/"), false);
    assert.equal(pool.includes("heroThumbnail"), true);
    assert.equal(contentRoute.includes("MEDIA_PUBLIC_BASE_URL"), true);
    assert.equal(contentRoute.includes("NEXT_PUBLIC_MEDIA"), false);
    assert.equal(contentRoute.includes("listEditorContent"), true);
  });
});
