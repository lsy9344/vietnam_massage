import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialNewCallRowSave,
  isNewRowSaveHeld,
  newCallRowSaveReducer,
  type NewCallRowSave,
  type NewCallRowSaveEvent
} from "@/app/(erp)/calls/call-new-row-save";

const ledger = { operatingMonthId: "month-2026-06", serviceDate: "2026-06-10" };

function run(state: NewCallRowSave, ...events: NewCallRowSaveEvent[]) {
  return events.reduce(newCallRowSaveReducer, state);
}

/** 새 행에 예약 하나를 적고 저장을 누른 상태. */
function submitted(requestId = "request-1") {
  return run(
    initialNewCallRowSave(ledger, requestId),
    { type: "edit", changes: { startTime: "16:00", courseId: "course-a", customerMemo: "지윤" } },
    { type: "submit" }
  );
}

describe("new call row save", () => {
  it("keeps the draft and its request id when the response is lost, and sends the same request id again", () => {
    const sending = submitted();
    assert.equal(sending.status, "saving");
    assert.equal(sending.inFlight?.requestId, "request-1");
    assert.equal(sending.inFlight?.customerMemo, "지윤");

    const lost = run(sending, { type: "lost", request: sending.inFlight! });
    assert.equal(lost.status, "checking");
    assert.equal(lost.inFlight, null);
    assert.equal(lost.draft.customerMemo, "지윤");
    assert.equal(lost.draft.startTime, "16:00");

    const retried = run(lost, { type: "submit" });
    assert.equal(retried.status, "saving");
    assert.deepEqual(retried.inFlight, sending.inFlight);
  });

  it("starts a blank draft with a new request id once the call is saved, and says so when it had been saved already", () => {
    const sending = submitted();
    const alreadySaved = "이미 저장된 콜입니다.";

    const saved = run(sending, { type: "saved", request: sending.inFlight!, notice: alreadySaved, nextRequestId: "request-2" });
    assert.equal(saved.status, "saved");
    assert.equal(saved.notice, alreadySaved);
    assert.equal(saved.inFlight, null);
    assert.deepEqual(saved.draft, initialNewCallRowSave(ledger, "request-2").draft);

    const next = run(saved, { type: "edit", changes: { startTime: "17:00", courseId: "course-a" } });
    assert.equal(next.status, "idle");
    assert.equal(next.notice, null);
    assert.equal(run(next, { type: "submit" }).inFlight?.requestId, "request-2");
  });

  it("keeps the draft and its request id on a rejection, shows why, and sends the fixed draft with the same request id", () => {
    const sending = submitted();
    const required = "D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다.";

    const failed = run(sending, {
      type: "failed",
      request: sending.inFlight!,
      message: required,
      fieldErrors: { therapist2Id: [required] }
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.message, required);
    assert.deepEqual(failed.fieldErrors, { therapist2Id: [required] });
    assert.equal(failed.draft.customerMemo, "지윤");

    // 거절된 요청은 아무것도 만들지 않았다. 고친 초안도 같은 요청 id로 보낸다.
    const fixed = run(failed, { type: "edit", changes: { therapist2Id: "therapist-2" } }, { type: "submit" });
    assert.equal(fixed.inFlight?.requestId, "request-1");
    assert.equal(fixed.inFlight?.therapist2Id, "therapist-2");
    assert.equal(fixed.message, null);
    assert.deepEqual(fixed.fieldErrors, {});
  });

  it("leaves the draft as sent while the save is on its way or its result is unknown, so a retry sends what may already be saved", () => {
    const sending = submitted();
    const edit: NewCallRowSaveEvent = { type: "edit", changes: { customerMemo: "바뀐 메모" } };

    const whileSending = run(sending, edit, { type: "submit" });
    assert.equal(whileSending.draft.customerMemo, "지윤");
    assert.equal(whileSending.inFlight, sending.inFlight);

    const whileChecking = run(sending, { type: "lost", request: sending.inFlight! }, edit, { type: "submit" });
    assert.deepEqual(whileChecking.inFlight, sending.inFlight);
  });

  it("takes a save that answers after it was given up on, and ignores late news about an earlier attempt or an earlier draft", () => {
    const sending = submitted();
    const first = sending.inFlight!;
    const gaveUp = run(sending, { type: "lost", request: first });

    // 시간 초과로 기다리기를 그만둔 뒤에 온 응답도 이 초안의 결과다.
    const late = run(gaveUp, { type: "saved", request: first, notice: null, nextRequestId: "request-2" });
    assert.equal(late.status, "saved");
    assert.equal(late.requestId, "request-2");

    // 다시 보낸 저장을 기다리는 동안 앞 시도의 끊김이나 실패 소식이 오면, 다시 보낸 저장의 답을 기다린다.
    const retrying = run(gaveUp, { type: "submit" });
    const waiting = run(retrying, { type: "lost", request: first }, { type: "failed", request: first, message: "앞 시도" });
    assert.equal(waiting.status, "saving");
    assert.equal(waiting.inFlight, retrying.inFlight);

    // 저장을 마친 앞 초안의 늦은 응답은 지금 적고 있는 새 초안을 건드리지 않는다.
    const nextDraft = run(late, { type: "edit", changes: { customerMemo: "다음 손님" } });
    assert.deepEqual(run(nextDraft, { type: "saved", request: retrying.inFlight!, notice: null, nextRequestId: "request-3" }), nextDraft);
  });

  it("fills the time, course, and therapist from an available course without carrying the previous result onto the row", () => {
    const sending = submitted();
    const failed = run(sending, { type: "failed", request: sending.inFlight!, message: "코스를 선택하세요.", fieldErrors: { courseId: ["코스를 선택하세요."] } });
    const choice = { startTime: "18:00", courseId: "course-b", therapist1Id: "therapist-3" };

    const chosen = run(failed, { type: "choose", changes: choice });
    assert.equal(chosen.status, "idle");
    assert.equal(chosen.message, null);
    assert.deepEqual(chosen.fieldErrors, {});
    assert.equal(chosen.draft.customerMemo, "지윤");
    assert.equal(chosen.draft.courseId, "course-b");

    // 보내는 중에는 고른 코스도 초안을 바꾸지 않는다.
    assert.equal(run(sending, { type: "choose", changes: choice }).draft.courseId, "course-a");
  });
});

describe("isNewRowSaveHeld", () => {
  it("아직 고치지 않거나 보내는 중이거나 저장을 마친 상태는 떠나기 안내 대상이 아니다(티켓 18)", () => {
    assert.equal(isNewRowSaveHeld("idle"), false);
    assert.equal(isNewRowSaveHeld("saving"), false);
    assert.equal(isNewRowSaveHeld("saved"), false);
  });

  it("저장 실패나 저장 여부 확인 중은 떠나기 전 안내 대상이다(스펙 B07)", () => {
    assert.equal(isNewRowSaveHeld("failed"), true);
    assert.equal(isNewRowSaveHeld("checking"), true);
  });
});
