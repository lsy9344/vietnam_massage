import assert from "node:assert/strict";
import { it } from "node:test";
import { callSaveById, callSaveRecordFromJson, readCallSaveRecords } from "./service-call-save-query";

it("restores UTC dates and nested relations from the call save join without interpreting business strings", () => {
  const row = callSaveRecordFromJson({
    service_date: "2026-06-10", updated_at: "2026-06-10T12:13:14.123",
    actual_entry_time: "23:10", customer_memo: "some_snake_case_text",
    operatingMonth: { start_date: "2026-06-01", end_date: "2026-06-30" },
    room: null, assignments: [{ is_active: false, employee: { staff_code: "THR-001" } }]
  });
  assert.deepEqual(row, {
    serviceDate: new Date("2026-06-10T00:00:00Z"), updatedAt: new Date("2026-06-10T12:13:14.123Z"),
    actualEntryTime: "23:10", customerMemo: "some_snake_case_text",
    operatingMonth: { startDate: new Date("2026-06-01T00:00:00Z"), endDate: new Date("2026-06-30T00:00:00Z") },
    room: null, assignments: [{ isActive: false, employee: { staffCode: "THR-001" } }]
  });
});

it("binds call IDs as values, including characters that would change an interpolated SQL predicate", async () => {
  const id = "x' OR true --";
  const rows = await readCallSaveRecords({ $queryRaw: async (sql) => {
    assert.deepEqual(sql.values, [id]);
    assert.ok(!sql.text.includes(id));
    return [{ record: { id: "fixture", service_date: "2026-06-10" } }];
  } }, callSaveById(id));
  assert.deepEqual(rows, [{ id: "fixture", serviceDate: new Date("2026-06-10T00:00:00Z") }]);
});
