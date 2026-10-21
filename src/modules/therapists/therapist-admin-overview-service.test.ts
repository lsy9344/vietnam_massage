import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonthlyClosingPreviewDto, MonthlyClosingTherapistRowDto } from "@/modules/closing/monthly-closing-preview-service";
import { judgeTherapistAttendanceDay } from "@/modules/therapists/therapist-attendance-judgment";
import { getTherapistAdminMonthlyOverview, getTherapistAdminTodayOverview } from "@/modules/therapists/therapist-admin-overview-service";

const createdAt = new Date("2042-01-01T00:00:00.000Z");
const updatedAt = createdAt;

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * 티켓 11 테스트용 메모리 Prisma: timeSlot·employee·plannedWorkingDay·therapistAttendance·operatingMonth·
 * serviceCall만 둔다(createMemoryPrisma는 공용 모듈이 아니다, 코드베이스 지도 14절). 06의 좁은 조회
 * (listTherapistAttendanceForDate/ForEmployeeInRange, listPlannedWorkingDayStatusesForDate/ForEmployeeInRange)가
 * 요구하는 where 모양을 모두 받아준다. dayStart는 "11:00"이다.
 */
function createMemoryPrisma() {
  const employees = [
    { id: "emp-a", displayName: "민호", staffCode: "THR-901", employeeGroup: "THERAPIST", sortOrder: 9801, isActive: true },
    { id: "emp-b", displayName: "수진", staffCode: "THR-902", employeeGroup: "THERAPIST", sortOrder: 9802, isActive: true },
    { id: "emp-c", displayName: "지훈", staffCode: "THR-903", employeeGroup: "THERAPIST", sortOrder: 9803, isActive: true },
    { id: "emp-d", displayName: "유리", staffCode: "THR-904", employeeGroup: "THERAPIST", sortOrder: 9804, isActive: true },
    // R6: 그 운영월이 끝난 뒤 퇴사한 Therapist. 스냅샷·미리보기 행에는 그대로 남지만 지금은 비활성이다.
    { id: "emp-e", displayName: "퇴사자", staffCode: "THR-905", employeeGroup: "THERAPIST", sortOrder: 9805, isActive: false }
  ];
  const operatingMonth = { id: "month-2042-07", monthKey: "2042-07", startDate: dbDate("2042-07-01"), endDate: dbDate("2042-07-31"), status: "작성중" };

  const plannedWorkingDays = [
    { employeeId: "emp-a", workDate: dbDate("2042-07-02"), planStatus: "근무 예정", plannedStartTime: "09:00" },
    { employeeId: "emp-a", workDate: dbDate("2042-07-03"), planStatus: "근무 예정", plannedStartTime: "09:00" },
    { employeeId: "emp-a", workDate: dbDate("2042-07-04"), planStatus: "휴무", plannedStartTime: null },
    { employeeId: "emp-a", workDate: dbDate("2042-07-05"), planStatus: "근무 예정", plannedStartTime: "09:00" },
    { employeeId: "emp-a", workDate: dbDate("2042-07-06"), planStatus: "근무 예정", plannedStartTime: "09:00" },
    { employeeId: "emp-b", workDate: dbDate("2042-07-06"), planStatus: "근무 예정", plannedStartTime: "09:00" },
    { employeeId: "emp-d", workDate: dbDate("2042-07-06"), planStatus: "휴무", plannedStartTime: null },
    { employeeId: "emp-e", workDate: dbDate("2042-07-02"), planStatus: "근무 예정", plannedStartTime: "09:00" }
  ];

  const attendances = new Map<string, any>([
    [
      "att-a-02",
      {
        id: "att-a-02",
        operatingMonthId: "month-2042-07",
        attendanceDate: dbDate("2042-07-02"),
        employeeId: "emp-a",
        checkInMinute: 550, // 09:10, 10분 지각
        checkInMethod: "직접",
        checkOutMinute: 1080, // 18:00
        checkOutMethod: "직접",
        standbyMinutes: 530,
        isFullAttendanceRecognized: false,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "att-a-04",
      {
        id: "att-a-04",
        operatingMonthId: "month-2042-07",
        attendanceDate: dbDate("2042-07-04"),
        employeeId: "emp-a",
        checkInMinute: 660, // 11:00, 휴무인 날의 출근(대리 입력) → 예정 없는 출근 + 퇴근 미입력
        checkInMethod: "대리 입력",
        checkOutMinute: null,
        checkOutMethod: null,
        standbyMinutes: null,
        isFullAttendanceRecognized: false,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "att-a-05",
      {
        id: "att-a-05",
        operatingMonthId: "month-2042-07",
        attendanceDate: dbDate("2042-07-05"),
        employeeId: "emp-a",
        checkInMinute: 540, // 09:00, 정시(대리 입력)
        checkInMethod: "대리 입력",
        checkOutMinute: 1140, // 19:00(대리 입력)
        checkOutMethod: "대리 입력",
        standbyMinutes: 600,
        isFullAttendanceRecognized: true,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "att-b-06",
      {
        id: "att-b-06",
        operatingMonthId: "month-2042-07",
        attendanceDate: dbDate("2042-07-06"),
        employeeId: "emp-b",
        checkInMinute: 555, // 09:15, 오늘 15분 지각
        checkInMethod: "직접",
        checkOutMinute: null,
        checkOutMethod: null,
        standbyMinutes: null,
        isFullAttendanceRecognized: false,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "att-d-06",
      {
        id: "att-d-06",
        operatingMonthId: "month-2042-07",
        attendanceDate: dbDate("2042-07-06"),
        employeeId: "emp-d",
        checkInMinute: 600, // 10:00, 휴무인 오늘 출근 → 예정 없는 출근
        checkInMethod: "직접",
        checkOutMinute: null,
        checkOutMethod: null,
        standbyMinutes: null,
        isFullAttendanceRecognized: false,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "att-e-02",
      {
        id: "att-e-02",
        operatingMonthId: "month-2042-07",
        attendanceDate: dbDate("2042-07-02"),
        employeeId: "emp-e",
        checkInMinute: 540, // 09:00, 정시(R6: 지금은 퇴사했지만 그 운영월 당시의 기록)
        checkInMethod: "직접",
        checkOutMinute: 1080,
        checkOutMethod: "직접",
        standbyMinutes: 540,
        isFullAttendanceRecognized: true,
        isActive: true,
        createdAt,
        updatedAt
      }
    ]
  ]);

  function matchesEmployeeIdFilter(employeeId: string, filter: any) {
    if (filter === undefined) return true;
    if (typeof filter === "string") return employeeId === filter;
    if (filter?.in) return filter.in.includes(employeeId);
    return true;
  }

  function matchesDateFilter(value: Date, filter: any) {
    if (filter === undefined) return true;
    if (filter instanceof Date) return value.getTime() === filter.getTime();
    if (filter?.gte !== undefined && value < filter.gte) return false;
    if (filter?.lte !== undefined && value > filter.lte) return false;
    return true;
  }

  const client: any = {
    therapistRequest: { async findMany() { return []; } },
    timeSlot: {
      async findMany() {
        return [{ value: "11:00", sortOrder: 10, createdAt, isActive: true }];
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return employees.filter((row) => {
          if (where?.employeeGroup !== undefined && row.employeeGroup !== where.employeeGroup) return false;
          if (where?.isActive !== undefined && row.isActive !== where.isActive) return false;
          return true;
        });
      },
      async findUnique({ where }: any) {
        return employees.find((row) => row.id === where.id) ?? null;
      }
    },
    plannedWorkingDay: {
      async findMany({ where }: any = {}) {
        return plannedWorkingDays.filter(
          (row) => matchesEmployeeIdFilter(row.employeeId, where?.employeeId) && matchesDateFilter(row.workDate, where?.workDate)
        );
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter((row) => {
          if (where?.operatingMonthId !== undefined && row.operatingMonthId !== where.operatingMonthId) return false;
          if (!matchesEmployeeIdFilter(row.employeeId, where?.employeeId)) return false;
          if (where?.isActive !== undefined && row.isActive !== where.isActive) return false;
          if (!matchesDateFilter(row.attendanceDate, where?.attendanceDate)) return false;
          return true;
        });
      }
    },
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    },
    serviceCall: {
      async findMany() {
        return [];
      }
    }
  };

  return { client, employees, operatingMonth };
}

// now는 UTC+7(영업 시간대)에서 2042-07-06 15:00이라 운영일은 2042-07-06이다(dayStart "11:00"보다 늦다).
const now = new Date("2042-07-06T08:00:00.000Z");

describe("getTherapistAdminTodayOverview", () => {
  it("활성 Therapist 전원의 오늘 출근 여부·시각·방식과 06 판정을 보인다", async () => {
    const { client, operatingMonth } = createMemoryPrisma();
    const operatingMonths = [
      { id: operatingMonth.id, monthKey: operatingMonth.monthKey, startDate: "2042-07-01", endDate: "2042-07-31", status: "작성중" as const, createdAt: "", updatedAt: "" }
    ];

    const overview = await getTherapistAdminTodayOverview({ operatingMonths, now, prismaClient: client });

    assert.equal(overview.serviceDate, "2042-07-06");
    assert.equal(overview.operatingMonthMissing, false);
    assert.equal(overview.rows.length, 4); // emp-a, emp-b, emp-c(출근 기록 없음), emp-d

    const byEmployeeId = new Map(overview.rows.map((row) => [row.employeeId, row]));

    // emp-b: 09:00 예정, 09:15 출근(직접) → 15분 지각. 오늘 운영일이라 결근·퇴근 미입력은 늘 false(06과 같은 규칙).
    const late = byEmployeeId.get("emp-b")!;
    assert.equal(late.checkInTime, "09:15");
    assert.equal(late.checkInMethod, "직접");
    const expectedLateJudgment = judgeTherapistAttendanceDay({
      planStatus: "근무 예정",
      plannedStartTime: "09:00",
      checkInTime: "09:15",
      checkOutTime: null,
      dayStart: "11:00",
      isOperatingDayEnded: false
    });
    assert.deepEqual(late.judgment, expectedLateJudgment);
    assert.equal(late.judgment.lateMinutes, 15);
    assert.equal(late.judgment.isAbsent, false);
    assert.equal(late.judgment.isClockOutMissing, false);

    // emp-c: 근무표·출근 기록 모두 없음 — 아직 출근 전이고 오늘은 끝나지 않아 결근이 아니다.
    const noShow = byEmployeeId.get("emp-c")!;
    assert.equal(noShow.checkInTime, null);
    assert.equal(noShow.judgment.isAbsent, false);

    // emp-d: 휴무인데 출근(직접) → 예정 없는 출근.
    const unscheduled = byEmployeeId.get("emp-d")!;
    assert.equal(unscheduled.judgment.isUnscheduledAttendance, true);
  });

  it("오늘 운영일이 속한 운영월이 없으면 빈 목록을 돌려준다", async () => {
    const { client } = createMemoryPrisma();
    const overview = await getTherapistAdminTodayOverview({ operatingMonths: [], now, prismaClient: client });
    assert.equal(overview.operatingMonthMissing, true);
    assert.deepEqual(overview.rows, []);
  });
});

function closingRow(overrides: Partial<MonthlyClosingTherapistRowDto>): MonthlyClosingTherapistRowDto {
  return {
    employeeId: "emp-x",
    staffCode: "THR-000",
    displayName: "",
    totalCallCount: 0,
    monthlySettlementAmount: 0,
    courseBreakdown: {},
    assignmentEvidenceCount: 0,
    warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
    fullAttendanceDays: null,
    fullAttendanceAllowanceAmount: 0,
    fullAttendanceBasis: "",
    countKingRank: null,
    countKingBonusAmount: 0,
    countKingBasis: "",
    finalPayoutAmount: 0,
    bonusWarningMessages: [],
    ...overrides
  } as unknown as MonthlyClosingTherapistRowDto;
}

describe("getTherapistAdminMonthlyOverview", () => {
  it("06의 좁은 조회·판정을 날짜마다 그대로 써서 월 집계를 만든다(같은 메모리 DB에서 06 판정과 비교)", async () => {
    const { client, operatingMonth } = createMemoryPrisma();
    const rows = [
      closingRow({ employeeId: "emp-a", staffCode: "THR-901", displayName: "민호", totalCallCount: 10 }),
      closingRow({ employeeId: "emp-b", staffCode: "THR-902", displayName: "수진", totalCallCount: 50 })
    ];
    const listMonthlyClosingPreviewStub = (async () => ({ therapists: { rows } }) as unknown as MonthlyClosingPreviewDto) as any;

    const overview = await getTherapistAdminMonthlyOverview({
      operatingMonth: { id: operatingMonth.id, monthKey: "2042-07", startDate: "2042-07-01", endDate: "2042-07-31", status: "작성중" },
      now,
      prismaClient: client,
      dependencies: { listMonthlyClosingPreview: listMonthlyClosingPreviewStub }
    });

    const empA = overview.rows.find((row) => row.employeeId === "emp-a")!;
    // 같은 메모리 DB에서 06 판정을 날짜마다 직접 불러 손으로 더한 기대값과 비교한다.
    const expected = { lateCount: 0, lateMinutesTotal: 0, absentCount: 0, clockOutMissingCount: 0, unscheduledAttendanceCount: 0, proxyInputCount: 0 };
    const days = [
      { date: "2042-07-02", planStatus: "근무 예정" as const, plannedStartTime: "09:00", checkInTime: "09:10", checkOutTime: "18:00", checkInMethod: "직접", checkOutMethod: "직접" },
      { date: "2042-07-03", planStatus: "근무 예정" as const, plannedStartTime: "09:00", checkInTime: null, checkOutTime: null, checkInMethod: null, checkOutMethod: null },
      { date: "2042-07-04", planStatus: "휴무" as const, plannedStartTime: null, checkInTime: "11:00", checkOutTime: null, checkInMethod: "대리 입력", checkOutMethod: null },
      { date: "2042-07-05", planStatus: "근무 예정" as const, plannedStartTime: "09:00", checkInTime: "09:00", checkOutTime: "19:00", checkInMethod: "대리 입력", checkOutMethod: "대리 입력" },
      { date: "2042-07-06", planStatus: "근무 예정" as const, plannedStartTime: "09:00", checkInTime: null, checkOutTime: null, checkInMethod: null, checkOutMethod: null }
    ];
    for (const day of days) {
      const judgment = judgeTherapistAttendanceDay({
        planStatus: day.planStatus,
        plannedStartTime: day.plannedStartTime,
        checkInTime: day.checkInTime,
        checkOutTime: day.checkOutTime,
        dayStart: "11:00",
        isOperatingDayEnded: day.date < "2042-07-06"
      });
      if (judgment.lateMinutes !== null) {
        expected.lateCount += 1;
        expected.lateMinutesTotal += judgment.lateMinutes;
      }
      if (judgment.isAbsent) expected.absentCount += 1;
      if (judgment.isClockOutMissing) expected.clockOutMissingCount += 1;
      if (judgment.isUnscheduledAttendance) expected.unscheduledAttendanceCount += 1;
      if (day.checkInMethod === "대리 입력") expected.proxyInputCount += 1;
      if (day.checkOutMethod === "대리 입력") expected.proxyInputCount += 1;
    }

    assert.deepEqual(
      {
        lateCount: empA.lateCount,
        lateMinutesTotal: empA.lateMinutesTotal,
        absentCount: empA.absentCount,
        clockOutMissingCount: empA.clockOutMissingCount,
        unscheduledAttendanceCount: empA.unscheduledAttendanceCount,
        proxyInputCount: empA.proxyInputCount
      },
      expected
    );
    assert.equal(empA.lateCount, 1);
    assert.equal(empA.lateMinutesTotal, 10);
    assert.equal(empA.absentCount, 1);
    assert.equal(empA.clockOutMissingCount, 1);
    assert.equal(empA.unscheduledAttendanceCount, 1);
    assert.equal(empA.proxyInputCount, 3);
  });

  it("완료 콜 수는 마감 미리보기 행 그대로고, 순위는 40콜 미달도 포함해 전원에게 매겨진다", async () => {
    const { client, operatingMonth } = createMemoryPrisma();
    // emp-c는 40콜 미달이라 콜킹 보너스 자격은 없지만(countKingRank: null), 완료 콜 수 기준 전체 순위는 받는다.
    const rows = [
      closingRow({ employeeId: "emp-a", staffCode: "THR-901", totalCallCount: 50, monthlySettlementAmount: 900000, countKingRank: 1 }),
      closingRow({ employeeId: "emp-b", staffCode: "THR-902", totalCallCount: 50, monthlySettlementAmount: 500000, countKingRank: 2 }),
      closingRow({ employeeId: "emp-c", staffCode: "THR-903", totalCallCount: 5, monthlySettlementAmount: 100000, countKingRank: null })
    ];
    const listMonthlyClosingPreviewStub = (async () => ({ therapists: { rows } }) as unknown as MonthlyClosingPreviewDto) as any;

    const overview = await getTherapistAdminMonthlyOverview({
      operatingMonth: { id: operatingMonth.id, monthKey: "2042-07", startDate: "2042-07-01", endDate: "2042-07-31", status: "작성중" },
      now,
      prismaClient: client,
      dependencies: { listMonthlyClosingPreview: listMonthlyClosingPreviewStub }
    });

    const byEmployeeId = new Map(overview.rows.map((row) => [row.employeeId, row]));
    assert.equal(byEmployeeId.get("emp-a")!.totalCallCount, 50);
    assert.equal(byEmployeeId.get("emp-a")!.rank, 1); // 콜 수 같으면 월 정산액 desc로 동점 해소
    assert.equal(byEmployeeId.get("emp-b")!.rank, 2);
    assert.equal(byEmployeeId.get("emp-c")!.totalCallCount, 5);
    assert.equal(byEmployeeId.get("emp-c")!.rank, 3); // 40콜 미달이어도 전체 순위는 받는다
  });

  // R6: 스냅샷·미리보기 행에 지금은 비활성(퇴사)인 Therapist가 섞여 있어도 전체가 깨지지 않는다.
  it("includes a since-retired employee's row instead of throwing (R6)", async () => {
    const { client, operatingMonth } = createMemoryPrisma();
    const rows = [
      closingRow({ employeeId: "emp-a", staffCode: "THR-901", displayName: "민호", totalCallCount: 10 }),
      closingRow({ employeeId: "emp-e", staffCode: "THR-905", displayName: "퇴사자", totalCallCount: 20 })
    ];
    const listMonthlyClosingPreviewStub = (async () => ({ therapists: { rows } }) as unknown as MonthlyClosingPreviewDto) as any;

    const overview = await getTherapistAdminMonthlyOverview({
      operatingMonth: { id: operatingMonth.id, monthKey: "2042-07", startDate: "2042-07-01", endDate: "2042-07-31", status: "작성중" },
      now,
      prismaClient: client,
      dependencies: { listMonthlyClosingPreview: listMonthlyClosingPreviewStub }
    });

    assert.equal(overview.rows.length, 2);
    const retired = overview.rows.find((row) => row.employeeId === "emp-e")!;
    assert.equal(retired.totalCallCount, 20);
    // 2042-07-02에 정시 출근·퇴근(직접)을 했으니 지각·결근·퇴근 미입력·예정 없는 출근은 모두 0이다.
    assert.equal(retired.lateCount, 0);
    assert.equal(retired.absentCount, 0);
    assert.equal(retired.clockOutMissingCount, 0);
    assert.equal(retired.unscheduledAttendanceCount, 0);
  });
});


it("shows approved special day-off in the admin today status without changing attendance", async () => {
  const { client, operatingMonth } = createMemoryPrisma();
  client.therapistRequest.findMany = async () => [{ employeeId: "emp-d", targetDate: dbDate("2042-07-06") }];
  const overview = await getTherapistAdminTodayOverview({ operatingMonths: [{ id: operatingMonth.id, monthKey: operatingMonth.monthKey, startDate: "2042-07-01", endDate: "2042-07-31", status: "작성중", createdAt: "", updatedAt: "" }], now, prismaClient: client });
  assert.equal(overview.rows.find((row) => row.employeeId === "emp-d")?.isSpecialDayOff, true);
  assert.equal(overview.rows.find((row) => row.employeeId === "emp-b")?.isSpecialDayOff, false);
});
