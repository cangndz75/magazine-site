import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENTITY_KIND } from "../entity-kind";
import { ENTITY_STATUS } from "./types";
import {
  ENTITY_LINK_AMBIGUITY_MESSAGE,
  ENTITY_LINK_ASSISTANT_BOUNDS,
  ENTITY_LINK_MATCHED_BY,
  ENTITY_LINK_SUGGESTION_KIND,
  clampEntityLinkCatalogue,
  collectStaleEntitySlugWarnings,
  inspectArticleTextForEntityLinks,
  matchEntityLinkSuggestions,
  parsePublicEntityProfileSlug,
  tokenizeEntityLinkText,
  type EntityLinkCatalogueEntry,
} from "./linking";
import { toPublicEntityDiscoveryDocument } from "./discovery";
import { normalizeEntitySearchKey } from "./search";

const HANDE_ID = "11111111-1111-4111-8111-111111111111";
const KEREM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

function person(input: {
  entityId: string;
  canonicalName: string;
  slug: string;
  aliases?: string[];
  status?: (typeof ENTITY_STATUS)[keyof typeof ENTITY_STATUS];
}): EntityLinkCatalogueEntry {
  return {
    entityId: input.entityId,
    canonicalName: input.canonicalName,
    slug: input.slug,
    kind: ENTITY_KIND.PERSON,
    status: input.status ?? ENTITY_STATUS.ACTIVE,
    labels: [
      {
        display: input.canonicalName,
        searchKey: normalizeEntitySearchKey(input.canonicalName),
        matchedBy: ENTITY_LINK_MATCHED_BY.CANONICAL_NAME,
      },
      ...(input.aliases ?? []).map((alias) => ({
        display: alias,
        searchKey: normalizeEntitySearchKey(alias),
        matchedBy: ENTITY_LINK_MATCHED_BY.ALIAS,
      })),
    ],
  };
}

describe("entity link matching", () => {
  it("matches canonical names with Turkish casing and word boundaries", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "HANDE ERÇEL yeni proje için İstanbul'da.",
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Hande Erçel",
          slug: "hande-ercel",
        }),
      ],
    });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]?.kind, ENTITY_LINK_SUGGESTION_KIND.MATCH);
    if (suggestions[0]?.kind === ENTITY_LINK_SUGGESTION_KIND.MATCH) {
      assert.equal(suggestions[0].entity.entityId, HANDE_ID);
      assert.equal(suggestions[0].matchedBy, ENTITY_LINK_MATCHED_BY.CANONICAL_NAME);
      assert.equal(suggestions[0].alreadyRelated, false);
    }
  });

  it("matches aliases without treating fragments as hits", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "Cansu ve Can sahneye çıktı. Cancan yok.",
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Can Yılmaz",
          slug: "can-yilmaz",
          aliases: ["Can"],
        }),
      ],
    });
    assert.equal(suggestions.length, 1);
    if (suggestions[0]?.kind === ENTITY_LINK_SUGGESTION_KIND.MATCH) {
      assert.equal(suggestions[0].matchedText, "Can");
      assert.equal(suggestions[0].matchedBy, ENTITY_LINK_MATCHED_BY.ALIAS);
    }
  });

  it("deduplicates one suggestion per entity", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "Hande Erçel ve Hande tekrar görüldü.",
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Hande Erçel",
          slug: "hande-ercel",
          aliases: ["Hande"],
        }),
      ],
    });
    assert.equal(suggestions.length, 1);
  });

  it("does not auto-select a shared alias", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "X sahneye çıktı.",
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Hande Erçel",
          slug: "hande-ercel",
          aliases: ["X"],
        }),
        person({
          entityId: KEREM_ID,
          canonicalName: "Kerem Bürsin",
          slug: "kerem-bursin",
          aliases: ["X"],
        }),
      ],
    });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]?.kind, ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS);
    if (suggestions[0]?.kind === ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS) {
      assert.equal(suggestions[0].message, ENTITY_LINK_AMBIGUITY_MESSAGE);
      assert.equal(suggestions[0].candidates.length, 2);
    }
  });

  it("marks already-related entities instead of suggesting another add", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "Hande Erçel konuştu.",
      relatedEntityIds: [HANDE_ID],
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Hande Erçel",
          slug: "hande-ercel",
        }),
      ],
    });
    assert.equal(suggestions.length, 1);
    if (suggestions[0]?.kind === ENTITY_LINK_SUGGESTION_KIND.MATCH) {
      assert.equal(suggestions[0].alreadyRelated, true);
    }
  });

  it("excludes archived catalogue rows from new suggestions", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "Hande Erçel konuştu.",
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Hande Erçel",
          slug: "hande-ercel",
          status: ENTITY_STATUS.ARCHIVED,
        }),
      ],
    });
    assert.equal(suggestions.length, 0);
  });

  it("detects an existing canonical profile link", () => {
    const suggestions = matchEntityLinkSuggestions({
      text: "Hande Erçel",
      hrefs: ["/kimdir/hande-ercel"],
      catalogue: [
        person({
          entityId: HANDE_ID,
          canonicalName: "Hande Erçel",
          slug: "hande-ercel",
        }),
      ],
    });
    if (suggestions[0]?.kind === ENTITY_LINK_SUGGESTION_KIND.MATCH) {
      assert.equal(suggestions[0].alreadyLinked, true);
    }
  });

  it("bounds catalogue size", () => {
    const rows = Array.from({ length: ENTITY_LINK_ASSISTANT_BOUNDS.MAX_CATALOGUE + 3 }, (_, i) => i);
    const clamped = clampEntityLinkCatalogue(rows);
    assert.equal(clamped.items.length, ENTITY_LINK_ASSISTANT_BOUNDS.MAX_CATALOGUE);
    assert.equal(clamped.truncated, true);
  });
});

describe("entity profile href parsing", () => {
  it("accepts relative and absolute /kimdir slugs without open redirects", () => {
    assert.equal(parsePublicEntityProfileSlug("/kimdir/hande-ercel"), "hande-ercel");
    assert.equal(
      parsePublicEntityProfileSlug("https://www.example.com/kimdir/hande-ercel"),
      "hande-ercel",
    );
    assert.equal(parsePublicEntityProfileSlug("/kimdir/../secret"), null);
    assert.equal(parsePublicEntityProfileSlug("https://evil.example/kimdir/a/b"), null);
  });

  it("surfaces stale historical slugs without rewriting", () => {
    const warnings = collectStaleEntitySlugWarnings({
      hrefs: ["/kimdir/eski-hande", "/kimdir/hande-ercel"],
      currentByOldSlug: new Map([
        [
          "eski-hande",
          {
            entityId: HANDE_ID,
            currentSlug: "hande-ercel",
            canonicalName: "Hande Erçel",
            publicEligible: true,
          },
        ],
      ]),
    });
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.currentSlug, "hande-ercel");
  });
});

describe("article text inspection", () => {
  it("reads structured blocks and link hrefs without flattening destructively", () => {
    const inspected = inspectArticleTextForEntityLinks({
      title: "Hande",
      body: {
        blocks: [
          {
            type: "paragraph",
            content: [
              { text: "Erçel " },
              {
                text: "profil",
                marks: [{ type: "link", href: "/kimdir/hande-ercel" }],
              },
            ],
          },
        ],
      },
    });
    assert.match(inspected.text, /Hande/);
    assert.match(inspected.text, /Erçel/);
    assert.deepEqual(inspected.hrefs, ["/kimdir/hande-ercel"]);
  });

  it("truncates oversized pasted articles", () => {
    const inspected = inspectArticleTextForEntityLinks({
      body: {
        blocks: [
          {
            type: "paragraph",
            text: "kelime ".repeat(ENTITY_LINK_ASSISTANT_BOUNDS.MAX_BODY_CHARS),
          },
        ],
      },
    });
    assert.equal(inspected.truncated, true);
    assert.ok(inspected.text.length <= ENTITY_LINK_ASSISTANT_BOUNDS.MAX_BODY_CHARS);
  });
});

describe("Turkish tokenization", () => {
  it("folds I/İ through the existing search key", () => {
    assert.deepEqual(
      tokenizeEntityLinkText("Işıl").map((token) => token.key),
      [normalizeEntitySearchKey("Işıl")],
    );
  });
});

describe("public entity discovery document", () => {
  it("emits only ACTIVE public-eligible fields", () => {
    const doc = toPublicEntityDiscoveryDocument({
      entityId: HANDE_ID,
      canonicalName: "Hande Erçel",
      aliases: ["Hande"],
      kind: ENTITY_KIND.PERSON,
      slug: "hande-ercel",
      status: ENTITY_STATUS.ACTIVE,
    });
    assert.equal(doc?.currentPublicSlug, "hande-ercel");
    assert.equal(doc?.status, ENTITY_STATUS.ACTIVE);
    assert.equal(
      toPublicEntityDiscoveryDocument({
        entityId: OTHER_ID,
        canonicalName: "Draft",
        aliases: [],
        kind: ENTITY_KIND.PERSON,
        slug: "draft-person",
        status: ENTITY_STATUS.DRAFT,
      }),
      null,
    );
  });
});
