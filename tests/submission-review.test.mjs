import test from "node:test";
import assert from "node:assert/strict";
import { parseReview, reviewSubmission, reviewResponse } from "../lib/submission-review.ts";

test("review distinguishes theme and safety, and fails closed on ambiguity", () => {
  assert.equal(parseReview('{"safety":"allow","theme":"allow"}').decision, "allow");
  assert.equal(parseReview('{"safety":"reject","theme":"allow"}').decision, "safety");
  assert.equal(parseReview('{"safety":"allow","theme":"reject"}').decision, "theme");
  for (const value of [null, "not json", "{}", '{"safety":"allow"}', '{"safety":"allow","theme":"uncertain"}', '{"safety":"uncertain","theme":"allow"}', '{"safety":true,"theme":true}']) {
    assert.equal(parseReview(value).decision, "unavailable");
  }
});

test("both gates return distinct rejection reasons and never approve outages", async () => {
  for (const decision of ["safety", "theme", "unavailable"]) {
    const response = reviewResponse({ decision, message: "test" });
    assert.equal(response.status, decision === "unavailable" ? 503 : 422);
    const body = await response.json();
    assert.equal(body.reason, decision);
    assert.equal(body.rejected, decision !== "unavailable");
  }
  assert.equal(reviewResponse({ decision: "allow", message: "test" }), null);
});

test("review sends actual evidence and fails closed without config or on provider errors", async () => {
  const names = ["CONTENT_REVIEW_MODEL", "CONTENT_REVIEW_API_KEY", "CONTENT_REVIEW_BASE_URL"];
  const originals = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.CONTENT_REVIEW_MODEL;
    globalThis.fetch = async () => { throw new Error("must not call unconfigured service"); };
    assert.equal((await reviewSubmission({ desc: "看着一朵云发呆" })).decision, "unavailable");
    process.env.CONTENT_REVIEW_MODEL = "test-vision";
    process.env.CONTENT_REVIEW_API_KEY = "test-only";
    process.env.CONTENT_REVIEW_BASE_URL = "https://review.invalid/v1";
    let request;
    globalThis.fetch = async (_url, options) => {
      request = JSON.parse(options.body);
      return Response.json({ choices: [{ message: { content: '{"safety":"allow","theme":"allow"}' } }] });
    };
    const image = "data:image/png;base64,aGVsbG8=";
    assert.equal((await reviewSubmission({ desc: "下班后看云", title: "云", imageUrl: image, exhibitionText: ["编目文字"] })).decision, "allow");
    assert.equal(request.messages[1].content[1].image_url.url, image);
    assert.ok(request.messages[1].content[0].text.includes("编目文字"));
    assert.ok(request.messages[0].content.includes("积极开心也允许"));
    globalThis.fetch = async () => new Response("error", { status: 429 });
    assert.equal((await reviewSubmission({ desc: "下班后看云" })).decision, "unavailable");
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: "invalid" } }] });
    assert.equal((await reviewSubmission({ desc: "下班后看云" })).decision, "unavailable");
    globalThis.fetch = async () => { throw new Error("timeout"); };
    assert.equal((await reviewSubmission({ desc: "下班后看云" })).decision, "unavailable");
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => originals[index] === undefined ? delete process.env[name] : process.env[name] = originals[index]);
  }
});
