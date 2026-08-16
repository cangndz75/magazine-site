import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sessionCookieClearOptions,
  sessionCookieName,
  sessionCookieOptions,
} from "./cookie-options";

describe("session cookie set/clear options", () => {
  it("uses the development cookie name and insecure cookie on localhost", () => {
    const name = sessionCookieName("development");
    const set = sessionCookieOptions("development");
    const clear = sessionCookieClearOptions("development");

    assert.equal(name, "magazine-editor-session");
    assert.equal(set.path, "/");
    assert.equal(clear.path, "/");
    assert.equal("domain" in set, false);
    assert.equal("domain" in clear, false);
    assert.equal(set.secure, false);
    assert.equal(clear.secure, false);
    assert.equal(set.httpOnly, true);
    assert.equal(clear.httpOnly, true);
    assert.equal(set.sameSite, "lax");
    assert.equal(clear.sameSite, "lax");
    assert.equal(clear.maxAge, 0);
    assert.notEqual(set.maxAge, 0);
  });

  it("uses the __Host- production cookie name with Secure and the same clear path", () => {
    const name = sessionCookieName("production");
    const set = sessionCookieOptions("production");
    const clear = sessionCookieClearOptions("production");

    assert.equal(name, "__Host-magazine-editor-session");
    assert.equal(sessionCookieName("staging"), name);
    assert.equal(set.path, "/");
    assert.equal(clear.path, "/");
    assert.equal("domain" in set, false);
    assert.equal("domain" in clear, false);
    assert.equal(set.secure, true);
    assert.equal(clear.secure, true);
    assert.equal(clear.maxAge, 0);
  });
});
