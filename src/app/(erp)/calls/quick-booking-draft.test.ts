import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guestFieldErrors,
  initialQuickBookingState,
  quickBookingGuestFieldKey,
  quickBookingGuestPosition,
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

function fresh() {
  return initialQuickBookingState(ledger, "request-1");
}

const c90 = { courseId: "course-c90", therapist1Id: "therapist-12" };

describe("quick booking: two steps (1018 스펙 D19)", () => {
  it("starts on the conditions step as a party of one with nobody picked, untouched", () => {
    const state = fresh();
    assert.equal(state.step, "conditions");
    assert.equal(state.partySize, 1);
    assert.deepEqual(state.guests, []);
    assert.equal(state.touched, false);
    assert.equal(state.save.requestId, "request-1");
  });

  it("moves between the two steps without losing what was picked", () => {
    const state = run(fresh(), { type: "addGuest", guest: c90 }, { type: "step", step: "customer" }, { type: "step", step: "conditions" });
    assert.equal(state.step, "conditions");
    assert.equal(state.guests.length, 1);
  });

  it("routes save errors of the guest fields to the conditions step and the booking fields to the customer step", () => {
    assert.equal(quickBookingStepOfField("startTime"), "conditions");
    assert.equal(quickBookingStepOfField("therapist1Id"), "conditions");
    assert.equal(quickBookingStepOfField(quickBookingGuestFieldKey(2, "therapist2Id")), "conditions");
    assert.equal(quickBookingStepOfField("guests"), "conditions");
    assert.equal(quickBookingStepOfField("bookerName"), "customer");
    assert.equal(quickBookingStepOfField("bookerHandle"), "customer");
    assert.equal(quickBookingStepOfField("bookingChannelCode"), "customer");
    assert.equal(quickBookingStepOfField("visitRequest"), "customer");
    assert.equal(quickBookingStepOfField("newCustomer"), "customer");
  });
});

describe("quick booking: picking guests with course chips (1018 스펙 D20)", () => {
  it("adds a named guest from a Therapist's chip and an unassigned guest from the 미지명 chip", () => {
    const state = run(
      fresh(),
      { type: "partySize", size: 2 },
      { type: "addGuest", guest: c90 },
      { type: "addGuest", guest: { courseId: "course-c90", therapist1Id: null } }
    );
    assert.equal(state.touched, true);
    assert.deepEqual(state.guests, [
      { courseId: "course-c90", therapist1Id: "therapist-12", therapist2Id: null, roomId: null },
      { courseId: "course-c90", therapist1Id: null, therapist2Id: null, roomId: null }
    ]);
  });

  it("does not take more guests than the party size", () => {
    const state = run(fresh(), { type: "addGuest", guest: c90 }, { type: "addGuest", guest: { courseId: "course-a", therapist1Id: "therapist-7" } });
    assert.deepEqual(
      state.guests.map((guest) => guest.therapist1Id),
      ["therapist-12"]
    );
  });

  it("does not give one Therapist to two guests, but takes any number of unassigned guests", () => {
    const state = run(
      fresh(),
      { type: "partySize", size: 4 },
      { type: "addGuest", guest: c90 },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: "therapist-12" } },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: null } },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: null } }
    );
    assert.deepEqual(
      state.guests.map((guest) => guest.therapist1Id),
      ["therapist-12", null, null]
    );
  });

  it("removes a picked guest, and a guest removed frees that Therapist again", () => {
    const state = run(
      fresh(),
      { type: "partySize", size: 2 },
      { type: "addGuest", guest: c90 },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: "therapist-7" } },
      { type: "removeGuest", index: 0 },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: "therapist-12" } }
    );
    assert.deepEqual(
      state.guests.map((guest) => guest.therapist1Id),
      ["therapist-7", "therapist-12"]
    );
  });

  it("keeps the party size between 1 and 10 and drops the last guests when it shrinks", () => {
    assert.equal(run(fresh(), { type: "partySize", size: 0 }).partySize, 1);
    assert.equal(run(fresh(), { type: "partySize", size: 25 }).partySize, 10);
    const shrunk = run(
      fresh(),
      { type: "partySize", size: 3 },
      { type: "addGuest", guest: c90 },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: null } },
      { type: "partySize", size: 1 }
    );
    assert.deepEqual(
      shrunk.guests.map((guest) => guest.therapist1Id),
      ["therapist-12"]
    );
  });

  it("sets and clears a D-course guest's second Therapist, never the guest's own first Therapist or another guest's", () => {
    const base = run(
      fresh(),
      { type: "partySize", size: 2 },
      { type: "addGuest", guest: { courseId: "course-d", therapist1Id: "therapist-12" } },
      { type: "addGuest", guest: { courseId: "course-a", therapist1Id: "therapist-7" } }
    );
    assert.equal(run(base, { type: "secondTherapist", index: 0, therapistId: "therapist-3" }).guests[0].therapist2Id, "therapist-3");
    assert.equal(run(base, { type: "secondTherapist", index: 0, therapistId: "therapist-12" }).guests[0].therapist2Id, null);
    assert.equal(run(base, { type: "secondTherapist", index: 0, therapistId: "therapist-7" }).guests[0].therapist2Id, null);
    const cleared = run(base, { type: "secondTherapist", index: 0, therapistId: "therapist-3" }, { type: "secondTherapist", index: 0, therapistId: null });
    assert.equal(cleared.guests[0].therapist2Id, null);
  });

  it("does not change the guests while a save is in flight", () => {
    const submitted = run(fresh(), { type: "addGuest", guest: c90 }, { type: "submit" });
    const after = run(submitted, { type: "removeGuest", index: 0 }, { type: "partySize", size: 3 });
    assert.deepEqual(after.guests, submitted.guests);
    assert.equal(after.partySize, 1);
  });
});

describe("quick booking: saving (1018 스펙 D21–D22)", () => {
  it("does not save until the party size is filled", () => {
    const state = run(fresh(), { type: "partySize", size: 2 }, { type: "addGuest", guest: c90 }, { type: "submit" });
    assert.equal(state.save.inFlight, null);
    assert.equal(state.save.status, "idle");
  });

  it("saves guest 1 as the call itself, with the booker name in the customer/memo column and the memo as the visit request", () => {
    const state = run(
      fresh(),
      { type: "edit", changes: { startTime: "18:00", bookingChannelCode: "TELEGRAM", bookerName: " 홍길동 ", visitRequest: "창가 자리" } },
      { type: "addGuest", guest: c90 },
      { type: "submit" }
    );
    const request = state.save.inFlight!;
    assert.equal(request.requestId, "request-1");
    assert.equal(request.courseId, "course-c90");
    assert.equal(request.therapist1Id, "therapist-12");
    assert.equal(request.roomId, null);
    assert.equal(request.bookingChannelCode, "TELEGRAM");
    assert.equal(request.bookerName, "홍길동");
    assert.equal(request.customerMemo, "홍길동");
    assert.equal(request.visitRequest, "창가 자리");
  });

  it("sends the booker's ID or contact trimmed", () => {
    const state = run(
      fresh(),
      { type: "edit", changes: { bookingChannelCode: "ZALO", bookerName: "Nguyen", bookerHandle: " @nguyen88 " } },
      { type: "addGuest", guest: c90 },
      { type: "submit" }
    );
    assert.equal(state.save.inFlight!.bookerHandle, "@nguyen88");
  });

  // 2026-10-23 고객 요청: 전화 예약도 ID / 연락처 칸에 번호를 적는다. 모든 경로가 같은 칸을 보낸다.
  it("sends the ID or contact for phone, walk-in, and no channel too", () => {
    for (const bookingChannelCode of ["PHONE", "WALK_IN", null]) {
      const state = run(
        fresh(),
        { type: "edit", changes: { bookingChannelCode, bookerName: "찰스", bookerHandle: " +62 811-3116-8866 " } },
        { type: "addGuest", guest: c90 },
        { type: "submit" }
      );
      assert.equal(state.save.inFlight!.bookerHandle, "+62 811-3116-8866", String(bookingChannelCode));
    }
  });

  it("creates a new customer named after the booker when no existing customer was chosen", () => {
    const state = run(fresh(), { type: "edit", changes: { bookerName: "홍길동" } }, { type: "addGuest", guest: c90 }, { type: "submit" });
    assert.deepEqual(state.save.inFlight!.newCustomer, { name: "홍길동", phone: null, memo: null, preferenceNote: null });
    assert.equal(state.save.inFlight!.customerId, null);
  });

  it("links the chosen customer instead of creating one", () => {
    const state = run(
      fresh(),
      { type: "edit", changes: { bookerName: "홍길동", customerId: "customer-1" } },
      { type: "addGuest", guest: c90 },
      { type: "submit" }
    );
    assert.equal(state.save.inFlight!.customerId, "customer-1");
    assert.equal(state.save.inFlight!.newCustomer, null);
  });

  it("creates no customer without a booker name (the server names a walk-in)", () => {
    const state = run(fresh(), { type: "edit", changes: { bookingChannelCode: "WALK_IN" } }, { type: "addGuest", guest: c90 }, { type: "submit" });
    assert.equal(state.save.inFlight!.newCustomer, null);
    assert.equal(state.save.inFlight!.bookerName ?? null, null);
  });

  it("builds a party save from the picked guests, guest 1 first", () => {
    const state = run(
      fresh(),
      { type: "edit", changes: { startTime: "18:00", bookerName: "홍길동" } },
      { type: "partySize", size: 2 },
      { type: "addGuest", guest: c90 },
      { type: "addGuest", guest: { courseId: "course-c90", therapist1Id: null } },
      { type: "submit" }
    );
    const request = quickBookingPartyRequest(state.save.inFlight!, state.guests.slice(1));
    assert.equal(request.customerMemo, "홍길동");
    assert.deepEqual(request.guests, [
      { courseId: "course-c90", therapist1Id: "therapist-12", therapist2Id: null, roomId: null },
      { courseId: "course-c90", therapist1Id: null, therapist2Id: null, roomId: null }
    ]);
  });

  it("starts over on the conditions step with nobody picked once saved", () => {
    const submitted = run(fresh(), { type: "partySize", size: 1 }, { type: "addGuest", guest: c90 }, { type: "step", step: "customer" }, { type: "submit" });
    const saved = run(submitted, { type: "saved", request: submitted.save.inFlight!, notice: null, nextRequestId: "request-2" });
    assert.equal(saved.step, "conditions");
    assert.equal(saved.touched, false);
    assert.deepEqual(saved.guests, []);
    assert.equal(saved.partySize, 1);
    assert.equal(saved.save.requestId, "request-2");
  });

  it("keeps the picks and stays touched when the save fails or is lost", () => {
    const submitted = run(fresh(), { type: "addGuest", guest: c90 }, { type: "submit" });
    const failed = run(submitted, { type: "failed", request: submitted.save.inFlight!, message: "실패" });
    assert.equal(failed.touched, true);
    assert.equal(failed.guests.length, 1);
    const lost = run(submitted, { type: "lost", request: submitted.save.inFlight! });
    assert.equal(lost.save.status, "checking");
  });
});

describe("quick booking: save error keys", () => {
  it("routes a guest's save error to that guest's field", () => {
    const fieldErrors = {
      [quickBookingGuestFieldKey(2, "therapist1Id")]: ["두 손님"],
      [quickBookingGuestFieldKey(1, "roomId")]: ["객실"],
      customerMemo: ["메모"]
    };
    assert.deepEqual(guestFieldErrors(fieldErrors, 2), { therapist1Id: ["두 손님"] });
    assert.deepEqual(guestFieldErrors(fieldErrors, 1), { roomId: ["객실"], customerMemo: ["메모"] });
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

describe("quick booking: one more guest for a party (스펙 D14, 티켓 04)", () => {
  const join = {
    partyId: "party-jung",
    serviceDate: "2026-06-10",
    startTime: "11:00",
    customerMemo: "정 대표 일행",
    bookingChannelCode: null,
    bookerName: null,
    bookerHandle: null,
    size: 3
  };

  it("starts fresh on the conditions step with the party's time, memo and party id, untouched, with a new request id", () => {
    const state = run(
      fresh(),
      { type: "edit", changes: { bookerName: "다른 손님", note: "창가" } },
      { type: "partySize", size: 3 },
      { type: "joinParty", join, nextRequestId: "request-2" }
    );
    assert.equal(state.step, "conditions");
    assert.equal(state.touched, false);
    assert.equal(state.save.requestId, "request-2");
    assert.equal(state.partySize, 1);
    assert.deepEqual(state.joinParty, join);
    const { serviceDate, startTime, customerMemo, partyId, note, customerId, bookerName } = state.save.draft;
    assert.deepEqual(
      { serviceDate, startTime, customerMemo, partyId, note, customerId, bookerName },
      { serviceDate: "2026-06-10", startTime: "11:00", customerMemo: "정 대표 일행", partyId: "party-jung", note: null, customerId: null, bookerName: null }
    );
  });

  it("stays a party of one, keeps the party's memo, and never links or creates a customer for the added guest", () => {
    const joined = run(fresh(), { type: "joinParty", join, nextRequestId: "request-2" });
    assert.equal(run(joined, { type: "partySize", size: 2 }).partySize, 1);
    const submitted = run(joined, { type: "edit", changes: { bookerName: "정 대표" } }, { type: "addGuest", guest: c90 }, { type: "submit" });
    assert.equal(submitted.save.inFlight!.newCustomer, null);
    assert.equal(submitted.save.inFlight!.customerMemo, "정 대표");
    const unnamed = run(joined, { type: "addGuest", guest: c90 }, { type: "submit" });
    assert.equal(unnamed.save.inFlight!.customerMemo, "정 대표 일행");
  });

  describe("only at the party's time (1018 스펙 D29)", () => {
    const telegram = { ...join, bookingChannelCode: "TELEGRAM", bookerName: "정 대표", bookerHandle: "@jungdp" };

    it("carries the party's channel, booker name, and messenger ID, and joins the party at the party's time", () => {
      const joined = run(fresh(), { type: "joinParty", join: telegram, nextRequestId: "request-2" });
      assert.deepEqual(
        [joined.save.draft.bookingChannelCode, joined.save.draft.bookerName, joined.save.draft.bookerHandle],
        ["TELEGRAM", "정 대표", "@jungdp"]
      );
      const submitted = run(joined, { type: "addGuest", guest: c90 }, { type: "submit" });
      assert.equal(submitted.save.inFlight!.partyId, "party-jung");
      assert.equal(submitted.save.inFlight!.bookerHandle, "@jungdp");
    });

    it("saves a guest moved to another time as a separate booking that keeps only the channel, booker name, and messenger ID", () => {
      const moved = run(
        fresh(),
        { type: "joinParty", join: telegram, nextRequestId: "request-2" },
        { type: "edit", changes: { startTime: "12:00" } },
        { type: "addGuest", guest: c90 },
        { type: "submit" }
      );
      const { partyId, startTime, bookingChannelCode, bookerName, bookerHandle, customerMemo } = moved.save.inFlight!;
      assert.deepEqual(
        { partyId: partyId ?? null, startTime, bookingChannelCode, bookerName, bookerHandle, customerMemo },
        { partyId: null, startTime: "12:00", bookingChannelCode: "TELEGRAM", bookerName: "정 대표", bookerHandle: "@jungdp", customerMemo: "정 대표" }
      );
    });

    it("treats the separate booking's customer like any booking: a picked customer is linked, otherwise the booker name makes a new one", () => {
      const moved = run(fresh(), { type: "joinParty", join: telegram, nextRequestId: "request-2" }, { type: "edit", changes: { startTime: "12:00" } }, { type: "addGuest", guest: c90 });
      assert.deepEqual(run(moved, { type: "submit" }).save.inFlight!.newCustomer, { name: "정 대표", phone: null, memo: null, preferenceNote: null });
      const picked = run(moved, { type: "edit", changes: { customerId: "customer-jung" } }, { type: "submit" }).save.inFlight!;
      assert.deepEqual([picked.customerId, picked.newCustomer], ["customer-jung", null]);
    });

    it("does not carry the party's memo into a separate booking without a booker name", () => {
      const moved = run(
        fresh(),
        { type: "joinParty", join, nextRequestId: "request-2" },
        { type: "edit", changes: { startTime: "12:00" } },
        { type: "addGuest", guest: c90 },
        { type: "submit" }
      );
      assert.deepEqual([moved.save.inFlight!.bookerName, moved.save.inFlight!.customerMemo], [null, null]);
    });

    it("joins the party again when the time is moved back", () => {
      const back = run(
        fresh(),
        { type: "joinParty", join: telegram, nextRequestId: "request-2" },
        { type: "edit", changes: { startTime: "12:00" } },
        { type: "edit", changes: { startTime: "11:00" } },
        { type: "addGuest", guest: c90 },
        { type: "submit" }
      );
      assert.equal(back.save.inFlight!.partyId, "party-jung");
    });
  });

  it("forgets the party once saved or discarded", () => {
    const joined = run(fresh(), { type: "joinParty", join, nextRequestId: "request-2" });
    const submitted = run(joined, { type: "addGuest", guest: c90 }, { type: "submit" });
    const saved = run(submitted, { type: "saved", request: submitted.save.inFlight!, notice: null, nextRequestId: "request-3" });
    assert.equal(saved.joinParty, null);
    assert.equal(saved.save.draft.partyId ?? null, null);
    assert.equal(run(joined, { type: "discard", nextRequestId: "request-4" }).joinParty, null);
  });
});

describe("quick booking: a Therapist chosen from the ledger status strip (1018 스펙 D17)", () => {
  it("starts fresh and untouched at the given date and time with that Therapist preselected and a new request id", () => {
    const state = run(
      fresh(),
      { type: "edit", changes: { bookerName: "다른 손님", serviceDate: "2026-06-11" } },
      { type: "partySize", size: 2 },
      { type: "start", presetTherapistId: "therapist-12", serviceDate: "2026-06-10", startTime: "18:00", nextRequestId: "request-2" }
    );
    assert.equal(state.step, "conditions");
    assert.equal(state.touched, false);
    assert.equal(state.save.requestId, "request-2");
    assert.equal(state.partySize, 1);
    assert.deepEqual(state.guests, []);
    assert.equal(state.presetTherapistId, "therapist-12");
    assert.equal(state.save.draft.startTime, "18:00");
    assert.equal(state.save.draft.serviceDate, "2026-06-10");
    assert.equal(state.save.draft.bookerName ?? null, null);
  });

  it("keeps the preselected Therapist on top while picking, and forgets it once the draft is discarded", () => {
    const preset = run(fresh(), { type: "start", presetTherapistId: "therapist-12", serviceDate: "2026-06-10", startTime: "18:00", nextRequestId: "r" });
    assert.equal(run(preset, { type: "discard", nextRequestId: "r2" }).presetTherapistId, null);
    assert.equal(run(preset, { type: "addGuest", guest: c90 }).presetTherapistId, "therapist-12");
  });
});
