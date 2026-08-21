import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CREDIBILITY } from "../credibility";
import { ENTITY_KIND } from "../entity-kind";
import { ENTITY_ROLE } from "../entity-role";
import { PUBLICATION_STATUS } from "../publication-status";
import { PUBLIC_LEGAL_NOTICE_KIND } from "../public-legal";
import { STAFF_ROLE } from "../staff-role";
import {
  ENTITY_ALIAS_MAX_COUNT,
  ENTITY_DELETION_POLICY,
  ENTITY_DUPLICATE_WARNING,
  ENTITY_ERROR,
  ENTITY_KIND_JSON_LD_TYPE,
  ENTITY_MERGE_PRESERVE,
  ENTITY_STATUS,
  ENTITY_TEXT_MAX,
  PUBLIC_ENTITY_PROJECTION_KEYS,
  articleLegalHoldFreezesRelatedEntity,
  assertEntityExpectedUpdatedAt,
  assertEntityVersionRelations,
  authorizeEntityManage,
  authorizeEntityRead,
  authorizeEntitySelect,
  authorizeEntityWrite,
  canonicalizeEntityAlias,
  canonicalizeEntityAliasSet,
  canonicalizeEntityCanonicalName,
  canonicalizeEntityProfileWrite,
  canonicalizeEntitySlug,
  collectAdvisoryDuplicateSignals,
  collectAmbiguousAliases,
  decideEntityMerge,
  decideEntityUpdate,
  draftEntityRelationLeaksIntoPublic,
  entityIdentityEquals,
  entityJsonLdType,
  entityRelationEndorsesArticleClaims,
  entitySlugIsAvailable,
  entityStatusFromLegacyIsActive,
  featuredEntityIds,
  isPublicEntityProfileEligible,
  isPublicEntityRedirect,
  legacyIsActiveFromEntityStatus,
  normalizeEntitySearchKey,
  publicEntityCanonicalUrl,
  publicEntityIdsForVersion,
  publicEntityRelationVersionId,
  PUBLIC_ENTITY_LOOKUP,
  relatedStoryLegalMarker,
  resolvePublicEntitySlugLookup,
  selectPublicEntityRelatedStories,
  entityMayBeAssignedToVersion,
  summarizeEntityAuditScalars,
  toPublicEntityProjection,
  toPublicEntitySeoInput,
  type EntityVersionRelation,
  type PublicEntityRelatedStory,
} from "./index";

const PERSON_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_PUBLISHED = "33333333-3333-4333-8333-333333333333";
const VERSION_DRAFT = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-08-21T12:00:00.000Z");

describe("entity identity", () => {
  it("treats entityId as durable identity independent of name and slug", () => {
    const before = {
      entityId: PERSON_ID,
      canonicalName: "Hande Erçel",
      slug: "hande-ercel",
    };
    const after = {
      entityId: PERSON_ID,
      canonicalName: "Hande Ercel",
      slug: "hande-ercel-oyuncu",
    };
    assert.equal(entityIdentityEquals(before, after), true);
    assert.equal(before.canonicalName === after.canonicalName, false);
    assert.equal(before.slug === after.slug, false);
    assert.equal(
      entityIdentityEquals({ entityId: PERSON_ID }, { entityId: OTHER_ID }),
      false,
    );
  });
});

describe("canonical name", () => {
  it("rejects blank and oversized names", () => {
    assert.deepEqual(canonicalizeEntityCanonicalName("   "), {
      ok: false,
      code: ENTITY_ERROR.INVALID_NAME,
    });
    assert.deepEqual(canonicalizeEntityCanonicalName(""), {
      ok: false,
      code: ENTITY_ERROR.INVALID_NAME,
    });
    assert.deepEqual(
      canonicalizeEntityCanonicalName("a".repeat(ENTITY_TEXT_MAX.CANONICAL_NAME + 1)),
      { ok: false, code: ENTITY_ERROR.INVALID_NAME },
    );
  });

  it("trims, compacts whitespace, and preserves Turkish characters", () => {
    assert.deepEqual(canonicalizeEntityCanonicalName("  Hande   Erçel  "), {
      ok: true,
      value: "Hande Erçel",
    });
    assert.deepEqual(canonicalizeEntityCanonicalName("Işıl Şahin"), {
      ok: true,
      value: "Işıl Şahin",
    });
    assert.deepEqual(canonicalizeEntityCanonicalName("Çağla Ğüö"), {
      ok: true,
      value: "Çağla Ğüö",
    });
  });

  it("does not lowercase or ASCII-fold the display name", () => {
    const result = canonicalizeEntityCanonicalName("Hande Erçel");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value, "Hande Erçel");
      assert.equal(result.value.includes("ç"), true);
      assert.equal(result.value.toLowerCase() === result.value, false);
    }
  });
});

describe("entity slug", () => {
  it("normalizes a valid slug", () => {
    assert.deepEqual(canonicalizeEntitySlug("Hande-Ercel"), {
      ok: true,
      value: "hande-ercel",
    });
  });

  it("rejects malformed slugs and path/URL semantics", () => {
    assert.equal(canonicalizeEntitySlug("").ok, false);
    assert.equal(canonicalizeEntitySlug("Hande Erçel").ok, false);
    assert.equal(canonicalizeEntitySlug("foo/bar").ok, false);
    assert.equal(canonicalizeEntitySlug("../etc").ok, false);
    assert.equal(canonicalizeEntitySlug("https://example.com/x").ok, false);
    assert.equal(canonicalizeEntitySlug("hande?x=1").ok, false);
    assert.equal(canonicalizeEntitySlug("hande#bio").ok, false);
    assert.equal(canonicalizeEntitySlug("-leading").ok, false);
    assert.equal(canonicalizeEntitySlug("trailing-").ok, false);
  });

  it("keeps slug occupancy in the entity namespace, not as identity", () => {
    assert.equal(
      entitySlugIsAvailable({
        entityId: PERSON_ID,
        occupancy: {
          currentSlugEntityId: OTHER_ID,
          historicalSlugEntityId: null,
        },
      }),
      false,
    );
    assert.equal(
      entitySlugIsAvailable({
        entityId: PERSON_ID,
        occupancy: {
          currentSlugEntityId: null,
          historicalSlugEntityId: OTHER_ID,
        },
      }),
      false,
    );
    assert.equal(
      entitySlugIsAvailable({
        entityId: PERSON_ID,
        occupancy: {
          currentSlugEntityId: PERSON_ID,
          historicalSlugEntityId: PERSON_ID,
        },
      }),
      true,
    );
  });

  it("builds a prefixed public canonical URL from the trusted origin", () => {
    assert.equal(
      publicEntityCanonicalUrl("https://www.example.com/", "hande-ercel"),
      "https://www.example.com/kimdir/hande-ercel",
    );
  });
});

describe("aliases", () => {
  it("trims aliases and preserves display Unicode", () => {
    assert.deepEqual(canonicalizeEntityAlias("  Hande Erçel  "), {
      ok: true,
      value: { display: "Hande Erçel", searchKey: "hande erçel" },
    });
  });

  it("rejects empty, oversized, and duplicate normalized aliases", () => {
    assert.deepEqual(canonicalizeEntityAlias("  "), {
      ok: false,
      code: ENTITY_ERROR.INVALID_ALIAS,
    });
    assert.equal(
      canonicalizeEntityAlias("x".repeat(ENTITY_TEXT_MAX.ALIAS + 1)).ok,
      false,
    );
    assert.deepEqual(
      canonicalizeEntityAliasSet(["Hande", "hande"]),
      { ok: false, code: ENTITY_ERROR.DUPLICATE_ALIAS },
    );
    assert.equal(
      canonicalizeEntityAliasSet(Array.from({ length: ENTITY_ALIAS_MAX_COUNT + 1 }, (_, i) => `alias-${i}`)).ok,
      false,
    );
  });

  it("detects an ambiguous shared alias without merging entities", () => {
    const ambiguous = collectAmbiguousAliases([
      { entityId: PERSON_ID, searchKey: "hande" },
      { entityId: OTHER_ID, searchKey: "Hande" },
      { entityId: PERSON_ID, searchKey: "erçel" },
    ]);
    assert.deepEqual(ambiguous, [
      { searchKey: "hande", entityIds: [PERSON_ID, OTHER_ID] },
    ]);
    const merge = decideEntityMerge({
      survivingEntityId: PERSON_ID,
      retiredEntityId: OTHER_ID,
    });
    assert.equal(merge.ok, true);
    if (merge.ok) {
      assert.equal(merge.value.retiredStatus, ENTITY_STATUS.ARCHIVED);
      assert.deepEqual([...merge.value.preserve], [...ENTITY_MERGE_PRESERVE]);
    }
  });
});

describe("status and public eligibility", () => {
  it("does not publish draft or archived entity profiles", () => {
    assert.equal(
      isPublicEntityProfileEligible({
        status: ENTITY_STATUS.DRAFT,
        slug: "hande-ercel",
      }),
      false,
    );
    assert.equal(
      isPublicEntityProfileEligible({
        status: ENTITY_STATUS.ARCHIVED,
        slug: "hande-ercel",
      }),
      false,
    );
    assert.equal(
      isPublicEntityProfileEligible({
        status: ENTITY_STATUS.ACTIVE,
        slug: "hande-ercel",
      }),
      true,
    );
  });

  it("maps the legacy is_active flag without inventing DRAFT", () => {
    assert.equal(entityStatusFromLegacyIsActive(true), ENTITY_STATUS.ACTIVE);
    assert.equal(entityStatusFromLegacyIsActive(false), ENTITY_STATUS.ARCHIVED);
    assert.equal(legacyIsActiveFromEntityStatus(ENTITY_STATUS.ACTIVE), true);
    assert.equal(legacyIsActiveFromEntityStatus(ENTITY_STATUS.DRAFT), false);
    assert.equal(legacyIsActiveFromEntityStatus(ENTITY_STATUS.ARCHIVED), false);
  });

  it("archives without destroying relations and treats merge as redirect", () => {
    assert.equal(ENTITY_DELETION_POLICY.ARCHIVE_KEEPS_CONTENT_VERSION_RELATIONS, true);
    assert.equal(ENTITY_DELETION_POLICY.ORDINARY_WORKFLOW, "ARCHIVE");
    assert.equal(
      isPublicEntityRedirect({ mergedIntoEntityId: OTHER_ID }),
      true,
    );
    assert.equal(
      isPublicEntityProfileEligible({
        status: ENTITY_STATUS.ACTIVE,
        slug: "hande-ercel",
        mergedIntoEntityId: OTHER_ID,
      }),
      false,
    );
  });
});

describe("profile write", () => {
  it("accepts a bounded PERSON profile and rejects non-person birth data", () => {
    const person = canonicalizeEntityProfileWrite({
      kind: ENTITY_KIND.PERSON,
      canonicalName: "Hande Erçel",
      slug: "hande-ercel",
      summary: "Oyuncu",
      birthDate: "1993-11-24",
      occupation: "Oyuncu",
      officialWebsiteUrl: "https://example.com",
      aliases: ["Hande Ercel"],
    });
    assert.equal(person.ok, true);
    if (person.ok) {
      assert.equal(person.value.status, ENTITY_STATUS.DRAFT);
      assert.equal(person.value.canonicalName, "Hande Erçel");
      assert.equal(person.value.aliases[0]?.display, "Hande Ercel");
    }

    assert.deepEqual(
      canonicalizeEntityProfileWrite({
        kind: ENTITY_KIND.BRAND,
        canonicalName: "Bir Marka",
        slug: "bir-marka",
        birthDate: "1990-01-01",
      }),
      { ok: false, code: ENTITY_ERROR.INVALID_PROFILE },
    );
  });

  it("rejects unsafe official URLs and invalid portrait ids", () => {
    assert.equal(
      canonicalizeEntityProfileWrite({
        kind: ENTITY_KIND.PERSON,
        canonicalName: "Ada",
        slug: "ada",
        officialWebsiteUrl: "javascript:alert(1)",
      }).ok,
      false,
    );
    assert.equal(
      canonicalizeEntityProfileWrite({
        kind: ENTITY_KIND.PERSON,
        canonicalName: "Ada",
        slug: "ada",
        portraitMediaId: "not-a-uuid",
      }).ok,
      false,
    );
  });
});

describe("content version relations", () => {
  it("allows multiple entities and multiple SUBJECT roles without a unique PRIMARY", () => {
    const relations = assertEntityVersionRelations([
      { entityId: PERSON_ID, role: ENTITY_ROLE.SUBJECT, sortOrder: 0 },
      { entityId: OTHER_ID, role: ENTITY_ROLE.SUBJECT, sortOrder: 1 },
    ]);
    assert.equal(relations.ok, true);
    if (relations.ok) {
      assert.deepEqual(featuredEntityIds(relations.value), [PERSON_ID, OTHER_ID]);
    }
  });

  it("uses only the published version as public relation authority", () => {
    const relationsByVersionId = new Map<string, EntityVersionRelation[]>([
      [
        VERSION_PUBLISHED,
        [{ entityId: PERSON_ID, role: ENTITY_ROLE.SUBJECT, sortOrder: 0 }],
      ],
      [
        VERSION_DRAFT,
        [
          { entityId: PERSON_ID, role: ENTITY_ROLE.SUBJECT, sortOrder: 0 },
          { entityId: OTHER_ID, role: ENTITY_ROLE.MENTIONED, sortOrder: 1 },
        ],
      ],
    ]);

    assert.deepEqual(
      publicEntityIdsForVersion({
        publishedVersionId: VERSION_PUBLISHED,
        draftVersionId: VERSION_DRAFT,
        relationsByVersionId,
      }),
      [PERSON_ID],
    );
    assert.equal(
      draftEntityRelationLeaksIntoPublic({
        publishedVersionId: VERSION_PUBLISHED,
        draftVersionId: VERSION_DRAFT,
        relationsByVersionId,
        entityId: OTHER_ID,
      }),
      true,
    );
    assert.equal(
      publicEntityRelationVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: VERSION_PUBLISHED,
        relationVersionId: VERSION_DRAFT,
      }),
      null,
    );
    assert.equal(
      publicEntityRelationVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: VERSION_PUBLISHED,
        relationVersionId: VERSION_PUBLISHED,
      }),
      VERSION_PUBLISHED,
    );
  });

  it("does not treat entity linking as factual endorsement", () => {
    assert.equal(entityRelationEndorsesArticleClaims(), false);
  });
});

describe("legal and related content", () => {
  it("keeps correction/clarification stories public and excludes withdrawn articles", () => {
    assert.equal(
      relatedStoryLegalMarker([
        {
          kind: PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION,
          publicNote: null,
          effectiveAt: NOW,
        },
        {
          kind: PUBLIC_LEGAL_NOTICE_KIND.CORRECTION,
          publicNote: "Tarih düzeltildi.",
          effectiveAt: NOW,
        },
      ]),
      PUBLIC_LEGAL_NOTICE_KIND.CORRECTION,
    );

    assert.equal(
      publicEntityRelationVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: VERSION_PUBLISHED,
        relationVersionId: VERSION_PUBLISHED,
        retractedAt: NOW,
      }),
      null,
    );
    assert.equal(
      publicEntityRelationVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: VERSION_PUBLISHED,
        relationVersionId: VERSION_PUBLISHED,
        takedownAt: NOW,
      }),
      null,
    );
    assert.equal(articleLegalHoldFreezesRelatedEntity(), false);
  });

  it("orders related stories by publishedAt descending with bounded pagination", () => {
    const stories: PublicEntityRelatedStory[] = [
      {
        contentItemId: "b",
        publishedVersionId: VERSION_PUBLISHED,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        role: ENTITY_ROLE.SUBJECT,
        credibility: CREDIBILITY.CLAIM,
        legalNoticeKind: null,
      },
      {
        contentItemId: "a",
        publishedVersionId: VERSION_PUBLISHED,
        publishedAt: new Date("2026-08-01T00:00:00.000Z"),
        role: ENTITY_ROLE.MENTIONED,
        credibility: CREDIBILITY.CONFIRMED,
        legalNoticeKind: PUBLIC_LEGAL_NOTICE_KIND.CORRECTION,
      },
    ];
    const page = selectPublicEntityRelatedStories(stories, { limit: 1 });
    assert.equal(page.length, 1);
    assert.equal(page[0]?.contentItemId, "a");
    assert.equal(page[0]?.credibility, CREDIBILITY.CONFIRMED);
  });
});

describe("search normalization and duplicates", () => {
  it("uses Turkish case folding without ASCII stripping", () => {
    assert.equal(normalizeEntitySearchKey("Işıl"), "ışıl");
    assert.equal(normalizeEntitySearchKey("İpek"), "ipek");
    assert.equal(normalizeEntitySearchKey("Hande Erçel"), "hande erçel");
    assert.equal(normalizeEntitySearchKey("HANDEş"), "handeş");
    assert.notEqual(normalizeEntitySearchKey("Işıl"), "işıl");
    assert.equal(normalizeEntitySearchKey("Hande Erçel").includes("ç"), true);
  });

  it("warns on exact search-key matches without merging", () => {
    const signals = collectAdvisoryDuplicateSignals({
      canonicalName: "Hande Erçel",
      aliases: ["Hande Ercel"],
      existing: [
        {
          entityId: OTHER_ID,
          canonicalName: "hande erçel",
          aliases: ["H. Erçel"],
        },
      ],
    });
    assert.equal(signals.some((signal) => signal.kind === "CANONICAL_NAME"), true);
    assert.equal(ENTITY_DUPLICATE_WARNING.includes("Benzer"), true);
    assert.deepEqual(
      decideEntityMerge({
        survivingEntityId: PERSON_ID,
        retiredEntityId: PERSON_ID,
      }),
      { ok: false, code: ENTITY_ERROR.INVALID_MERGE },
    );
  });
});

describe("public / editor data boundary", () => {
  it("projects only explicitly safe public fields", () => {
    const publicProfile = toPublicEntityProjection({
      entityId: PERSON_ID,
      kind: ENTITY_KIND.PERSON,
      canonicalName: "Hande Erçel",
      slug: "hande-ercel",
      summary: "Oyuncu",
      biography: "Kısa biyografi.",
      occupation: "Oyuncu",
      birthDate: "1993-11-24",
      officialWebsiteUrl: "https://example.com/",
      aliases: [{ display: "Hande Ercel" }],
      portrait: {
        url: "https://cdn.example.com/p.jpg",
        width: 800,
        height: 1000,
        altText: "Portre",
        credit: "Fotoğrafçı",
      },
    });

    assert.deepEqual(Object.keys(publicProfile).sort(), [...PUBLIC_ENTITY_PROJECTION_KEYS].sort());
    assert.equal("storageKey" in publicProfile, false);
    assert.equal("staffUserId" in publicProfile, false);
    assert.equal("updatedAt" in publicProfile, false);
    assert.equal("deletedAt" in publicProfile, false);
    assert.equal("mergedIntoEntityId" in publicProfile, false);
    assert.equal("audit" in publicProfile, false);
    assert.deepEqual(publicProfile.alternateNames, ["Hande Ercel"]);
  });

  it("does not invent unstructured SEO identity fields", () => {
    const seo = toPublicEntitySeoInput({
      canonicalName: "Hande Erçel",
      canonicalUrl: "https://www.example.com/kimdir/hande-ercel",
      summary: "Oyuncu",
      portraitUrl: null,
      officialWebsiteUrl: null,
      birthDate: null,
      occupation: null,
    });
    assert.equal(seo.sameAs, null);
    assert.equal(seo.birthDate, null);
    assert.equal(seo.jobTitle, null);
    assert.equal("spouse" in seo, false);
    assert.equal("birthPlace" in seo, false);
    assert.equal(entityJsonLdType(ENTITY_KIND.PERSON), ENTITY_KIND_JSON_LD_TYPE.PERSON);
  });
});

describe("rbac, concurrency, and audit summaries", () => {
  it("lets authors select entities but not administer the catalog", () => {
    assert.deepEqual(authorizeEntityRead({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: true,
      value: true,
    });
    assert.deepEqual(authorizeEntitySelect({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: true,
      value: true,
    });
    assert.deepEqual(authorizeEntityWrite({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: false,
      code: ENTITY_ERROR.FORBIDDEN,
    });
    assert.deepEqual(authorizeEntityWrite({ roles: [STAFF_ROLE.EDITOR] }), {
      ok: true,
      value: true,
    });
    assert.deepEqual(authorizeEntityManage({ roles: [STAFF_ROLE.EDITOR] }), {
      ok: false,
      code: ENTITY_ERROR.FORBIDDEN,
    });
    assert.deepEqual(authorizeEntityManage({ roles: [STAFF_ROLE.SUPER_ADMIN] }), {
      ok: true,
      value: true,
    });
  });

  it("fails stale updates and omits biography blobs from audit summaries", () => {
    assert.deepEqual(
      assertEntityExpectedUpdatedAt({
        currentUpdatedAt: NOW,
        expectedUpdatedAt: new Date("2026-08-21T11:59:59.000Z"),
      }),
      { ok: false, code: ENTITY_ERROR.ENTITY_WRITE_CONFLICT },
    );

    const update = decideEntityUpdate({
      current: {
        entityId: PERSON_ID,
        slug: "hande-ercel",
        status: ENTITY_STATUS.ACTIVE,
        deletedAt: null,
        mergedIntoEntityId: null,
        updatedAt: NOW,
      },
      expectedUpdatedAt: NOW,
      write: {
        kind: ENTITY_KIND.PERSON,
        canonicalName: "Hande Erçel",
        slug: "hande-ercel-oyuncu",
        status: ENTITY_STATUS.ACTIVE,
        biography: "x".repeat(200),
      },
    });
    assert.equal(update.ok, true);
    if (update.ok) {
      assert.equal(update.value.slugChanged, true);
    }

    const summary = summarizeEntityAuditScalars({
      before: {
        kind: ENTITY_KIND.PERSON,
        status: ENTITY_STATUS.ACTIVE,
        canonicalName: "Hande Erçel",
        slug: "hande-ercel",
        summary: "Oyuncu",
        portraitMediaId: null,
        birthDate: null,
        occupation: null,
        officialWebsiteUrl: null,
        aliasCount: 0,
        mergedIntoEntityId: null,
      },
      after: {
        kind: ENTITY_KIND.PERSON,
        status: ENTITY_STATUS.ACTIVE,
        canonicalName: "Hande Erçel",
        slug: "hande-ercel-oyuncu",
        summary: "Oyuncu",
        portraitMediaId: null,
        birthDate: null,
        occupation: null,
        officialWebsiteUrl: null,
        aliasCount: 1,
        mergedIntoEntityId: null,
      },
    });
    assert.deepEqual(
      summary.map((item) => item.field),
      ["slug", "aliasCount"],
    );
    assert.equal(
      JSON.stringify(summary).includes("x".repeat(50)),
      false,
    );
  });
});

describe("public slug lookup and assignment", () => {
  it("redirects historical slugs only when the current profile is public", () => {
    const archived = resolvePublicEntitySlugLookup({
      requestedSlug: "hande",
      current: null,
      historicalOwner: {
        entityId: PERSON_ID,
        slug: "hande-ercel",
        status: ENTITY_STATUS.ARCHIVED,
      },
    });
    assert.equal(archived.kind, PUBLIC_ENTITY_LOOKUP.NOT_FOUND);

    const redirect = resolvePublicEntitySlugLookup({
      requestedSlug: "hande",
      current: null,
      historicalOwner: {
        entityId: PERSON_ID,
        slug: "hande-ercel",
        status: ENTITY_STATUS.ACTIVE,
      },
    });
    assert.equal(redirect.kind, PUBLIC_ENTITY_LOOKUP.REDIRECT);
    if (redirect.kind === PUBLIC_ENTITY_LOOKUP.REDIRECT) {
      assert.equal(redirect.slug, "hande-ercel");
    }
  });

  it("keeps archived relations on a version but rejects new archived links", () => {
    assert.equal(
      entityMayBeAssignedToVersion({
        status: ENTITY_STATUS.ACTIVE,
        alreadyLinked: false,
      }).ok,
      true,
    );
    assert.equal(
      entityMayBeAssignedToVersion({
        status: ENTITY_STATUS.ARCHIVED,
        alreadyLinked: true,
      }).ok,
      true,
    );
    assert.equal(
      entityMayBeAssignedToVersion({
        status: ENTITY_STATUS.ARCHIVED,
        alreadyLinked: false,
      }).ok,
      false,
    );
    assert.equal(
      entityMayBeAssignedToVersion({
        status: ENTITY_STATUS.DRAFT,
        alreadyLinked: false,
      }).ok,
      false,
    );
  });
});
