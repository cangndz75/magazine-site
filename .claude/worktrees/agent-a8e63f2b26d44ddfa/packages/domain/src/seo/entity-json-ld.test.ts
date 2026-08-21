import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENTITY_KIND } from "../entity/types";
import { toPublicEntitySeoInput } from "../entity/projection";
import { buildEntityProfileJsonLd } from "./entity-json-ld";

describe("entity profile JSON-LD", () => {
  it("emits only stored editorial facts", () => {
    const seo = toPublicEntitySeoInput({
      canonicalName: "Hande Erçel",
      canonicalUrl: "https://example.com/kimdir/hande-ercel",
      summary: "Oyuncu.",
      portraitUrl: "https://cdn.example.com/hande.jpg",
      officialWebsiteUrl: "https://hande.example.com",
      birthDate: "1993-11-24",
      occupation: "Oyuncu",
    });
    const jsonLd = buildEntityProfileJsonLd({
      kind: ENTITY_KIND.PERSON,
      seo,
    });
    assert.ok(jsonLd);
    assert.equal(jsonLd?.["@type"], "ProfilePage");
    const mainEntity = jsonLd?.mainEntity as Record<string, unknown>;
    assert.equal(mainEntity["@type"], "Person");
    assert.equal(mainEntity.name, "Hande Erçel");
    assert.equal(mainEntity.birthDate, "1993-11-24");
    assert.equal(mainEntity.jobTitle, "Oyuncu");
    assert.equal(mainEntity.sameAs, "https://hande.example.com/");
    assert.equal((jsonLd as Record<string, unknown>).spouse, undefined);
  });
});
