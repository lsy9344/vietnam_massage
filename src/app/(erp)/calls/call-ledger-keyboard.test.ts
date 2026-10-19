import test from "node:test";
import assert from "node:assert/strict";
import { type EditableCallField, cancelCellDraft } from "@/app/(erp)/calls/call-ledger-keyboard";

test("Esc cancel restores the last server draft without changing object identity of the baseline", () => {
  const serverDraft: Record<EditableCallField, string | null> = {
    startTime: "11:00",
    actualEntryTime: null,
    actualEndTime: null,
    roomId: "room-1",
    courseId: "course-a",
    customerMemo: null,
    customerId: null,
    therapist1Id: "employee-0",
    therapist2Id: null,
    status: "예약",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: "서버 값",
    visitRequest: null,
    bookingChannelCode: null,
    bookerName: null,
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
