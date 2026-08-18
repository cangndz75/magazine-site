import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOMEPAGE_BUILDER_ERROR } from "@magazine/domain";
import {
  isHomepageBuilderConflict,
  presentHomepageBuilderError,
} from "./builder-messages";

describe("homepage builder messages", () => {
  it("maps write conflict to editor-facing text", () => {
    assert.equal(
      isHomepageBuilderConflict(HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT),
      true,
    );
    assert.match(
      presentHomepageBuilderError(HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT),
      /başka bir oturumda değiştirildi/i,
    );
  });

  it("maps publish validation failures", () => {
    assert.match(
      presentHomepageBuilderError(HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED),
      /yayınlanamaz/i,
    );
  });
});
