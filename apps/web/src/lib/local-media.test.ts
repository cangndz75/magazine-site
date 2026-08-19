import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  localMediaContentType,
  resolveLocalMediaFilePath,
  sameOriginLocalMediaRewrite,
} from "./local-media";

describe("sameOriginLocalMediaRewrite", () => {
  it("rewrites same-origin /media files before Next static snapshot 404s", () => {
    assert.deepEqual(
      sameOriginLocalMediaRewrite({
        siteUrl: "http://localhost:3000",
        mediaPublicBaseUrl: "http://localhost:3000/media",
      }),
      {
        source: "/media/:path*",
        destination: "/api/internal/local-media/:path*",
      },
    );
  });

  it("does not intercept a separate media CDN origin", () => {
    assert.equal(
      sameOriginLocalMediaRewrite({
        siteUrl: "https://www.example.com",
        mediaPublicBaseUrl: "https://media.example.com",
      }),
      null,
    );
  });
});

describe("resolveLocalMediaFilePath", () => {
  const root = path.resolve("/tmp/magazine-media-root");

  it("allows generated upload and rendition keys plus qa fixtures", () => {
    assert.equal(
      resolveLocalMediaFilePath(root, [
        "uploads",
        "2026",
        "08",
        "20cbf284-b9b0-4d62-9b90-e8e0d30e47c6.thumb.jpg",
      ]),
      path.resolve(
        root,
        "uploads/2026/08/20cbf284-b9b0-4d62-9b90-e8e0d30e47c6.thumb.jpg",
      ),
    );
    assert.equal(
      resolveLocalMediaFilePath(root, ["qa", "hero-portrait.jpg"]),
      path.resolve(root, "qa/hero-portrait.jpg"),
    );
  });

  it("rejects traversal, empty segments, and non-image files", () => {
    assert.equal(resolveLocalMediaFilePath(root, ["uploads", "..", "secret.jpg"]), null);
    assert.equal(resolveLocalMediaFilePath(root, ["..", "etc", "passwd"]), null);
    assert.equal(resolveLocalMediaFilePath(root, ["qa", ""]), null);
    assert.equal(resolveLocalMediaFilePath(root, ["note.txt"]), null);
    assert.equal(localMediaContentType("hero.jpg"), "image/jpeg");
  });
});
