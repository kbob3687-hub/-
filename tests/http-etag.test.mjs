import test from "node:test";
import assert from "node:assert/strict";
import { matchesIfNoneMatch } from "../lib/http-etag.ts";

test("unchanged catalog matches weak or strong validators", () => {
  assert.equal(matchesIfNoneMatch('W/"same"', 'W/"same"'), true);
  assert.equal(matchesIfNoneMatch('"same"', 'W/"same"'), true);
  assert.equal(matchesIfNoneMatch('"old", W/"same"', 'W/"same"'), true);
  assert.equal(matchesIfNoneMatch('*', 'W/"same"'), true);
});

test("missing or changed validators require a full response", () => {
  for (const header of [null, "", 'W/"old"', '"SAME"', "same"]) {
    assert.equal(matchesIfNoneMatch(header, 'W/"same"'), false);
  }
});
