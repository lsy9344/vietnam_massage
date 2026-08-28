import assert from "node:assert/strict";
import test from "node:test";
import { shouldBlockWrite } from "./maintenance-mode";

test("read-only maintenance blocks write methods", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(shouldBlockWrite(method, "read-only"), true);
  }
});

test("read-only maintenance preserves safe reads", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(shouldBlockWrite(method, "read-only"), false);
  }
});

test("normal operation does not block writes", () => {
  assert.equal(shouldBlockWrite("POST", ""), false);
  assert.equal(shouldBlockWrite("POST", undefined), false);
});
