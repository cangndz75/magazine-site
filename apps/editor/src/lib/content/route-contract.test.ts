import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.join(
  fileURLToPath(new URL("../../app/api", import.meta.url)),
);
const contentRoots = [
  path.join(apiRoot, "content"),
  path.join(apiRoot, "lookups"),
  path.join(apiRoot, "review-queue"),
];

function walkRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(full));
    } else if (entry.name === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

const LIFECYCLE_SQL = [
  "publicationStatus:",
  "publishedVersionId:",
  "draftVersionId:",
  "scheduledVersionId:",
  "scheduleGeneration:",
  "workflowStatus:",
];

const WRITE_SERVICES = [
  "createContent",
  "createDraftRevision",
  "updateDraftContent",
  "submitForReview",
  "approveVersion",
  "requestChanges",
  "publishVersion",
  "unpublishContent",
  "scheduleVersion",
  "rescheduleVersion",
  "unscheduleVersion",
];

const STAFF_ATTRIBUTED_MUTATION_ROUTES = [
  ["content", "route.ts"],
  ["content", "[contentItemId]", "draft", "route.ts"],
  ["content", "[contentItemId]", "editor-fields", "route.ts"],
  ["content", "[contentItemId]", "revision", "route.ts"],
  ["content", "[contentItemId]", "publish", "route.ts"],
  ["content", "[contentItemId]", "unpublish", "route.ts"],
  ["content", "[contentItemId]", "schedule", "route.ts"],
  ["content", "[contentItemId]", "reschedule", "route.ts"],
  ["content", "[contentItemId]", "unschedule", "route.ts"],
];

describe("editor content route contracts", () => {
  const files = contentRoots.flatMap((dir) => walkRouteFiles(dir));

  it("keeps lifecycle SQL out of route handlers", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const needle of LIFECYCLE_SQL) {
        assert.equal(
          source.includes(needle),
          false,
          `${file} must not assign ${needle}`,
        );
      }
      assert.equal(source.includes(".update("), false, `${file} must not update rows`);
      assert.equal(source.includes(".insert("), false, `${file} must not insert rows`);
      assert.equal(source.includes("dangerouslySetInnerHTML"), false);
    }
  });

  it("uses withEditorWrite for every unsafe content/lookup mutation", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (
        source.includes("export async function POST") ||
        source.includes("export async function PATCH")
      ) {
        assert.equal(
          source.includes("withEditorWrite"),
          true,
          `${file} must use withEditorWrite`,
        );
      }
    }
  });

  it("does not let GET-only routes import publishing writes", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const hasGet = source.includes("export async function GET");
      const hasUnsafe =
        source.includes("export async function POST") ||
        source.includes("export async function PATCH");
      if (hasGet && !hasUnsafe) {
        assert.equal(
          source.includes("withEditorWrite"),
          false,
          `${file} GET must not mutate`,
        );
        for (const service of WRITE_SERVICES) {
          assert.equal(
            source.includes(service),
            false,
            `${file} GET must not import ${service}`,
          );
        }
      }
    }
  });

  it("does not accept client-supplied staff IDs or scope in content routes", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("body.staffUserId"), false);
      assert.equal(source.includes("body.scopeMode"), false);
      assert.equal(source.includes("body.scopedCategoryIds"), false);
    }
  });

  it("attributes staff-triggered content mutations to the authenticated session actor", () => {
    for (const route of STAFF_ATTRIBUTED_MUTATION_ROUTES) {
      const file = path.join(apiRoot, ...route);
      const source = readFileSync(file, "utf8");
      assert.equal(
        source.includes("session.staffUserId"),
        true,
        `${file} must pass the authenticated staff actor`,
      );
      assert.equal(
        source.includes("CONTENT_AUDIT_ACTOR_KIND.SYSTEM"),
        false,
        `${file} must not attribute staff mutations as SYSTEM`,
      );
      assert.equal(
        source.includes("SYSTEM_AUDIT_ACTOR"),
        false,
        `${file} must not attribute staff mutations as SYSTEM`,
      );
    }
  });

  it("binds revision history and semantic diff to CONTENT_READ and the review queue to CONTENT_REVIEW", () => {
    const revisions = readFileSync(
      path.join(apiRoot, "content", "[contentItemId]", "revisions", "route.ts"),
      "utf8",
    );
    const diff = readFileSync(
      path.join(apiRoot, "content", "[contentItemId]", "diff", "route.ts"),
      "utf8",
    );
    const queue = readFileSync(
      path.join(apiRoot, "review-queue", "route.ts"),
      "utf8",
    );
    assert.equal(revisions.includes("CAPABILITY.CONTENT_READ"), true);
    assert.equal(revisions.includes("loadAccessibleContent"), true);
    assert.equal(revisions.includes("listContentRevisionHistory"), true);
    assert.equal(diff.includes("CAPABILITY.CONTENT_READ"), true);
    assert.equal(diff.includes("loadAccessibleContent"), true);
    assert.equal(diff.includes("getContentVersionDiff"), true);
    assert.equal(diff.includes("withEditorRead"), true);
    assert.equal(diff.includes("withEditorWrite"), false);
    assert.equal(queue.includes("CAPABILITY.CONTENT_REVIEW"), true);
    assert.equal(queue.includes("listReviewQueue"), true);
    assert.equal(queue.includes("queryScopeFromSession"), true);
  });

  it("binds review history to CONTENT_READ and review actions to CONTENT_REVIEW", () => {
    const history = readFileSync(
      path.join(apiRoot, "content", "[contentItemId]", "review-history", "route.ts"),
      "utf8",
    );
    const approve = readFileSync(
      path.join(apiRoot, "content", "[contentItemId]", "approve", "route.ts"),
      "utf8",
    );
    const requestChanges = readFileSync(
      path.join(apiRoot, "content", "[contentItemId]", "request-changes", "route.ts"),
      "utf8",
    );
    assert.equal(history.includes("CAPABILITY.CONTENT_READ"), true);
    assert.equal(history.includes("loadAccessibleContent"), true);
    assert.equal(history.includes("listContentReviewHistory"), true);
    assert.equal(approve.includes("CAPABILITY.CONTENT_REVIEW"), true);
    assert.equal(approve.includes("session.staffUserId"), true);
    assert.equal(requestChanges.includes("CAPABILITY.CONTENT_REVIEW"), true);
    assert.equal(requestChanges.includes("session.staffUserId"), true);
  });
});
