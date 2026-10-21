import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seatShortage, seatTimeline, type SeatFacts, type SeatPoint } from "@/modules/calls/seat-capacity";

// 영업일 분(business minute). 18:00 = 1080.
const at = (clock: string) => {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
};

const allDay = (therapistId: string) => ({ therapistId, from: null, until: null });
const counts = (points: SeatPoint[]) => points.map(({ offsetMinutes, capacity, remaining }) => ({ offsetMinutes, capacity, remaining }));
const unassignedGuest = (minutes: number, requiresSecondTherapist = false) => ({ minutes, therapistIds: [], requiresSecondTherapist });

describe("seat timeline (1018 스펙 D24–D27)", () => {
  // 고객 예시: 10명이 일하고, 18:00에 미지명 4건과 지명 3건이 걸려 있으면 남은 자리는 3이다.
  it("leaves 3 of 10 seats at 18:00 with 4 unassigned and 3 named calls", () => {
    const therapists = Array.from({ length: 10 }, (_, index) => allDay(`t${index + 1}`));
    const named = ["t1", "t2", "t3"].map((therapistId) => ({
      start: at("18:00"),
      end: at("19:00"),
      therapistIds: [therapistId],
      requiresSecondTherapist: false
    }));
    const unassigned = Array.from({ length: 4 }, () => ({
      start: at("17:30"),
      end: at("19:00"),
      therapistIds: [],
      requiresSecondTherapist: false
    }));
    const facts: SeatFacts = { therapists, calls: [...named, ...unassigned] };

    assert.deepEqual(counts(seatTimeline(facts, at("18:00"), 60))[0], { offsetMinutes: 0, capacity: 10, remaining: 3 });
  });

  it("holds 2 seats for an unassigned D course, and the first therapist plus 1 seat once only the first is assigned", () => {
    const therapists = ["t1", "t2", "t3", "t4"].map(allDay);
    const unassignedD = { start: at("18:00"), end: at("19:30"), therapistIds: [], requiresSecondTherapist: true };
    const unassigned = seatTimeline({ therapists, calls: [unassignedD] }, at("18:00"), 60)[0];
    assert.equal(unassigned.remaining, 2);
    assert.deepEqual(unassigned.freeTherapistIds, ["t1", "t2", "t3", "t4"]);

    const halfAssigned = seatTimeline({ therapists, calls: [{ ...unassignedD, therapistIds: ["t1"] }] }, at("18:00"), 60)[0];
    assert.equal(halfAssigned.remaining, 2);
    assert.deepEqual(halfAssigned.freeTherapistIds, ["t2", "t3", "t4"]);
  });

  // 원장 Therapist 칸에서 미지명 콜에 배정하면 그 자리는 개인 배정으로 바뀌고, 같은 콜을 두 번 빼지 않는다(D27).
  it("keeps the same remaining seats when an unassigned call gets a therapist", () => {
    const therapists = ["t1", "t2", "t3"].map(allDay);
    const call = { start: at("18:00"), end: at("19:00"), therapistIds: [] as string[], requiresSecondTherapist: false };

    const before = seatTimeline({ therapists, calls: [call] }, at("18:00"), 60)[0];
    const after = seatTimeline({ therapists, calls: [{ ...call, therapistIds: ["t2"] }] }, at("18:00"), 60)[0];

    assert.deepEqual(counts([before]), [{ offsetMinutes: 0, capacity: 3, remaining: 2 }]);
    assert.deepEqual(counts([after]), counts([before]));
  });

  it("counts a therapist only inside the working window: from the start, until check-out", () => {
    const therapists = [allDay("t1"), { therapistId: "t2", from: at("18:00"), until: null }, { therapistId: "t3", from: null, until: at("19:00") }];

    assert.deepEqual(counts(seatTimeline({ therapists, calls: [] }, at("17:00"), 180)), [
      { offsetMinutes: 0, capacity: 2, remaining: 2 },
      { offsetMinutes: 60, capacity: 3, remaining: 3 },
      { offsetMinutes: 120, capacity: 2, remaining: 2 }
    ]);
  });

  // 일하지 않는 사람에게 배정된 콜은 자리 수에 없던 사람이라 남은 자리를 줄이지 않는다(가정).
  it("takes no seat for a call assigned to a therapist who is not working", () => {
    const therapists = ["t1", "t2"].map(allDay);
    const call = { start: at("18:00"), end: at("19:00"), therapistIds: ["off-duty"], requiresSecondTherapist: false };

    assert.deepEqual(counts(seatTimeline({ therapists, calls: [call] }, at("18:00"), 60)), [{ offsetMinutes: 0, capacity: 2, remaining: 2 }]);
  });
});

describe("seat shortage (1018 스펙 D25·D26)", () => {
  // 17:00의 미지명 90분은 18:30까지 걸친다. 18:30부터 미지명 두 건이 더 있어 18:00 예약은 구간 안의 18:30이 가장 모자란다.
  const facts: SeatFacts = {
    therapists: ["t1", "t2", "t3"].map(allDay),
    calls: [
      { start: at("17:00"), end: at("18:30"), therapistIds: [], requiresSecondTherapist: false },
      { start: at("18:30"), end: at("19:30"), therapistIds: [], requiresSecondTherapist: false },
      { start: at("18:30"), end: at("19:30"), therapistIds: [], requiresSecondTherapist: false }
    ]
  };
  const timeline = seatTimeline(facts, at("18:00"), 120);

  it("judges a new booking by the lowest remaining seats over its whole course", () => {
    assert.deepEqual(timeline.map((point) => point.remaining), [2, 1, 3]);

    const shortage = seatShortage(timeline, [unassignedGuest(60), unassignedGuest(60)]);
    assert.deepEqual(shortage && { offsetMinutes: shortage.point.offsetMinutes, remaining: shortage.point.remaining, demand: shortage.demand }, {
      offsetMinutes: 30,
      remaining: 1,
      demand: 2
    });
  });

  it("finds no shortage when the guests end before the seats run short", () => {
    assert.equal(seatShortage(timeline, [unassignedGuest(30), unassignedGuest(30)]), null);
    assert.equal(seatShortage(timeline, []), null);
  });

  it("counts a D course guest as 2 seats and drops a guest from the demand once the course ends", () => {
    assert.equal(seatShortage(timeline, [unassignedGuest(90, true), unassignedGuest(30)])?.demand, 3);
    assert.equal(seatShortage(timeline, [unassignedGuest(90, true)])?.point.offsetMinutes, 30);
  });

  // 지명 손님은 그 Therapist가 일하면서 비어 있을 때만 남은 자리를 쓴다. 미지명 손님과 같은 자리를 나눠 쓴다.
  it("takes a seat for a named guest only when that therapist is working and free at that time", () => {
    const shared: SeatFacts = {
      therapists: ["t1", "t2"].map(allDay),
      calls: [
        { start: at("18:00"), end: at("19:00"), therapistIds: [], requiresSecondTherapist: false },
        { start: at("18:00"), end: at("19:00"), therapistIds: ["t2"], requiresSecondTherapist: false }
      ]
    };
    const points = seatTimeline(shared, at("18:00"), 60);
    assert.deepEqual(counts(points), [{ offsetMinutes: 0, capacity: 2, remaining: 0 }]);

    // t1은 일하고 비어 있지만 그 자리는 미지명 예약이 이미 잡았다.
    assert.equal(seatShortage(points, [{ minutes: 60, therapistIds: ["t1"], requiresSecondTherapist: false }])?.demand, 1);
    // 바쁜 t2(경고 후 배정)와 자리 수에 없는 사람은 남은 자리를 쓰지 않는다.
    assert.equal(seatShortage(points, [{ minutes: 60, therapistIds: ["t2"], requiresSecondTherapist: false }]), null);
    assert.equal(seatShortage(points, [{ minutes: 60, therapistIds: ["off-duty"], requiresSecondTherapist: false }]), null);
  });
});
