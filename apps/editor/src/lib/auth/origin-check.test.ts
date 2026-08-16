import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertEditorOrigin } from "./origin-check";

const EDITOR_URL = "https://editor.example";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://editor.example/api/auth/login", {
    method: "POST",
    headers,
  });
}

describe("editor origin validation", () => {
  it("accepts the exact configured editor origin", () => {
    assert.doesNotThrow(() => {
      assertEditorOrigin(
        requestWithHeaders({ origin: "https://editor.example" }),
        EDITOR_URL,
      );
    });
  });

  it("accepts a matching Referer when Origin is absent", () => {
    assert.doesNotThrow(() => {
      assertEditorOrigin(
        requestWithHeaders({ referer: "https://editor.example/login" }),
        EDITOR_URL,
      );
    });
  });

  it("rejects attacker origins and suffix lookalikes", () => {
    assert.throws(() => {
      assertEditorOrigin(
        requestWithHeaders({ origin: "https://attacker.example" }),
        EDITOR_URL,
      );
    });
    assert.throws(() => {
      assertEditorOrigin(
        requestWithHeaders({ origin: "https://editor.example.attacker.com" }),
        EDITOR_URL,
      );
    });
  });

  it("rejects protocol and port mismatches", () => {
    assert.throws(() => {
      assertEditorOrigin(
        requestWithHeaders({ origin: "http://editor.example" }),
        EDITOR_URL,
      );
    });
    assert.throws(() => {
      assertEditorOrigin(
        requestWithHeaders({ origin: "https://editor.example:4443" }),
        EDITOR_URL,
      );
    });
  });

  it("rejects Origin null, missing Origin and Referer, and malformed Referer", () => {
    assert.throws(() => {
      assertEditorOrigin(requestWithHeaders({ origin: "null" }), EDITOR_URL);
    });
    assert.throws(() => {
      assertEditorOrigin(requestWithHeaders({}), EDITOR_URL);
    });
    assert.throws(() => {
      assertEditorOrigin(requestWithHeaders({ referer: "not a url" }), EDITOR_URL);
    });
  });
});
