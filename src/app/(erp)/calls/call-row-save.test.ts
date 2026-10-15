import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callRowSaveReducer, initialCallRowSave, type CallRowSave, type CallRowSaveEvent } from "@/app/(erp)/calls/call-row-save";
import type { ServiceCallRowDto } from "@/modules/calls/service-call-service";

function savedRow(overrides: Partial<ServiceCallRowDto> = {}): ServiceCallRowDto {
  return {
    id: "call-1",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "16:00",
    actualEntryTime: null,
    displayEnd: "17:00",
    warningTime: null,
    warnings: [],
    roomId: "room-101",
    roomLabel: "101 호실",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: null,
    customerMemo: "지윤",
    therapist1: { id: "therapist-1", displayName: "Therapist 1", staffCode: "THR-001" },
    therapist2: null,
    earcare: null,
    status: "예약",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    visitRequest: null,
    confirmationCode: null,
    basePrice: 0,
    paymentAmount: 0,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
    earcarePoolAmount: 0,
    opsCallCredit: 0,
    calculationStatus: "not_completed",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T06:00:00.000Z",
    updatedAt: "2026-06-10T07:00:00.000Z",
    savedAt: "2026-06-10T07:00:00.000Z",
    ...overrides
  };
}

const v1 = savedRow();
const staleMessage = "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.";

function play(events: CallRowSaveEvent[], start: CallRowSave = initialCallRowSave(v1)) {
  return events.reduce(callRowSaveReducer, start);
}

describe("call row save order", () => {
  it("sends a changed row with the updatedAt it last received, and sends nothing for a row nobody changed", () => {
    const untouched = play([{ type: "commit" }]);
    assert.equal(untouched.inFlight, null);
    assert.equal(untouched.status, "idle");

    const changed = play([{ type: "commit", changes: { customerMemo: "지윤 VIP" } }]);
    assert.equal(changed.status, "saving");
    assert.equal(changed.inFlight?.customerMemo, "지윤 VIP");
    assert.equal(changed.inFlight?.expectedUpdatedAt, v1.updatedAt);
  });

  it("holds edits made while a save is waiting and sends them once, with the updatedAt from the response", () => {
    const waiting = play([
      { type: "commit", changes: { customerMemo: "첫 입력" } },
      { type: "commit", changes: { paymentMethodCode: "카드" } },
      { type: "commit", changes: { customerMemo: "마지막 입력" } }
    ]);
    // 응답 전에는 두 번째 저장을 보내지 않는다.
    assert.equal(waiting.inFlight?.customerMemo, "첫 입력");
    assert.equal(waiting.inFlight?.paymentMethodCode, null);

    const v2 = savedRow({ customerMemo: "첫 입력", updatedAt: "2026-06-10T07:01:00.000Z", savedAt: "2026-06-10T07:01:00.000Z" });
    const next = callRowSaveReducer(waiting, { type: "saved", row: v2 });
    assert.equal(next.status, "saving");
    assert.equal(next.inFlight?.customerMemo, "마지막 입력");
    assert.equal(next.inFlight?.paymentMethodCode, "카드");
    assert.equal(next.inFlight?.expectedUpdatedAt, v2.updatedAt);

    const v3 = savedRow({ customerMemo: "마지막 입력", paymentMethodCode: "카드", updatedAt: "2026-06-10T07:02:00.000Z", savedAt: "2026-06-10T07:02:00.000Z" });
    const done = callRowSaveReducer(next, { type: "saved", row: v3 });
    assert.equal(done.status, "saved");
    assert.equal(done.inFlight, null);
    assert.equal(done.draft.customerMemo, "마지막 입력");
    assert.equal(done.draft.paymentMethodCode, "카드");
  });

  it("does not let a late response undo what was typed after the save went out", () => {
    const typing = play([
      { type: "commit", changes: { customerMemo: "보낸 값" } },
      { type: "edit", changes: { customerMemo: "응답 전에 고친 값" } }
    ]);

    const v2 = savedRow({ customerMemo: "보낸 값", updatedAt: "2026-06-10T07:01:00.000Z", savedAt: "2026-06-10T07:01:00.000Z" });
    const answered = callRowSaveReducer(typing, { type: "saved", row: v2 });

    assert.equal(answered.draft.customerMemo, "응답 전에 고친 값");
    assert.equal(answered.inFlight, null);
    // 그 입력을 확정하면 응답에서 받은 updatedAt으로 보낸다.
    const committed = callRowSaveReducer(answered, { type: "commit" });
    assert.equal(committed.inFlight?.customerMemo, "응답 전에 고친 값");
    assert.equal(committed.inFlight?.expectedUpdatedAt, v2.updatedAt);
  });

  it("keeps the draft after a conflict and saves nothing until the latest row is reloaded", () => {
    const latest = savedRow({ customerMemo: "다른 화면", updatedAt: "2026-06-10T07:05:00.000Z", savedAt: "2026-06-10T07:05:00.000Z" });
    const conflict = play([
      { type: "commit", changes: { customerMemo: "내 초안" } },
      { type: "commit", changes: { paymentMethodCode: "계좌" } },
      { type: "stale", row: latest, message: staleMessage }
    ]);
    assert.equal(conflict.status, "conflict");
    assert.equal(conflict.message, staleMessage);
    assert.equal(conflict.inFlight, null);
    assert.equal(conflict.draft.customerMemo, "내 초안");
    assert.equal(conflict.draft.paymentMethodCode, "계좌");

    // 더 고쳐도, Esc를 눌러도 보내지 않고 초안을 남긴다.
    const stillHeld = play(
      [{ type: "commit", changes: { note: "더 고침" } }, { type: "cancel" }],
      conflict
    );
    assert.equal(stillHeld.status, "conflict");
    assert.equal(stillHeld.inFlight, null);
    assert.equal(stillHeld.draft.customerMemo, "내 초안");
    assert.equal(stillHeld.draft.note, "더 고침");

    const fresh = savedRow({ customerMemo: "다른 화면 두 번째", updatedAt: "2026-06-10T07:06:00.000Z", savedAt: "2026-06-10T07:06:00.000Z" });
    const reloaded = callRowSaveReducer(stillHeld, { type: "reload", row: fresh });
    assert.equal(reloaded.status, "idle");
    assert.equal(reloaded.draft.customerMemo, "다른 화면 두 번째");
    assert.equal(reloaded.draft.note, null);

    const resaved = callRowSaveReducer(reloaded, { type: "commit", changes: { customerMemo: "다시 불러온 뒤" } });
    assert.equal(resaved.inFlight?.expectedUpdatedAt, fresh.updatedAt);
  });

  it("keeps a failed draft for a retry, but sends newer input queued during the failed save instead", () => {
    const failed = play([
      { type: "commit", changes: { paymentMethodCode: "카드" } },
      { type: "failed", message: "활성 코드값을 선택하세요." }
    ]);
    assert.equal(failed.status, "failed");
    assert.equal(failed.message, "활성 코드값을 선택하세요.");
    assert.equal(failed.draft.paymentMethodCode, "카드");

    const retried = callRowSaveReducer(failed, { type: "commit" });
    assert.equal(retried.status, "saving");
    assert.equal(retried.inFlight?.paymentMethodCode, "카드");
    assert.equal(retried.inFlight?.expectedUpdatedAt, v1.updatedAt);

    const superseded = play([
      { type: "commit", changes: { courseId: "course-d" } },
      { type: "commit", changes: { therapist2Id: "therapist-2" } },
      { type: "failed", message: "D코스는 마사지사2 필수입니다." }
    ]);
    assert.equal(superseded.status, "saving");
    assert.equal(superseded.message, null);
    assert.equal(superseded.inFlight?.courseId, "course-d");
    assert.equal(superseded.inFlight?.therapist2Id, "therapist-2");
  });

  it("reapplies only the chosen fields on top of the latest row, and sends them for another version check", () => {
    const latest = savedRow({ customerMemo: "다른 화면", paymentMethodCode: "계좌", updatedAt: "2026-06-10T07:05:00.000Z", savedAt: "2026-06-10T07:05:00.000Z" });
    const conflict = play([
      { type: "commit", changes: { customerMemo: "내 초안", note: "내 비고" } },
      { type: "stale", row: latest, message: staleMessage }
    ]);

    // customerMemo만 내 값 쓰기로 고르고, note(내가 더 고친 값)는 고르지 않았다.
    const reapplied = callRowSaveReducer(conflict, { type: "reapply", row: latest, changes: { customerMemo: "내 초안" } });
    assert.equal(reapplied.status, "saving");
    assert.equal(reapplied.inFlight?.customerMemo, "내 초안");
    assert.equal(reapplied.inFlight?.note, null); // 최신 행 그대로, 강제 덮어쓰기 없음
    assert.equal(reapplied.inFlight?.paymentMethodCode, "계좌"); // 최신 행의 값을 그대로 둔다
    assert.equal(reapplied.inFlight?.expectedUpdatedAt, latest.updatedAt);

    // 다시 저장해도 또 충돌이면(비교하는 동안 또 바뀌었다면) 다시 "충돌 확인 필요"가 된다.
    const againStale = savedRow({ customerMemo: "세 번째 화면", updatedAt: "2026-06-10T07:06:00.000Z", savedAt: "2026-06-10T07:06:00.000Z" });
    const reconflicted = callRowSaveReducer(reapplied, { type: "stale", row: againStale, message: staleMessage });
    assert.equal(reconflicted.status, "conflict");
    assert.equal(reconflicted.latestRow?.customerMemo, "세 번째 화면");
  });

  it("ignores reapply outside a conflict", () => {
    const idle = play([]);
    const unchanged = callRowSaveReducer(idle, { type: "reapply", row: v1, changes: { customerMemo: "무시된다" } });
    assert.equal(unchanged, idle);
  });

  it("restores the last saved values on Escape, or the values being sent while a save is waiting", () => {
    const restored = play([
      { type: "edit", changes: { customerMemo: "취소할 입력" } },
      { type: "cancel" }
    ]);
    assert.equal(restored.draft.customerMemo, "지윤");

    const restoredToSending = play([
      { type: "commit", changes: { customerMemo: "보내는 중" } },
      { type: "edit", changes: { customerMemo: "취소할 입력" } },
      { type: "cancel" }
    ]);
    assert.equal(restoredToSending.draft.customerMemo, "보내는 중");
    assert.equal(restoredToSending.status, "saving");
  });
});
