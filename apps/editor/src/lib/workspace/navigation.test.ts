import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkspaceNavigation,
  findActiveWorkspaceHref,
  type WorkspaceNavigationInput,
} from "./navigation";

function hrefs(input: WorkspaceNavigationInput): string[] {
  return buildWorkspaceNavigation(input).flatMap((group) =>
    group.items.map((item) => item.href),
  );
}

describe("workspace navigation", () => {
  it("keeps author IA limited to content routes derived from capabilities", () => {
    assert.deepEqual(
      hrefs({
        canReadContent: true,
        canReview: false,
        canPublish: false,
        canManageHomepage: false,
        canLegal: false,
        canManageStaff: false,
        canManageEntities: false,
        canReadAnalytics: false,
      }),
      ["/", "/media", "/videos", "/seo"],
    );
  });

  it("adds editor review and analytics without staff or homepage controls", () => {
    const editorHrefs = hrefs({
      canReadContent: true,
      canReview: true,
      canPublish: true,
      canManageHomepage: false,
      canLegal: false,
      canManageStaff: false,
      canManageEntities: false,
      canReadAnalytics: true,
    });

    assert.equal(editorHrefs.includes("/calendar"), true);
    assert.equal(editorHrefs.includes("/review"), true);
    assert.equal(editorHrefs.includes("/analytics"), true);
    assert.equal(editorHrefs.includes("/dashboard"), false);
    assert.equal(editorHrefs.includes("/staff"), false);
    assert.equal(editorHrefs.includes("/homepage"), false);
  });

  it("exposes super admin management routes when capabilities allow them", () => {
    assert.deepEqual(
      hrefs({
        canReadContent: true,
        canReview: true,
        canPublish: true,
        canManageHomepage: true,
        canLegal: true,
        canManageStaff: true,
        canManageEntities: true,
        canReadAnalytics: true,
      }),
      [
        "/",
        "/media",
        "/videos",
        "/calendar",
        "/review",
        "/homepage",
        "/legal",
        "/seo",
        "/analytics",
        "/entities",
        "/dashboard",
        "/site-health",
        "/staff",
      ],
    );
  });

  it("resolves nested active routes without treating every path as root", () => {
    const groups = buildWorkspaceNavigation({
      canReadContent: true,
      canReview: true,
      canPublish: true,
      canManageHomepage: true,
      canLegal: true,
      canManageStaff: true,
      canManageEntities: true,
      canReadAnalytics: true,
    });

    assert.equal(findActiveWorkspaceHref("/", groups), "/");
    assert.equal(findActiveWorkspaceHref("/calendar", groups), "/calendar");
    assert.equal(findActiveWorkspaceHref("/review/detail", groups), "/review");
    assert.equal(findActiveWorkspaceHref("/seo/content-1", groups), "/seo");
  });
});
