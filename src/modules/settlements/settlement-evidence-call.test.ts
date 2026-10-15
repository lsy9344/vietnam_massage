import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { settlementEvidenceCall } from "@/modules/settlements/settlement-evidence-call";

function row(overrides: Partial<ServiceCallRowDto> = {}): ServiceCallRowDto {
  return {
    id: "call-1",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "14:00",
    actualEntryTime: "14:05",
    displayEnd: "15:05",
    warningTime: null,
    warnings: [],
    roomId: "room-1",
    roomLabel: "301",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: "customer-1",
    customerMemo: "단골 민아 090111",
    therapist1: { id: "thr-1", displayName: "Mai", staffCode: "THR-001" },
    therapist2: { id: "thr-2", displayName: "Linh", staffCode: "THR-002" },
    earcare: null,
    status: "방문완료",
    discountTypeCode: null,
    paymentMethodCode: "CASH",
    note: "메모",
    confirmationCode: null,
    basePrice: 1500000,
    paymentAmount: 1500000,
    discountAmount: 0,
    therapist1Commission: 700000,
    therapist2Commission: 700000,
    earcarePoolAmount: 0,
    opsCallCredit: 1,
    calculationStatus: "calculated",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T07:00:00.000Z",
    updatedAt: "2026-06-10T07:00:00.000Z",
    savedAt: "2026-06-10T07:00:00.000Z",
    ...overrides
  };
}

describe("settlementEvidenceCall", () => {
  it("keeps the call summary a settlement manager may see in place of a ledger link (date, start time, course, therapists, status)", () => {
    assert.deepEqual(settlementEvidenceCall(row()), {
      serviceCallId: "call-1",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "14:00",
      courseCode: "A",
      therapistNames: ["Mai", "Linh"],
      status: "방문완료"
    });
  });

  it("does not carry customer contact, memo, or amounts", () => {
    const summary = settlementEvidenceCall(row());
    const text = JSON.stringify(summary);
    assert.doesNotMatch(text, /민아|090111|메모|1500000|700000/);
  });

  it("lists only the therapists the call has", () => {
    assert.deepEqual(settlementEvidenceCall(row({ therapist2: null })).therapistNames, ["Mai"]);
    assert.deepEqual(settlementEvidenceCall(row({ therapist1: null, therapist2: null })).therapistNames, []);
  });
});
