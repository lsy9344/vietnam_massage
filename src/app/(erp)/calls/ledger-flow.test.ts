import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entryClock,
  freeRoomOptions,
  ledgerFlowItems,
  ledgerFlowSections,
  ledgerListKey,
  nextLedgerAction,
  partyEntryTargets,
  statusCodeFor
} from "@/app/(erp)/calls/ledger-flow";

function call(id: string, startTime: string, status: string) {
  return { id, startTime, status };
}

describe("ledger flow sections", () => {
  it("puts calls in use, then reservations, then finished calls, keeping the ledger's time order inside each", () => {
    const sections = ledgerFlowSections([
      call("done-11", "11:00", "VISIT_COMPLETE"),
      call("reserved-12", "12:00", "RESERVED"),
      call("in-use-13", "13:00", "IN_USE"),
      call("cleaning-14", "14:00", "CLEANING"),
      call("canceled-15", "15:00", "CANCELED"),
      call("reserved-16", "16:00", "예약"),
      call("no-show-17", "17:00", "노쇼")
    ]);

    assert.deepEqual(
      sections.map((section) => [section.flow, section.rows.map((row) => row.id)]),
      [
        ["active", ["in-use-13", "cleaning-14"]],
        ["reserved", ["reserved-12", "reserved-16"]],
        ["done", ["done-11", "canceled-15", "no-show-17"]]
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
    const [, reserved, done] = ledgerFlowSections(rows);

    const summary = (section: typeof reserved) =>
      ledgerFlowItems(section.rows, rows).map((item) =>
        item.kind === "call" ? item.row.id : [item.partyId, item.size, item.lead.id, item.rows.map((row) => row.id)]
      );
    assert.deepEqual(summary(reserved), ["solo-10", ["party-jung", 3, "jung-1", ["jung-1", "jung-2"]], "solo-11"]);
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
