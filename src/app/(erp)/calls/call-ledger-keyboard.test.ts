import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITABLE_CALL_FIELDS,
  type EditableCallField,
  cancelCellDraft,
  moveAdjacentCell,
  moveEnterCell,
  moveTabCell,
  type CellCoordinate
} from "@/app/(erp)/calls/call-ledger-keyboard";

const rows = ["row-1", "row-2", "row-3"];

function cell(rowIndex: number, columnId: string): CellCoordinate {
  return { rowIndex, columnId };
}

test("Tab and Shift+Tab move across editable cells and wrap between rows", () => {
  assert.deepEqual(moveTabCell(cell(0, "startTime"), rows.length, false), cell(0, "roomId"));
  assert.deepEqual(moveTabCell(cell(0, "confirmationCode"), rows.length, false), cell(1, "startTime"));
  assert.deepEqual(moveTabCell(cell(1, "startTime"), rows.length, true), cell(0, "confirmationCode"));
  assert.deepEqual(moveTabCell(cell(0, "startTime"), rows.length, true), cell(0, "startTime"));
});

test("Enter commits current editable cell and moves to the same field on the next row", () => {
  assert.deepEqual(moveEnterCell(cell(0, "courseId"), rows.length), cell(1, "courseId"));
  assert.deepEqual(moveEnterCell(cell(2, "courseId"), rows.length), cell(2, "courseId"));
});

test("Arrow movement is bounded and can land on readonly computed cells without opening edit mode", () => {
  assert.deepEqual(moveAdjacentCell(cell(0, "courseId"), rows.length, "ArrowRight"), cell(0, "customerMemo"));
  assert.deepEqual(moveAdjacentCell(cell(0, "paymentAmount"), rows.length, "ArrowRight"), cell(0, "discountAmount"));
  assert.deepEqual(moveAdjacentCell(cell(0, "startTime"), rows.length, "ArrowLeft"), cell(0, "startTime"));
  assert.deepEqual(moveAdjacentCell(cell(2, "status"), rows.length, "ArrowDown"), cell(2, "status"));
});

test("computed cells are excluded from the explicit editable field sequence", () => {
  assert.equal((EDITABLE_CALL_FIELDS as readonly string[]).includes("paymentAmount"), false);
  assert.equal((EDITABLE_CALL_FIELDS as readonly string[]).includes("earcarePoolAmount"), false);
});

test("Esc cancel restores the last server draft without changing object identity of the baseline", () => {
  const serverDraft: Record<EditableCallField, string | null> = {
    startTime: "11:00",
    roomId: "room-1",
    courseId: "course-a",
    customerMemo: null,
    therapist1Id: "employee-0",
    therapist2Id: null,
    earcareEmployeeId: null,
    status: "예약",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: "서버 값",
    confirmationCode: null
  };
  const editedDraft: Record<EditableCallField, string | null> = {
    ...serverDraft,
    note: "수정 중",
    therapist2Id: "employee-1"
  };
  const restored = cancelCellDraft(editedDraft, serverDraft);

  assert.deepEqual(restored, serverDraft);
  assert.notEqual(restored, serverDraft);
});
