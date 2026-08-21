import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  parsePublicCacheInvalidatePayload,
  parsePublicEntityCacheInvalidatePayload,
  publicEntityCacheTag,
  publicEntityInvalidationTags,
  publicEntityRelatedCacheTag,
  publicEntityRelatedInvalidationTags,
  publicEntitySlugCacheTag,
} from "./public-cache";

describe("public entity cache tags", () => {
  const entityId = "11111111-1111-4111-8111-111111111111";

  it("builds slug, entity, and related tags", () => {
    assert.equal(publicEntitySlugCacheTag("hande-ercel"), "entity-slug:hande-ercel");
    assert.equal(publicEntityCacheTag(entityId), `entity:${entityId}`);
    assert.equal(
      publicEntityRelatedCacheTag(entityId),
      `entity-related:${entityId}`,
    );
  });

  it("invalidates profile and related tags deliberately", () => {
    assert.deepEqual(publicEntityInvalidationTags({ entityId, slug: "hande-ercel" }), [
      `entity:${entityId}`,
      `entity-related:${entityId}`,
      "entity-slug:hande-ercel",
    ]);
    assert.deepEqual(publicEntityRelatedInvalidationTags(entityId), [
      `entity-related:${entityId}`,
    ]);
  });

  it("parses entity invalidation payloads", () => {
    const parsed = parsePublicEntityCacheInvalidatePayload({
      schemaVersion: 1,
      entityId,
      slug: "hande-ercel",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.entityId, entityId);
    }
  });

  it("accepts wrapped cache invalidation union", () => {
    const parsed = parsePublicCacheInvalidatePayload({
      schemaVersion: 1,
      entityId,
      slug: "hande-ercel",
    });
    assert.equal(parsed.ok, true);
  });

  it("exports entity outbox event types", () => {
    assert.equal(
      PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE,
      "PUBLIC_ENTITY_CACHE_INVALIDATE",
    );
  });
});
