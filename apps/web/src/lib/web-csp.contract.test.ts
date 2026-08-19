import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { publicWebContentSecurityPolicy } from "./web-csp";

describe("public web CSP wiring", () => {
  it("applies the same frame-src policy from next.config headers", () => {
    const configSource = readFileSync(
      path.join(fileURLToPath(new URL("../../next.config.ts", import.meta.url))),
      "utf8",
    );

    assert.equal(configSource.includes("publicWebContentSecurityPolicy"), true);
    assert.equal(configSource.includes("sameOriginLocalMediaRewrite"), true);
    assert.equal(configSource.includes("beforeFiles"), true);
    assert.equal(configSource.includes("Content-Security-Policy"), true);
    assert.equal(
      publicWebContentSecurityPolicy(),
      "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
    );
  });
});
