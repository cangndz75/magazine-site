import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleNewsletterConfirmRequest,
  handleNewsletterSubscribePost,
  handleNewsletterUnsubscribeRequest,
  type NewsletterHttpDeps,
} from "./http";

function deps(overrides: Partial<NewsletterHttpDeps> = {}): NewsletterHttpDeps {
  return {
    now: () => new Date("2026-08-23T10:00:00.000Z"),
    trustedSiteOrigin: "https://www.example.com",
    rateLimitBuckets: new Map(),
    signup: async () => ({
      status: "ACCEPTED",
      confirmationToken: "server-only-confirm-token",
      unsubscribeToken: "server-only-unsub-token",
      confirmationRequested: true,
    }),
    confirm: async () => ({ status: "CONFIRMED" }),
    unsubscribe: async () => ({ status: "SUCCESS" }),
    ...overrides,
  };
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://www.example.com/api/newsletter/subscribe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.example.com",
      "x-forwarded-for": "127.0.0.1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("newsletter public HTTP boundary", () => {
  it("returns a generic signup response without server-only tokens", async () => {
    const response = await handleNewsletterSubscribePost(
      postRequest({ email: "reader@example.com", surface: "footer" }),
      deps(),
    );
    assert.equal(response.status, 202);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.status, "ACCEPTED");
    assert.equal("confirmationToken" in body, false);
    assert.equal("unsubscribeToken" in body, false);
  });

  it("rejects malformed input, cross-origin requests, and rate-limit excess", async () => {
    const invalid = await handleNewsletterSubscribePost(postRequest({ email: "bad" }), deps({
      signup: async () => {
        throw new Error("invalid");
      },
    }));
    assert.equal(invalid.status, 400);

    const crossOrigin = await handleNewsletterSubscribePost(
      postRequest({ email: "reader@example.com" }, { origin: "https://evil.example" }),
      deps(),
    );
    assert.equal(crossOrigin.status, 403);

    const bucketDeps = deps();
    let last: Response | null = null;
    for (let i = 0; i < 11; i += 1) {
      last = await handleNewsletterSubscribePost(
        postRequest({ email: `reader${i}@example.com` }),
        bucketDeps,
      );
    }
    assert.equal(last?.status, 429);
  });

  it("returns bounded confirmation and unsubscribe states", async () => {
    const confirmed = await handleNewsletterConfirmRequest(
      new Request("https://www.example.com/api/newsletter/confirm?token=abc"),
      deps(),
    );
    assert.equal(confirmed.status, 200);

    const invalidConfirm = await handleNewsletterConfirmRequest(
      new Request("https://www.example.com/api/newsletter/confirm?token=bad"),
      deps({ confirm: async () => ({ status: "INVALID_OR_EXPIRED" }) }),
    );
    assert.equal(invalidConfirm.status, 400);

    const already = await handleNewsletterUnsubscribeRequest(
      new Request("https://www.example.com/api/newsletter/unsubscribe?token=abc"),
      deps({ unsubscribe: async () => ({ status: "ALREADY_UNSUBSCRIBED" }) }),
    );
    assert.equal(already.status, 200);
  });
});
