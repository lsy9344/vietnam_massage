import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listTherapistAvailability } from "@/modules/calls/service-call-service";
import { listTherapistDailySettlements } from "@/modules/settlements/therapist-daily-settlement-service";
import { getTherapistTodayView } from "@/modules/therapists/therapist-today-view-service";

const createdAt = new Date("2042-01-01T00:00:00.000Z");
const updatedAt = createdAt;

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

// 영업일 안의 분(테스트 기대값 계산용. 서비스 안의 비공개 businessMinute과 같은 규칙).
function businessMinuteOf(clock: string, dayStartClock: string) {
  const [h, m] = clock.split(":").map(Number);
  const [sh, sm] = dayStartClock.split(":").map(Number);
  const minutes = h * 60 + m;
  const start = sh * 60 + sm;
  return minutes < start ? minutes + 1440 : minutes;
}

/**
 * 티켓 03 테스트용 메모리 Prisma. getTherapistTodayView(이 티켓의 좁은 질의)와 listTherapistAvailability
 * (원장 Therapist 현황 줄, "오늘 한 것" 같은 숫자인지 비교용)를 같은 DB로 함께 돌린다. createMemoryPrisma는
 * 공용 모듈이 아니므로(코드베이스 지도 14절) 이 파일에 필요한 모델만 둔다. include/select는 보지 않고
// 항상 같은 모양의 "꽉 찬" 레코드를 돌려준다 — 실제 Prisma의 선택 동작을 흉내 내지 않는다.
 */
function createMemoryPrisma() {
  const operatingMonth = {
    id: "month-1",
    monthKey: "2042-03",
    startDate: dbDate("2042-03-01"),
    endDate: dbDate("2042-03-31"),
    status: "작성중",
    createdAt,
    updatedAt
  };

  const coursePolicy = {
    id: "policy-a",
    courseId: "course-a",
    name: "기본코스",
    durationMinutes: 60,
    basePrice: 100000,
    requiresSecondTherapist: false,
    tvDisplayName: "A",
    effectiveFromMonth: "2042-01",
    effectiveToMonth: null as string | null,
    isActive: true,
    createdAt,
    updatedAt
  };

  const course = { id: "course-a", code: "A", isActive: true, createdAt, updatedAt, policies: [coursePolicy] };
  const room = { id: "room-1", displayName: "101호", migrationReferenceName: "1번방", sortOrder: 10, isActive: true, createdAt, updatedAt };

  // 티켓 07: emp-me의 course-a 코스 수당(오늘 예상 코스 수당이 0이 아닌지 보는 테스트용).
  const therapistCourseRate = {
    id: "rate-1",
    therapistId: "emp-me",
    courseId: "course-a",
    amount: 150000,
    effectiveFromMonth: "2042-01",
    effectiveToMonth: null as string | null,
    isActive: true,
    createdAt,
    updatedAt
  };

  const employees = new Map([
    ["emp-me", { id: "emp-me", displayName: "민호", staffCode: "THR-911", employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true, sortOrder: 9801 }],
    ["emp-partner", { id: "emp-partner", displayName: "수진", staffCode: "THR-912", employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true, sortOrder: 9802 }],
    ["emp-other", { id: "emp-other", displayName: "다른사람", staffCode: "THR-913", employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true, sortOrder: 9803 }]
  ]);

  const customer = { id: "cust-1", name: "로빈", phone: "0909998888", memo: null, preferenceNote: "땅콩 알러지, 비상연락 0987654321" };

  function assignment(employeeId: string, assignmentRole: "THERAPIST_1" | "THERAPIST_2") {
    const employee = employees.get(employeeId);
    if (!employee) throw new Error(`unknown employee ${employeeId}`);
    return { employeeId, isActive: true, assignmentRole, employee };
  }

  // 오늘(2042-03-10), dayStart "09:00".
  const serviceCalls = new Map<string, any>([
    [
      "call-inuse",
      {
        id: "call-inuse",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-10"),
        startTime: "10:00",
        actualEntryTime: "10:05",
        actualEndTime: null,
        status: "사용중",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: "김민수\n연락처 0901234567",
        bookerName: null,
        visitRequest: "조용한 방 부탁드려요",
        assignments: [assignment("emp-me", "THERAPIST_1")]
      }
    ],
    [
      "call-party",
      {
        id: "call-party",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-10"),
        startTime: "15:00",
        actualEntryTime: null,
        actualEndTime: null,
        status: "예약",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: "cust-1",
        customer,
        customerMemo: null,
        bookerName: "로빈",
        visitRequest: "전화해주세요 090 111 2222",
        assignments: [assignment("emp-me", "THERAPIST_1"), assignment("emp-partner", "THERAPIST_2")]
      }
    ],
    [
      "call-canceled",
      {
        id: "call-canceled",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-10"),
        startTime: "16:00",
        actualEntryTime: null,
        actualEndTime: null,
        status: "취소",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: null,
        bookerName: "취소손님",
        visitRequest: null,
        assignments: [assignment("emp-me", "THERAPIST_1")]
      }
    ],
    [
      "call-other",
      {
        id: "call-other",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-10"),
        startTime: "09:30",
        actualEntryTime: "09:30",
        actualEndTime: "10:30",
        status: "방문완료",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: "비밀손님 핸드폰 0911112222",
        bookerName: null,
        visitRequest: "다른사람전용요청",
        assignments: [assignment("emp-other", "THERAPIST_1")]
      }
    ],
    // 티켓 07: 오늘 예상 코스 수당이 0이 아닌 실제 숫자를 계산하는지 보는 완료 콜(therapistCourseRate 참고).
    [
      "call-mine-complete",
      {
        id: "call-mine-complete",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-10"),
        startTime: "09:15",
        actualEntryTime: "09:15",
        actualEndTime: "10:15",
        status: "방문완료",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: "테스트완료콜",
        bookerName: null,
        visitRequest: null,
        assignments: [assignment("emp-me", "THERAPIST_1")]
      }
    ],
    [
      "call-future",
      {
        id: "call-future",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-12"),
        startTime: "11:00",
        actualEntryTime: null,
        actualEndTime: null,
        status: "예약",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: null,
        bookerName: "미래손님",
        visitRequest: null,
        assignments: [assignment("emp-me", "THERAPIST_1")]
      }
    ],
    [
      "call-boundary",
      {
        id: "call-boundary",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-17"),
        startTime: "09:00",
        actualEntryTime: null,
        actualEndTime: null,
        status: "예약",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: null,
        bookerName: "경계손님",
        visitRequest: null,
        assignments: [assignment("emp-me", "THERAPIST_1")]
      }
    ],
    [
      "call-after-boundary",
      {
        id: "call-after-boundary",
        operatingMonthId: "month-1",
        createdAt,
        updatedAt,
        serviceDate: dbDate("2042-03-18"),
        startTime: "09:00",
        actualEntryTime: null,
        actualEndTime: null,
        status: "예약",
        courseId: "course-a",
        course,
        operatingMonth,
        roomId: "room-1",
        room,
        customerId: null,
        customer: null,
        customerMemo: null,
        bookerName: "경계밖손님",
        visitRequest: null,
        assignments: [assignment("emp-me", "THERAPIST_1")]
      }
    ]
  ]);

  const timeSlots = [{ value: "09:00", sortOrder: 10, createdAt, isActive: true }];

  function matchesServiceCallWhere(record: any, where: any): boolean {
    if (!where) return true;
    if (where.operatingMonthId !== undefined && record.operatingMonthId !== where.operatingMonthId) return false;
    if (where.serviceDate !== undefined) {
      const condition = where.serviceDate;
      if (condition instanceof Date) {
        if (record.serviceDate.getTime() !== condition.getTime()) return false;
      } else if (condition && typeof condition === "object") {
        if (condition.gte && record.serviceDate.getTime() < condition.gte.getTime()) return false;
        if (condition.lte && record.serviceDate.getTime() > condition.lte.getTime()) return false;
      }
    }
    if (where.assignments?.some) {
      const condition = where.assignments.some;
      const matched = (record.assignments as any[]).some(
        (assignmentRow) =>
          (condition.employeeId === undefined || assignmentRow.employeeId === condition.employeeId) &&
          (condition.isActive === undefined || assignmentRow.isActive === condition.isActive)
      );
      if (!matched) return false;
    }
    return true;
  }

  return {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()].filter(
          (employee) =>
            (where?.isActive === undefined || employee.isActive === where.isActive) &&
            (where?.employeeGroup === undefined || employee.employeeGroup === where.employeeGroup)
        );
      },
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      }
    },
    course: {
      async findMany() {
        return [course];
      }
    },
    coursePolicy: {
      async findMany({ where }: any = {}) {
        return [coursePolicy].filter((policy) => where?.isActive === undefined || policy.isActive === where.isActive);
      }
    },
    therapistCourseRate: {
      async findMany() {
        return [therapistCourseRate];
      }
    },
    therapistAttendance: {
      async findMany() {
        return [] as any[];
      }
    },
    plannedWorkingDay: {
      async findMany() {
        return [] as any[];
      }
    },
    timeSlot: {
      async findMany({ where }: any = {}) {
        return timeSlots.filter((slot) => where?.isActive === undefined || slot.isActive === where.isActive);
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return [...serviceCalls.values()].filter((record) => matchesServiceCallWhere(record, where));
      }
    }
  };
}

// 2042-03-10 14:00(Asia/Ho_Chi_Minh) = 2042-03-10T07:00:00.000Z. dayStart가 "09:00"이라 오늘 영업일은
// 달력날 그대로다.
const now = new Date("2042-03-10T07:00:00.000Z");

describe("getTherapistTodayView", () => {
  it("returns only my calls, grouped by date, within today+7 days", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });

    assert.equal(view.days.length, 8);
    assert.equal(view.days[0]!.serviceDate, "2042-03-10");
    assert.equal(view.days[7]!.serviceDate, "2042-03-17");
    assert.equal(view.today.serviceDate, "2042-03-10");

    const todayCallIds = view.days[0]!.calls.map((call) => call.id);
    assert.deepEqual(todayCallIds, ["call-mine-complete", "call-inuse", "call-party", "call-canceled"]);

    const day12 = view.days.find((day) => day.serviceDate === "2042-03-12");
    assert.equal(day12?.calls.length, 1);
    assert.equal(day12?.calls[0]?.guestName, "미래손님");

    // day+7은 들어오고(경계 포함), day+8은 범위 밖이다.
    const day17 = view.days.find((day) => day.serviceDate === "2042-03-17");
    assert.equal(day17?.calls.length, 1);
    const serialized = JSON.stringify(view);
    assert.ok(!serialized.includes("경계밖손님"), "범위 밖(day+8) 콜이 들어왔다");
  });

  it("never leaks another therapist's calls, name, or memo text", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });
    const serialized = JSON.stringify(view);

    assert.ok(!serialized.includes("다른사람"), "다른 Therapist의 이름이 샜다");
    assert.ok(!serialized.includes("비밀손님"), "다른 Therapist 콜의 손님 메모가 샜다");
    assert.ok(!serialized.includes("다른사람전용요청"), "다른 Therapist 콜의 방문별 요청이 샜다");
    assert.ok(!serialized.includes("0911112222"), "다른 Therapist 콜의 연락처 숫자가 샜다");
  });

  it("redacts a 7+ digit run inside the guest name, visit request, and preference note", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });
    const serialized = JSON.stringify(view);

    assert.ok(!serialized.includes("0901234567"));
    assert.ok(!serialized.includes("090 111 2222"));
    assert.ok(!serialized.includes("0987654321"));

    const party = view.days[0]!.calls.find((call) => call.id === "call-party")!;
    assert.equal(party.visitRequest, "전화해주세요 •••••••");
    assert.equal(party.customerPreferenceNote, "땅콩 알러지, 비상연락 •••••••");

    const inUse = view.days[0]!.calls.find((call) => call.id === "call-inuse")!;
    assert.equal(inUse.guestName, "김민수");
  });

  it("names the second therapist on a two-person call, and leaves a solo call's partner null", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });

    const party = view.days[0]!.calls.find((call) => call.id === "call-party")!;
    assert.equal(party.partnerTherapistName, "수진");

    const solo = view.days[0]!.calls.find((call) => call.id === "call-inuse")!;
    assert.equal(solo.partnerTherapistName, null);
  });

  it("uses the actual end time when it exists, and marks a running call's end as estimated", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });

    const running = view.days[0]!.calls.find((call) => call.id === "call-inuse")!;
    assert.equal(running.endTime.isEstimated, true);
    assert.match(running.endTime.time, /^\d{2}:\d{2}$/);
  });

  it("counts today's done calls the same way the ledger's Therapist status strip does", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });

    const availability = await listTherapistAvailability({
      operatingMonthId: "month-1",
      serviceDate: "2042-03-10",
      time: "14:00",
      now,
      prismaClient: client as any
    });
    const ledgerRow = availability.find((row) => row.therapistId === "emp-me");

    // call-mine-complete(방문완료) + call-inuse(사용중) = 2건(티켓 07이 완료 콜 하나를 더해 2가 됐다).
    assert.equal(view.today.doneCount, 2);
    assert.equal(view.today.doneCount, ledgerRow?.callCounts.done);
  });

  it("counts minutes to the next upcoming call, ignoring one already in progress", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });

    // now=14:00, 다음 콜은 15:00(call-party)이다. 10:00에 시작한 call-inuse는 이미 시작했으니 "다음"이 아니다.
    assert.equal(view.today.nextCallInMinutes, businessMinuteOf("15:00", "09:00") - businessMinuteOf("14:00", "09:00"));
  });

  it("오늘 예상 코스 수당은 0이 아니고, 일별 정산 서비스의 그날 내 행 totalCommissionAmount와 같다(티켓 07, M8)", async () => {
    const client = createMemoryPrisma();
    const view = await getTherapistTodayView({ employeeId: "emp-me", now, prismaClient: client as any });

    const { settlements } = await listTherapistDailySettlements({
      operatingMonthId: "month-1",
      serviceDate: "2042-03-10",
      prismaClient: client as any
    });
    const mySettlement = settlements.find((settlement) => settlement.employeeId === "emp-me");

    assert.ok(view.today.expectedPayoutAmount > 0, "완료 콜(call-mine-complete)에 코스 수당이 있어 0보다 커야 한다");
    assert.equal(view.today.expectedPayoutAmount, mySettlement?.totalCommissionAmount);
  });
});
