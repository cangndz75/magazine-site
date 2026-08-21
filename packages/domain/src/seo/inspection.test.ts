import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "../staff-role";
import { STAFF_SCOPE_MODE } from "../staff-scope-mode";
import {
  DISCOVER_READINESS,
  SEO_FINDING_FILTER,
  SEO_INSPECTION_ERROR,
  SEO_SLUG_GOVERNANCE,
  authorizeSeoInspection,
  canAccessSeoInspectionItem,
  matchesDiscoverReadinessFilter,
  matchesSeoFindingFilter,
  parseSeoFindingFilter,
  parseSeoInspectionBoolean,
  parseSeoLegalWithdrawalFilter,
  seoInspectionGovernance,
  seoInspectionLeaksSensitiveMaterial,
  isMissingSeoTitle,
  SEO_LEGAL_WITHDRAWAL_FILTER,
} from "./index";

describe("SEO inspection authorization and data boundary", () => {
  it("reuses CONTENT_READ so Super Admin and Editors can inspect, authors can read, and empty roles cannot", () => {
    assert.equal(authorizeSeoInspection({ roles: [STAFF_ROLE.SUPER_ADMIN] }).ok, true);
    assert.equal(authorizeSeoInspection({ roles: [STAFF_ROLE.EDITOR] }).ok, true);
    assert.equal(authorizeSeoInspection({ roles: [STAFF_ROLE.AUTHOR] }).ok, true);
    const denied = authorizeSeoInspection({ roles: [] });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.code, SEO_INSPECTION_ERROR.FORBIDDEN);
    }
  });

  it("does not let a scoped Editor inspect unauthorized category content", () => {
    const allowed = canAccessSeoInspectionItem({
      roles: [STAFF_ROLE.EDITOR],
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      scopedCategoryIds: ["cat-a"],
      primaryCategoryId: "cat-a",
    });
    const denied = canAccessSeoInspectionItem({
      roles: [STAFF_ROLE.EDITOR],
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      scopedCategoryIds: ["cat-a"],
      primaryCategoryId: "cat-b",
    });
    const superAdmin = canAccessSeoInspectionItem({
      roles: [STAFF_ROLE.SUPER_ADMIN],
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      scopedCategoryIds: [],
      primaryCategoryId: "cat-b",
    });
    assert.equal(allowed, true);
    assert.equal(denied, false);
    assert.equal(superAdmin, true);
  });

  it("rejects storage keys, legal internal notes, unpublished body, and staff secrets", () => {
    assert.equal(
      seoInspectionLeaksSensitiveMaterial({
        contentItemId: "1",
        title: "Haber",
        slug: "haber",
      }),
      false,
    );
    assert.equal(seoInspectionLeaksSensitiveMaterial({ storageKey: "itest/a.jpg" }), true);
    assert.equal(seoInspectionLeaksSensitiveMaterial({ internalNote: "counsel" }), true);
    assert.equal(seoInspectionLeaksSensitiveMaterial({ licenseNote: "contract" }), true);
    assert.equal(seoInspectionLeaksSensitiveMaterial({ body: { blocks: [] } }), true);
    assert.equal(seoInspectionLeaksSensitiveMaterial({ passwordHash: "x" }), true);
  });

  it("filters ERROR/WARNING summaries once slug redirect history is implemented", () => {
    assert.equal(
      matchesSeoFindingFilter({ errorCount: 1, warningCount: 0 }, SEO_FINDING_FILTER.ERRORS),
      true,
    );
    assert.equal(
      matchesSeoFindingFilter({ errorCount: 0, warningCount: 2 }, SEO_FINDING_FILTER.WARNINGS),
      true,
    );
    assert.equal(
      matchesSeoFindingFilter({ errorCount: 0, warningCount: 0 }, SEO_FINDING_FILTER.ERRORS),
      false,
    );
    assert.equal(
      matchesSeoFindingFilter({ errorCount: 0, warningCount: 0 }, SEO_FINDING_FILTER.HEALTHY),
      true,
    );
    assert.equal(
      matchesSeoFindingFilter({ errorCount: 0, warningCount: 1 }, SEO_FINDING_FILTER.HEALTHY),
      false,
    );
    const governance = seoInspectionGovernance();
    assert.equal(governance.slugRedirectHistoryImplemented, true);
    assert.equal(SEO_SLUG_GOVERNANCE.REDIRECT_HISTORY_IMPLEMENTED, true);
  });

  it("parses command-center query tokens without inventing values", () => {
    assert.equal(parseSeoFindingFilter(undefined), undefined);
    assert.equal(parseSeoFindingFilter("HEALTHY"), SEO_FINDING_FILTER.HEALTHY);
    assert.equal(parseSeoFindingFilter("BROKEN"), null);
    assert.equal(parseSeoInspectionBoolean("1"), true);
    assert.equal(parseSeoInspectionBoolean("false"), false);
    assert.equal(parseSeoInspectionBoolean("maybe"), null);
    assert.equal(
      parseSeoLegalWithdrawalFilter("ANY"),
      SEO_LEGAL_WITHDRAWAL_FILTER.ANY,
    );
    assert.equal(parseSeoLegalWithdrawalFilter("HOLD"), null);
    assert.equal(isMissingSeoTitle("  "), true);
    assert.equal(isMissingSeoTitle("Başlık"), false);
  });

  it("filters Discover readiness without inventing states", () => {
    assert.equal(
      matchesDiscoverReadinessFilter(
        { discoverReadiness: DISCOVER_READINESS.READY },
        DISCOVER_READINESS.READY,
      ),
      true,
    );
    assert.equal(
      matchesDiscoverReadinessFilter(
        { discoverReadiness: DISCOVER_READINESS.NEEDS_ATTENTION },
        DISCOVER_READINESS.READY,
      ),
      false,
    );
  });
});
