import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePublicMediaUrl } from "./resolve-public-media-url";

describe("resolvePublicMediaUrl", () => {
  it("builds an http(s) URL without exposing query or fragment from the base", () => {
    assert.equal(
      resolvePublicMediaUrl(
        "https://cdn.example.test/assets?token=secret#frag",
        "itest/hero.jpg",
      ),
      "https://cdn.example.test/assets/itest/hero.jpg",
    );
  });

  it("returns null for missing base, unsafe protocol, or empty key", () => {
    assert.equal(resolvePublicMediaUrl(undefined, "itest/hero.jpg"), null);
    assert.equal(resolvePublicMediaUrl("ftp://cdn.example.test", "itest/hero.jpg"), null);
    assert.equal(resolvePublicMediaUrl("https://cdn.example.test", "   "), null);
  });
});
