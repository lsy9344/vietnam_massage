import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessRoute, canPerform } from "@/lib/authorization";

describe("authorization Story 5.5 permissions", () => {
  it("keeps monthly close reopen administrator-only while settlement_manager keeps closing write access", () => {
    assert.equal(canPerform("administrator", "closing:write"), true);
    assert.equal(canPerform("administrator", "closing:reopen"), true);
    assert.equal(canPerform("settlement_manager", "closing:write"), true);
    assert.equal(canPerform("settlement_manager", "closing:reopen"), false);
  });

  it("allows settlement_manager to view /closing without granting reopen permission", () => {
    assert.equal(canAccessRoute("settlement_manager", "/closing"), true);
    assert.equal(canPerform("settlement_manager", "closing:reopen"), false);
  });
});

describe("authorization Story 6.3 graph report route access", () => {
  it("allows dashboard read-only roles to access /dashboard/reports and keeps waiter redirected", () => {
    assert.equal(canAccessRoute("administrator", "/dashboard/reports"), true);
    assert.equal(canAccessRoute("counter", "/dashboard/reports"), true);
    assert.equal(canAccessRoute("settlement_manager", "/dashboard/reports"), true);
    assert.equal(canAccessRoute("read_only_viewer", "/dashboard/reports"), true);
    assert.equal(canAccessRoute("waiter", "/dashboard/reports"), false);
  });
});
