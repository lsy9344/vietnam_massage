import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentBusinessTimeHm } from "@/lib/business-time";

describe("currentBusinessTimeHm", () => {
  it("returns Ho Chi Minh HH:mm", () => {
    assert.equal(currentBusinessTimeHm(new Date("2026-10-16T12:34:00.000Z")), "19:34");
  });

  it("uses 00:00 at local midnight", () => {
    assert.equal(currentBusinessTimeHm(new Date("2026-10-16T17:00:00.000Z")), "00:00");
  });
});
