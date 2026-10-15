import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialQuickBookingState,
  quickBookingReducer,
  type QuickBookingEvent,
  type QuickBookingState
} from "@/app/(erp)/calls/quick-booking-draft";

const ledger = { operatingMonthId: "month-2026-06", serviceDate: "2026-06-10" };

function run(state: QuickBookingState, ...events: QuickBookingEvent[]) {
  return events.reduce(quickBookingReducer, state);
}

describe("quick booking draft (패널 단계 + 티켓 16 저장 상태머신)", () => {
  it("starts on the customer step, untouched, with the request id it was given", () => {
    const state = initialQuickBookingState(ledger, "request-1");
    assert.equal(state.step, "customer");
    assert.equal(state.touched, false);
    assert.equal(state.save.requestId, "request-1");
  });

  it("moves between steps without losing the draft", () => {
    const edited = run(
      initialQuickBookingState(ledger, "request-1"),
      { type: "edit", changes: { customerMemo: "지윤" } },
      { type: "step", step: "schedule" }
    );
    assert.equal(edited.step, "schedule");
    assert.equal(edited.touched, true);
    assert.equal(edited.save.draft.customerMemo, "지윤");

    const back = run(edited, { type: "step", step: "customer" });
    assert.equal(back.step, "customer");
    assert.equal(back.save.draft.customerMemo, "지윤");
  });

  it("marks the draft touched on edit, choose, submit, failed, and lost", () => {
    const base = initialQuickBookingState(ledger, "request-1");
    for (const event of [
      { type: "edit", changes: { courseId: "course-a" } },
      { type: "choose", changes: { courseId: "course-a" } }
    ] satisfies QuickBookingEvent[]) {
      assert.equal(run(base, event).touched, true);
    }

    const submitted = run(base, { type: "edit", changes: { courseId: "course-a" } }, { type: "submit" });
    assert.equal(submitted.touched, true);

    const lost = run(submitted, { type: "lost", request: submitted.save.inFlight! });
    assert.equal(lost.touched, true);
    assert.equal(lost.save.status, "checking");

    const failed = run(submitted, { type: "failed", request: submitted.save.inFlight!, message: "실패" });
    assert.equal(failed.touched, true);
  });

  it("resets touched and goes back to the customer step once the call is saved", () => {
    const submitted = run(
      initialQuickBookingState(ledger, "request-1"),
      { type: "step", step: "review" },
      { type: "edit", changes: { courseId: "course-a" } },
      { type: "submit" }
    );
    const saved = run(submitted, {
      type: "saved",
      request: submitted.save.inFlight!,
      notice: null,
      nextRequestId: "request-2"
    });
    assert.equal(saved.touched, false);
    assert.equal(saved.step, "customer");
    assert.equal(saved.save.requestId, "request-2");
    assert.equal(saved.save.status, "saved");
  });
});
