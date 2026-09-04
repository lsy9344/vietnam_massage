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

describe("authorization Story 7.1 sheet mapping route access", () => {
  it("allows read-only QA access to the sheet mapping page without opening all masters routes", () => {
    assert.equal(canAccessRoute("administrator", "/masters/sheet-mapping"), true);
    assert.equal(canAccessRoute("read_only_viewer", "/masters/sheet-mapping"), true);
    assert.equal(canAccessRoute("read_only_viewer", "/masters/sheet-mapping/details"), false);
    assert.equal(canAccessRoute("read_only_viewer", "/masters"), false);
    assert.equal(canAccessRoute("read_only_viewer", "/masters/codes"), false);
    assert.equal(canAccessRoute("waiter", "/masters/sheet-mapping"), false);
  });
});

describe("authorization TV board route access", () => {
  // 요구사항 9.1 권장 권한: 카운터에는 "TV 화면 조회"가 포함된다.
  it("lets administrator, counter and read_only_viewer open the TV board while waiter/settlement stay out", () => {
    assert.equal(canAccessRoute("administrator", "/tv"), true);
    assert.equal(canAccessRoute("counter", "/tv"), true);
    assert.equal(canAccessRoute("read_only_viewer", "/tv"), true);
    assert.equal(canAccessRoute("waiter", "/tv"), false);
    assert.equal(canAccessRoute("settlement_manager", "/tv"), false);
  });

  it("keeps the counter TV grant read-only: no payout or closing permission comes with it", () => {
    assert.equal(canPerform("counter", "payout:write"), false);
    assert.equal(canPerform("counter", "closing:write"), false);
    assert.equal(canPerform("counter", "employee:write"), false);
  });
});
