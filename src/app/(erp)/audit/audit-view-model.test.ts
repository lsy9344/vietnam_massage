import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditActorName,
  auditChangeSummary,
  auditFieldChanges,
  auditReason,
  auditSourceHref,
  auditSourcePath,
  auditTargetLabel
} from "@/app/(erp)/audit/audit-view-model";

const callBefore = {
  id: "call-1",
  operatingMonthId: "m-2026-10",
  serviceDate: "2026-10-14",
  startTime: "15:30",
  status: "예약",
  assignments: { therapist1Id: "e-1", therapist2Id: null }
};
const callAfter = { ...callBefore, startTime: "16:00", status: "사용중", assignments: { therapist1Id: "e-2", therapist2Id: null } };

describe("auditFieldChanges", () => {
  it("lists every field once in the after-value order and marks the ones that changed", () => {
    assert.deepEqual(auditFieldChanges(callBefore, callAfter), [
      { field: "id", before: "call-1", after: "call-1", changed: false },
      { field: "operatingMonthId", before: "m-2026-10", after: "m-2026-10", changed: false },
      { field: "serviceDate", before: "2026-10-14", after: "2026-10-14", changed: false },
      { field: "startTime", before: "15:30", after: "16:00", changed: true },
      { field: "status", before: "예약", after: "사용중", changed: true },
      { field: "assignments.therapist1Id", before: "e-1", after: "e-2", changed: true },
      { field: "assignments.therapist2Id", before: "-", after: "-", changed: false }
    ]);
  });

  it("opens nested objects one level so a changed assignment reads as its own field, and keeps lists whole", () => {
    assert.deepEqual(auditFieldChanges({ tags: ["a"], meta: { deep: { x: 1 } } }, { tags: ["a", "b"], meta: { deep: { x: 2 } } }), [
      { field: "tags", before: '["a"]', after: '["a","b"]', changed: true },
      { field: "meta.deep", before: '{"x":1}', after: '{"x":2}', changed: true }
    ]);
  });

  it("compares a field that is an object on one side only as one field", () => {
    assert.deepEqual(auditFieldChanges({ assignments: null }, { assignments: { therapist1Id: "e-1" } }), [
      { field: "assignments", before: "-", after: '{"therapist1Id":"e-1"}', changed: true }
    ]);
  });

  it("shows a missing side as a dash, so a created record compares against nothing", () => {
    assert.deepEqual(auditFieldChanges(null, { name: "Lan", phone: null }), [
      { field: "name", before: "-", after: "Lan", changed: true },
      { field: "phone", before: "-", after: "-", changed: false }
    ]);
  });

  it("keeps fields that only the before-value had", () => {
    assert.deepEqual(auditFieldChanges({ status: "OPEN", note: "x" }, { status: "CLOSED" }), [
      { field: "status", before: "OPEN", after: "CLOSED", changed: true },
      { field: "note", before: "x", after: "-", changed: true }
    ]);
  });

  it("compares a value that is not an object as one unnamed field", () => {
    assert.deepEqual(auditFieldChanges("a", "b"), [{ field: null, before: "a", after: "b", changed: true }]);
  });
});

describe("auditChangeSummary", () => {
  it("names a record that had no before-value as created", () => {
    assert.deepEqual(auditChangeSummary(null, { id: "r-1" }), { kind: "created", changes: [], more: 0 });
  });

  it("shows the first changed fields and counts the rest", () => {
    assert.deepEqual(auditChangeSummary(callBefore, callAfter), {
      kind: "changed",
      changes: [
        { field: "startTime", before: "15:30", after: "16:00", changed: true },
        { field: "status", before: "예약", after: "사용중", changed: true }
      ],
      more: 1
    });
  });

  it("says nothing changed when both values are the same", () => {
    assert.deepEqual(auditChangeSummary({ a: 1 }, { a: 1 }), { kind: "none", changes: [], more: 0 });
  });
});

describe("auditReason", () => {
  it("uses the recorded reason", () => {
    assert.equal(auditReason({ reason: "손님 요청", afterValue: { reason: "other" } }), "손님 요청");
  });

  it("falls back to the reason a reopen keeps inside its after-value", () => {
    assert.equal(auditReason({ reason: null, afterValue: { status: "검토중", reason: "누락 확인" } }), "누락 확인");
  });

  it("has no reason otherwise", () => {
    assert.equal(auditReason({ reason: null, afterValue: { status: "검토중" } }), null);
    assert.equal(auditReason({ reason: "  ", afterValue: null }), null);
  });
});

describe("auditSourcePath", () => {
  const entry = (targetType: string, afterValue: unknown, beforeValue: unknown = null, targetId = "t-1") => ({
    targetType,
    targetId,
    beforeValue: beforeValue as never,
    afterValue: afterValue as never
  });

  it("opens a call on its own ledger day", () => {
    assert.equal(auditSourcePath(entry("service_call", callAfter)), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("opens an expense on the day's cash tab", () => {
    assert.equal(
      auditSourcePath(entry("daily_expense", { operatingMonthId: "m-2026-10", expenseDate: "2026-10-13" })),
      "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-13&tab=cashbook"
    );
  });

  it("opens a customer's visit history", () => {
    assert.equal(auditSourcePath(entry("customer", { name: "Lan" }, null, "c-9")), "/customers?visitCustomer=c-9");
  });

  it("opens attendance on the settlement screen of its group and day, with that employee's panel", () => {
    const attendance = { operatingMonthId: "m-2026-10", attendanceDate: "2026-10-12", employeeId: "e-7" };
    assert.equal(
      auditSourcePath(entry("therapist_attendance", attendance)),
      "/settlements?operatingMonthId=m-2026-10&serviceDate=2026-10-12&employee=e-7"
    );
    // 폐기된 귀케어 출근의 옛 기록은 원본 화면이 없어 링크하지 않는다.
    assert.equal(auditSourcePath(entry("earcare_attendance", attendance)), null);
    assert.equal(
      auditSourcePath(entry("ops_attendance", attendance)),
      "/settlements/operations?operatingMonthId=m-2026-10&attendanceDate=2026-10-12&employee=e-7"
    );
  });

  it("opens attendance on its day without a panel when the snapshot has no employee", () => {
    assert.equal(
      auditSourcePath(entry("therapist_attendance", { operatingMonthId: "m-2026-10", attendanceDate: "2026-10-12" })),
      "/settlements?operatingMonthId=m-2026-10&serviceDate=2026-10-12"
    );
  });

  it("reads the before-value when the after-value is missing", () => {
    assert.equal(auditSourcePath(entry("service_call", null, callBefore)), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("opens a monthly close on its operating month", () => {
    assert.equal(auditSourcePath(entry("monthly_close", { operatingMonthId: "m-2026-09", status: "잠금" })), "/closing?operatingMonthId=m-2026-09");
  });

  it("opens master data on its settings tab with that item's panel", () => {
    assert.equal(auditSourcePath(entry("operating_month", {})), "/masters/operating-months?item=t-1");
    assert.equal(auditSourcePath(entry("room", {})), "/masters/rooms?item=t-1");
    assert.equal(auditSourcePath(entry("code_item", {})), "/masters/codes?item=t-1");
    assert.equal(auditSourcePath(entry("time_slot", {})), "/masters/codes?item=t-1");
    assert.equal(auditSourcePath(entry("employee", {})), "/masters/employees?item=t-1");
    assert.equal(auditSourcePath(entry("user_account", { employeeId: "e-3" })), "/masters/employees?item=e-3");
    assert.equal(auditSourcePath(entry("course", {})), "/masters/courses?item=course%3At-1");
    assert.equal(auditSourcePath(entry("course_policy", { courseId: "c-2" })), "/masters/courses?item=course%3Ac-2");
    assert.equal(
      auditSourcePath(entry("therapist_course_rate", { therapistId: "e-4", courseId: "c-2" })),
      "/masters/courses?item=rate%3Ae-4%3Ac-2"
    );
    assert.equal(auditSourcePath(entry("ops_daily_incentive_rule", {})), "/masters/courses?item=daily%3At-1");
    assert.equal(auditSourcePath(entry("ops_monthly_incentive_rule", {})), "/masters/courses?item=monthly%3At-1");
  });

  it("opens the tab alone when the snapshot cannot name the item", () => {
    assert.equal(auditSourcePath(entry("user_account", { employeeId: null })), "/masters/employees");
    assert.equal(auditSourcePath(entry("course_policy", {})), "/masters/courses");
    assert.equal(auditSourcePath(entry("therapist_course_rate", { courseId: "c-2" })), "/masters/courses");
  });

  it("falls back to the bare screen when the snapshot has no day", () => {
    assert.equal(auditSourcePath(entry("service_call", { status: "예약" })), "/calls");
    assert.equal(auditSourcePath(entry("monthly_close", null)), "/closing");
  });

  it("opens the day-off/correction approval inbox for a therapist_request entry (티켓 08)", () => {
    assert.equal(auditSourcePath(entry("therapist_request", { kind: "휴무", status: "승인" })), "/settlements/requests");
  });

  // R9: 형제 target(therapist_request·therapist_internal_memo)처럼 therapist_notice도 원본 화면으로 열려야 한다.
  it("opens the notices workspace for a therapist_notice entry (R9)", () => {
    assert.equal(auditSourcePath(entry("therapist_notice", { targetType: "전체" })), "/settlements/notices");
  });

  it("has no source screen for an unknown target", () => {
    assert.equal(auditSourcePath(entry("missing_story13_target", {})), null);
  });
});

describe("auditSourceHref", () => {
  const call = { targetType: "service_call", targetId: "call-1", beforeValue: null, afterValue: callAfter };

  it("links only to a screen the viewer's role may open", () => {
    assert.equal(auditSourceHref("administrator", call), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(auditSourceHref("settlement_manager", call), null);
    assert.equal(auditSourceHref("read_only_viewer", { ...call, targetType: "therapist_attendance" }), null);
  });
});

describe("auditTargetLabel", () => {
  it("names known targets in the screen language and leaves unknown ones as recorded", () => {
    assert.equal(auditTargetLabel("ko", "service_call"), "콜");
    assert.equal(auditTargetLabel("vi", "monthly_close"), "Chốt tháng");
    assert.equal(auditTargetLabel("ko", "missing_story13_target"), "missing_story13_target");
  });
});

describe("auditActorName", () => {
  it("names the system actor of automatic changes, and otherwise the account's name or its raw id", () => {
    assert.equal(auditActorName("ko", "system", undefined), "시스템(자동)");
    assert.equal(auditActorName("vi", "system", undefined), "Hệ thống (tự động)");
    assert.equal(auditActorName("ko", "acc-1", { name: "카운터" }), "카운터");
    assert.equal(auditActorName("ko", "legacy-id", undefined), "legacy-id");
  });
});
