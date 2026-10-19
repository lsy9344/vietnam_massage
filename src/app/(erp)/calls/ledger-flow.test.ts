import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entryClock,
  freeRoomOptions,
  ledgerFlowItems,
  ledgerTimeline,
  lateMinutes,
  ledgerEndView,
  ledgerWhoLabel,
  roomPickList,
  therapistPickList,
  nowDividerIndex,
  ledgerListKey,
  nextLedgerAction,
  partyEntryTargets,
  statusCodeFor
} from "@/app/(erp)/calls/ledger-flow";

function call(id: string, startTime: string, status: string) {
  return { id, startTime, status };
}

describe("ledger timeline (1018 ticket 02)", () => {
  it("keeps every open call in one list in the ledger's time order, and moves finished calls to the folded part", () => {
    const timeline = ledgerTimeline([
      call("done-11", "11:00", "VISIT_COMPLETE"),
      call("reserved-12", "12:00", "RESERVED"),
      call("in-use-13", "13:00", "IN_USE"),
      call("cleaning-14", "14:00", "CLEANING"),
      call("canceled-15", "15:00", "CANCELED"),
      call("reserved-16", "16:00", "예약"),
      call("no-show-17", "17:00", "노쇼")
    ]);

    assert.deepEqual(timeline.open.map((row) => row.id), ["reserved-12", "in-use-13", "cleaning-14", "reserved-16"]);
    assert.deepEqual(timeline.done.map((row) => row.id), ["done-11", "canceled-15", "no-show-17"]);
  });
});

describe("now line and lateness (1018 ticket 02)", () => {
  it("puts the now line before the first call booked after now, counting past midnight as the same business day", () => {
    const times = ["23:00", "00:30", "01:00", "02:00"];
    assert.equal(nowDividerIndex(times, "01:00", "11:00"), 3);
    assert.equal(nowDividerIndex(times, "22:00", "11:00"), 0);
    assert.equal(nowDividerIndex(times, "03:00", "11:00"), 4);
  });

  it("says how many minutes a reservation is late once its time has passed, and nothing for other statuses", () => {
    assert.equal(lateMinutes("RESERVED", "00:30", "01:05", "11:00"), 35);
    assert.equal(lateMinutes("예약", "23:50", "00:10", "11:00"), 20);
    assert.equal(lateMinutes("RESERVED", "01:00", "01:00", "11:00"), null);
    assert.equal(lateMinutes("RESERVED", "02:00", "01:00", "11:00"), null);
    assert.equal(lateMinutes("IN_USE", "00:30", "01:05", "11:00"), null);
  });
});

describe("entry and end on the top line (1018 ticket 02)", () => {
  it("shows not entered before entry, the expected display end faintly before the end, and the actual end after it", () => {
    assert.deepEqual(ledgerEndView({ actualEntryTime: null, actualEndTime: null, displayEnd: "17:00" }), { kind: "notEntered" });
    assert.deepEqual(ledgerEndView({ actualEntryTime: "16:10", actualEndTime: null, displayEnd: "17:10" }), { kind: "expected", time: "17:10" });
    assert.deepEqual(ledgerEndView({ actualEntryTime: "16:10", actualEndTime: "16:58", displayEnd: "17:10" }), { kind: "actual", time: "16:58" });
  });
});

describe("who booked, on the bottom line (1018 ticket 02)", () => {
  const channels = [{ value: "TELEGRAM", label: "텔레그램" }];
  const customers = [{ id: "customer-kim", name: "김민수" }];
  const call = (overrides: Partial<Parameters<typeof ledgerWhoLabel>[0]> = {}) => ({
    bookingChannelCode: null,
    bookerName: null,
    customerId: null,
    customerMemo: null,
    ...overrides
  });

  it("names the booking channel and the booker", () => {
    assert.deepEqual(ledgerWhoLabel(call({ bookingChannelCode: "TELEGRAM", bookerName: "홍길동" }), channels, customers), {
      channel: "텔레그램",
      name: "홍길동"
    });
  });

  it("falls back on old calls to the customer's name, then to the first line of the customer memo", () => {
    assert.deepEqual(ledgerWhoLabel(call({ customerId: "customer-kim", customerMemo: "메모" }), channels, customers), { channel: null, name: "김민수" });
    assert.deepEqual(ledgerWhoLabel(call({ customerMemo: "정 대표\n2층 선호" }), channels, customers), { channel: null, name: "정 대표" });
    assert.deepEqual(ledgerWhoLabel(call(), channels, customers), { channel: null, name: null });
  });
});

describe("therapist cell list (1018 ticket 02)", () => {
  const therapist = (
    therapistId: string,
    verdict: "possible" | "time_short" | "rate_missing",
    done: number,
    attendance: "before_check_in" | "checked_in" | "checked_out" = "checked_in"
  ) => ({
    therapistId,
    therapistName: therapistId,
    attendance,
    available: verdict === "possible",
    freeFrom: verdict === "time_short" ? "18:00" : null,
    callCounts: { done, reserved: 0 },
    courses: [{ courseId: "course-a", verdict }]
  });

  it("puts who can take the call's course first, fewest finished today first, and the rest below with why", () => {
    const list = therapistPickList(
      [
        therapist("busy", "time_short", 0),
        therapist("two-done", "possible", 2),
        therapist("no-rate", "rate_missing", 0),
        therapist("none-done", "possible", 0),
        therapist("gone", "possible", 0, "checked_out"),
        therapist("not-in-yet", "possible", 0, "before_check_in"),
        therapist("one-done", "possible", 1)
      ],
      "course-a"
    );
    assert.deepEqual(
      list.map((entry) => [entry.therapistId, entry.verdict]),
      [
        ["none-done", "possible"],
        ["one-done", "possible"],
        ["two-done", "possible"],
        ["busy", "time_short"],
        ["no-rate", "rate_missing"],
        ["gone", "possible"],
        ["not-in-yet", "possible"]
      ]
    );
  });

  it("judges a course the day's availability does not offer by the time alone", () => {
    const list = therapistPickList([therapist("busy", "time_short", 0), therapist("free", "possible", 0)], "course-retired");
    assert.deepEqual(
      list.map((entry) => [entry.therapistId, entry.verdict]),
      [
        ["free", "possible"],
        ["busy", "time_short"]
      ]
    );
  });
});

describe("room cell list (1018 ticket 02)", () => {
  it("puts free rooms first and keeps rooms in use or being cleaned below", () => {
    const rooms = [
      { value: "room-101", label: "101" },
      { value: "room-102", label: "102" },
      { value: "room-103", label: "103" }
    ];
    const rows = [
      { id: "me", status: "RESERVED", roomId: "room-103" },
      { id: "using", status: "IN_USE", roomId: "room-101" },
      { id: "later", status: "RESERVED", roomId: "room-102" }
    ];
    assert.deepEqual(
      roomPickList(rooms, rows, "me").map((room) => [room.value, room.free]),
      [
        ["room-102", true],
        ["room-103", true],
        ["room-101", false]
      ]
    );
  });
});

describe("parties inside a flow section", () => {
  function member(id: string, status: string, partyPosition: number, roomId: string | null = null) {
    return { id, status, partyId: "party-jung", partyPosition, roomId };
  }

  it("keeps a party together at its first member's place, in party order, and splits it where the flow differs", () => {
    const rows = [
      { id: "solo-10", status: "RESERVED", partyId: null, partyPosition: null },
      member("jung-2", "RESERVED", 2),
      member("jung-1", "RESERVED", 1),
      { id: "solo-11", status: "RESERVED", partyId: null, partyPosition: null },
      member("jung-3", "NO_SHOW", 3)
    ];
    const { open, done } = ledgerTimeline(rows);

    const summary = (part: typeof open) =>
      ledgerFlowItems(part, rows).map((item) =>
        item.kind === "call" ? item.row.id : [item.partyId, item.size, item.lead.id, item.rows.map((row) => row.id)]
      );
    assert.deepEqual(summary(open), ["solo-10", ["party-jung", 3, "jung-1", ["jung-1", "jung-2"]], "solo-11"]);
    assert.deepEqual(summary(done), [["party-jung", 3, "jung-1", ["jung-3"]]]);
  });

  it("enters only the party's reservations, and asks for a room only for those without one", () => {
    assert.deepEqual(
      partyEntryTargets([member("jung-1", "RESERVED", 1, "room-101"), member("jung-2", "예약", 2), member("jung-3", "IN_USE", 3, "room-102"), member("jung-4", "CANCELED", 4)]),
      [
        { callId: "jung-1", needsRoom: false },
        { callId: "jung-2", needsRoom: true }
      ]
    );
  });
});

describe("next action on a ledger line", () => {
  it("offers entry for a reservation, payment while the guest is in, and nothing once the call is finished", () => {
    assert.equal(nextLedgerAction("RESERVED"), "enter");
    assert.equal(nextLedgerAction("IN_USE"), "pay");
    assert.equal(nextLedgerAction("CLEANING"), "pay");
    assert.equal(nextLedgerAction("VISIT_COMPLETE"), null);
    assert.equal(nextLedgerAction("CANCELED"), null);
    assert.equal(nextLedgerAction("NO_SHOW"), null);
  });
});

describe("entry time for the entry button", () => {
  it("rounds the clock to the nearest ten minutes, as the actual-entry choices are", () => {
    assert.equal(entryClock("14:00"), "14:00");
    assert.equal(entryClock("14:04"), "14:00");
    assert.equal(entryClock("14:05"), "14:10");
    assert.equal(entryClock("14:56"), "15:00");
    assert.equal(entryClock("23:57"), "00:00");
  });
});

describe("free rooms for the entry button", () => {
  const rooms = [
    { value: "r1", label: "101" },
    { value: "r2", label: "102" },
    { value: "r3", label: "103" },
    { value: "r4", label: "104" }
  ];

  it("leaves out rooms a guest is in or that are being cleaned, but not rooms of reservations or finished calls", () => {
    const rows = [
      { id: "a", status: "IN_USE", roomId: "r1" },
      { id: "b", status: "CLEANING", roomId: "r2" },
      { id: "c", status: "RESERVED", roomId: "r3" },
      { id: "d", status: "VISIT_COMPLETE", roomId: "r4" },
      { id: "e", status: "IN_USE", roomId: null }
    ];
    assert.deepEqual(freeRoomOptions(rooms, rows, "c").map((room) => room.value), ["r3", "r4"]);
  });
});

describe("status codes the entry and payment buttons save", () => {
  it("finds in-use and visit-complete among the active status codes, whether stored as codes or as old Korean values", () => {
    const codes = [
      { value: "RESERVED", label: "Đặt trước" },
      { value: "IN_USE", label: "Đang dùng" },
      { value: "VISIT_COMPLETE", label: "Hoàn tất" }
    ];
    assert.equal(statusCodeFor(codes, "inUse"), "IN_USE");
    assert.equal(statusCodeFor(codes, "visitComplete"), "VISIT_COMPLETE");
    assert.equal(statusCodeFor([{ value: "사용중", label: "사용중" }], "inUse"), "사용중");
    assert.equal(statusCodeFor([{ value: "RESERVED", label: "예약" }], "visitComplete"), null);
  });

  it("finds the cancel code the party cancel saves", () => {
    assert.equal(statusCodeFor([{ value: "RESERVED", label: "예약" }, { value: "CANCELED", label: "취소" }], "canceled"), "CANCELED");
    assert.equal(statusCodeFor([{ value: "취소", label: "취소" }], "canceled"), "취소");
  });
});

describe("ledger list keys", () => {
  const onLine = { inField: false, modified: false };

  it("moves between lines with the arrows, opens the panel with Enter, goes back with Escape and opens quick booking with N", () => {
    assert.equal(ledgerListKey({ key: "ArrowDown", ...onLine }), "next");
    assert.equal(ledgerListKey({ key: "ArrowUp", ...onLine }), "previous");
    assert.equal(ledgerListKey({ key: "Enter", ...onLine }), "open");
    assert.equal(ledgerListKey({ key: "Escape", ...onLine }), "back");
    assert.equal(ledgerListKey({ key: "n", ...onLine }), "quickBooking");
    assert.equal(ledgerListKey({ key: "N", ...onLine }), "quickBooking");
    assert.equal(ledgerListKey({ key: "x", ...onLine }), null);
  });

  it("leaves typing alone: no shortcut works inside a field or with a modifier key, except Escape back to the list", () => {
    assert.equal(ledgerListKey({ key: "n", inField: true, modified: false }), null);
    assert.equal(ledgerListKey({ key: "ArrowDown", inField: true, modified: false }), null);
    assert.equal(ledgerListKey({ key: "Enter", inField: true, modified: false }), null);
    assert.equal(ledgerListKey({ key: "Escape", inField: true, modified: false }), "back");
    assert.equal(ledgerListKey({ key: "n", inField: false, modified: true }), null);
  });
});
