import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_RIGHTS_STATUS } from "@magazine/domain";
import { RIGHTS_STATUS_PRESENTATION } from "./presentation";

describe("media presentation", () => {
  it("maps every rights status to Turkish labels with non-color cues", () => {
    for (const status of Object.values(MEDIA_RIGHTS_STATUS)) {
      const presentation = RIGHTS_STATUS_PRESENTATION[status];
      assert.ok(presentation.label.length > 0);
      assert.ok(presentation.icon.length > 0);
      assert.ok(
        ["ok", "warn", "danger", "muted"].includes(presentation.tone),
      );
    }
  });
});
