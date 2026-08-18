import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parsePublishHomepageBody, parseSetHomepageSlotBody } from "./builder-payload";
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
});

describe("homepage builder eligibility", () => {
  const builder: HomepageBuilderView = {
    updatedAt: "2026-08-18T12:00:00.000Z",
    published: null,
    draft: {
      versionId: "draft-1",
      publishedAt: null,
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
      },
    },
  };

  it("treats empty slots as informational not blocking", () => {
    assert.equal(countEmptySlots(builder), 6);
    const eligibility = analyzePublishEligibility(builder);
    assert.equal(eligibility.blockingCount, 1);
    assert.equal(eligibility.emptyCount, 6);
  });
});

describe("homepage builder API routes", () => {
  it("uses HOMEPAGE_MANAGE and editor write wrapper for mutations", () => {
    const slots = readFileSync(path.join(homepageApiRoot, "builder/slots/route.ts"), "utf8");
    const publish = readFileSync(
      path.join(homepageApiRoot, "builder/publish/route.ts"),
      "utf8",
    );
    const get = readFileSync(path.join(homepageApiRoot, "builder/route.ts"), "utf8");

    assert.equal(slots.includes("withEditorWrite"), true);
    assert.equal(slots.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(slots.includes("session.staffUserId"), true);

    assert.equal(publish.includes("withEditorWrite"), true);
    assert.equal(publish.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
    assert.equal(publish.includes("session.staffUserId"), true);

    assert.equal(get.includes("withEditorRead"), true);
    assert.equal(get.includes("CAPABILITY.HOMEPAGE_MANAGE"), true);
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
