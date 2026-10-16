import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guestFieldErrors,
  initialQuickBookingState,
  otherGuestTherapistIds,
  quickBookingGuestFieldKey,
  quickBookingGuestPosition,
  quickBookingGuests,
  quickBookingPartyIssueField,
  quickBookingPartyRequest,
  quickBookingReducer,
  quickBookingStepOfField,
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

describe("quick booking party draft (스펙 D10–D12, 티켓 02)", () => {
  it("starts as a party of one, so the single-call flow is unchanged", () => {
    assert.deepEqual(initialQuickBookingState(ledger, "request-1").partyGuests, []);
  });

  it("grows and shrinks the other guests with the party size, keeping guests already chosen", () => {
    const three = run(
      initialQuickBookingState(ledger, "request-1"),
      { type: "partySize", size: 3 },
      { type: "guest", position: 2, changes: { courseId: "course-c", therapist1Id: "therapist-2" } }
    );
    assert.equal(three.touched, true);
    assert.deepEqual(three.partyGuests, [
      { courseId: "course-c", therapist1Id: "therapist-2", therapist2Id: null, roomId: null },
      { courseId: "", therapist1Id: null, therapist2Id: null, roomId: null }
    ]);

    const two = run(three, { type: "partySize", size: 2 });
    assert.deepEqual(two.partyGuests, [{ courseId: "course-c", therapist1Id: "therapist-2", therapist2Id: null, roomId: null }]);
  });

  it("keeps the party size between 1 and 10", () => {
    const base = initialQuickBookingState(ledger, "request-1");
    assert.equal(run(base, { type: "partySize", size: 0 }).partyGuests.length, 0);
    assert.equal(run(base, { type: "partySize", size: 25 }).partyGuests.length, 9);
  });

  it("does not change the party while a save is in flight", () => {
    const submitted = run(initialQuickBookingState(ledger, "request-1"), { type: "partySize", size: 2 }, { type: "submit" });
    const after = run(submitted, { type: "partySize", size: 3 }, { type: "guest", position: 2, changes: { therapist1Id: "therapist-9" } });
    assert.deepEqual(after.partyGuests, submitted.partyGuests);
  });

  it("starts a fresh party of one after the party is saved or discarded", () => {
    const submitted = run(initialQuickBookingState(ledger, "request-1"), { type: "partySize", size: 3 }, { type: "submit" });
    const saved = run(submitted, { type: "saved", request: submitted.save.inFlight!, notice: null, nextRequestId: "request-2" });
    assert.deepEqual(saved.partyGuests, []);
    const discarded = run(initialQuickBookingState(ledger, "request-1"), { type: "partySize", size: 3 }, { type: "discard", nextRequestId: "r" });
    assert.deepEqual(discarded.partyGuests, []);
  });

  it("builds the party save from guest 1 in the draft and the other guests, each guest's course defaulting to guest 1's", () => {
    const state = run(
      initialQuickBookingState(ledger, "request-1"),
      { type: "edit", changes: { startTime: "15:00", customerMemo: "정 대표", note: "단체" } },
      { type: "choose", changes: { courseId: "course-a", therapist1Id: "therapist-1" } },
      { type: "edit", changes: { roomId: "room-101" } },
      { type: "partySize", size: 3 },
      { type: "guest", position: 2, changes: { therapist1Id: "therapist-2" } },
      { type: "guest", position: 3, changes: { courseId: "course-d", therapist1Id: "therapist-3", therapist2Id: "therapist-4", roomId: "room-102" } },
      { type: "submit" }
    );

    const request = quickBookingPartyRequest(state.save.inFlight!, state.partyGuests);

    assert.equal(request.requestId, "request-1");
    assert.equal(request.startTime, "15:00");
    assert.equal(request.customerMemo, "정 대표");
    assert.equal(request.note, "단체");
    assert.equal("courseId" in request, false);
    assert.deepEqual(request.guests, [
      { courseId: "course-a", therapist1Id: "therapist-1", therapist2Id: null, roomId: "room-101" },
      { courseId: "course-a", therapist1Id: "therapist-2", therapist2Id: null, roomId: null },
      { courseId: "course-d", therapist1Id: "therapist-3", therapist2Id: "therapist-4", roomId: "room-102" }
    ]);
  });

  it("lists the therapists other guests already took, so one therapist is not chosen twice", () => {
    const state = run(
      initialQuickBookingState(ledger, "request-1"),
      { type: "choose", changes: { courseId: "course-d", therapist1Id: "therapist-1", therapist2Id: "therapist-2" } },
      { type: "partySize", size: 3 },
      { type: "guest", position: 2, changes: { therapist1Id: "therapist-3" } }
    );
    const guests = quickBookingGuests(state.save.draft, state.partyGuests);
    assert.deepEqual([...otherGuestTherapistIds(guests, 1)].sort(), ["therapist-3"]);
    assert.deepEqual([...otherGuestTherapistIds(guests, 3)].sort(), ["therapist-1", "therapist-2", "therapist-3"]);
  });

  it("routes a guest's save error to that guest's field and to the step it belongs to", () => {
    const fieldErrors = {
      [quickBookingGuestFieldKey(2, "therapist1Id")]: ["두 손님"],
      [quickBookingGuestFieldKey(1, "roomId")]: ["객실"],
      customerMemo: ["메모"]
    };
    assert.deepEqual(guestFieldErrors(fieldErrors, 2), { therapist1Id: ["두 손님"] });
    assert.deepEqual(guestFieldErrors(fieldErrors, 1), { roomId: ["객실"], customerMemo: ["메모"] });
    assert.equal(quickBookingStepOfField(quickBookingGuestFieldKey(2, "therapist1Id")), "therapist");
    assert.equal(quickBookingStepOfField(quickBookingGuestFieldKey(3, "roomId")), "room");
    assert.equal(quickBookingStepOfField("customerMemo"), "customer");
    assert.equal(quickBookingStepOfField("guests"), "therapist");
  });

  it("names the guest of a guest-field key, and nobody for a shared field", () => {
    assert.equal(quickBookingGuestPosition(quickBookingGuestFieldKey(3, "courseId")), 3);
    assert.equal(quickBookingGuestPosition("customerMemo"), null);
  });

  it("turns a rejected party input's guest path (0-based) into that guest's field key (1-based)", () => {
    assert.equal(quickBookingPartyIssueField(["guests", 0, "courseId"]), quickBookingGuestFieldKey(1, "courseId"));
    assert.equal(quickBookingPartyIssueField(["guests", 2, "roomId"]), quickBookingGuestFieldKey(3, "roomId"));
    assert.equal(quickBookingPartyIssueField(["guests"]), "guests");
    assert.equal(quickBookingPartyIssueField(["newCustomer", "name"]), "newCustomer");
  });
});
