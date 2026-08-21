import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "@magazine/domain";
import { presentSlugMutationCopy } from "./slug-presentation";

describe("slug mutation copy", () => {
  it("uses a distinct published confirm and a controlled unpublished save", () => {
    const published = presentSlugMutationCopy(PUBLICATION_STATUS.PUBLISHED);
    assert.equal(
      published.submitLabel,
      "URL'yi değiştir ve eski adresi yönlendir",
    );
    assert.equal(published.requiresConsequence, true);
    assert.match(published.consequenceLabel, /kalıcı/);

    const draft = presentSlugMutationCopy(PUBLICATION_STATUS.NEVER_PUBLISHED);
    assert.equal(draft.submitLabel, "URL'yi kaydet");
    assert.equal(draft.requiresConsequence, false);
  });
});
