export const MIGRATION_SOURCE_REFERENCES = {
  realtimeLedger:
    "sheet_erp_design.md §7.2 실시간콜입력: 방문완료만 결제/마사지사수당/귀케어풀/콜인정 계산, 할인구분 있으면 100000 VND. Evidence range: A:S, U:X.",
  roomStatus:
    "sheet_erp_design.md §11 웨이터리스트/TV현황판: 예약/사용중/청소중은 점유, 방문완료/노쇼/취소는 점유 제외, 사용중 종료시 종료확인.",
  dCourse:
    "client_erp_specification.md §10: D코스는 ERP 강화 검증으로 마사지사2 필수. Excel cell 좌표는 source evidence일 뿐 구현 기준 아님.",
  operations:
    "client_erp_specification.md §14: 운영팀 일일 30/40/50콜, 월 1000/1100/1200/1300/1400/1500콜 기준.",
  earcare: "client_erp_specification.md §14: 귀케어 일정산은 방문완료 귀케어 풀을 정상 근무자 N분의1로 분배, 정상근무자 0명은 지급액 0원.",
  closing:
    "PRD FR-37 / Story 5.2: 8시간 이상 만근 인정, 20일 이상 만근수당, 40콜 이상 갯수왕 1~3위 5000000/3000000/1000000 VND."
} as const;

export const MIGRATION_CALCULATION_FIXTURE = {
  operatingMonth: {
    id: "month-2034-06",
    monthKey: "2034-06",
    startDate: "2034-06-01",
    endDate: "2034-06-30",
    status: "검토중"
  },
  rooms: [
    { id: "room-101", displayName: "101 호실", migrationReferenceName: "1번방", sortOrder: 10 },
    { id: "room-102", displayName: "102 호실", migrationReferenceName: "2번방", sortOrder: 20 },
    { id: "room-103", displayName: "103 호실", migrationReferenceName: "3번방", sortOrder: 30 },
    { id: "room-201", displayName: "201 호실", migrationReferenceName: "4번방", sortOrder: 40 },
    { id: "room-202", displayName: "202 호실", migrationReferenceName: "5번방", sortOrder: 50 }
  ],
  courses: [
    { id: "course-a", code: "A", displayName: "A 누루60" },
    { id: "course-b", code: "B", displayName: "B 귀청소90" },
    { id: "course-d", code: "D", displayName: "D 2:1 90" }
  ],
  coursePolicies: [
    { id: "policy-a", courseId: "course-a", name: "A 누루60", tvDisplayName: "A60", durationMinutes: 60, basePrice: 1500000, earcarePoolAmount: 100000, opsCallCredit: 10, requiresSecondTherapist: false },
    { id: "policy-b", courseId: "course-b", name: "B 귀청소90", tvDisplayName: "B90", durationMinutes: 90, basePrice: 1800000, earcarePoolAmount: 200000, opsCallCredit: 20, requiresSecondTherapist: false },
    { id: "policy-d", courseId: "course-d", name: "D 2:1 90", tvDisplayName: "D90", durationMinutes: 90, basePrice: 3200000, earcarePoolAmount: 0, opsCallCredit: 10, requiresSecondTherapist: true }
  ],
  therapistCourseRates: [
    { id: "rate-thr-001-a", therapistId: "therapist-thr-001", courseId: "course-a", amount: 700000 },
    { id: "rate-thr-001-b", therapistId: "therapist-thr-001", courseId: "course-b", amount: 900000 },
    { id: "rate-thr-001-d", therapistId: "therapist-thr-001", courseId: "course-d", amount: 900000 },
    { id: "rate-thr-002-a", therapistId: "therapist-thr-002", courseId: "course-a", amount: 0 },
    { id: "rate-thr-002-d", therapistId: "therapist-thr-002", courseId: "course-d", amount: 900000 }
  ],
  employees: [
    { id: "therapist-thr-001", staffCode: "THR-001", displayName: "마사지사1", employeeGroup: "THERAPIST", position: "마사지사", sortOrder: 1 },
    { id: "therapist-thr-002", staffCode: "THR-002", displayName: "마사지사2", employeeGroup: "THERAPIST", position: "마사지사", sortOrder: 2 },
    { id: "therapist-thr-003", staffCode: "THR-003", displayName: "마사지사3", employeeGroup: "THERAPIST", position: "마사지사", sortOrder: 3 },
    { id: "earcare-ear-001", staffCode: "EAR-001", displayName: "귀케어1", employeeGroup: "EARCARE", position: "귀케어", sortOrder: 10 },
    { id: "earcare-ear-002", staffCode: "EAR-002", displayName: "귀케어2", employeeGroup: "EARCARE", position: "귀케어", sortOrder: 11 },
    { id: "ops-lead-001", staffCode: "OPS-LEAD-001", displayName: "운영팀장", employeeGroup: "OPERATIONS", position: "팀장", sortOrder: 20 },
    { id: "ops-counter-001", staffCode: "OPS-COUNTER-001", displayName: "카운터1", employeeGroup: "OPERATIONS", position: "카운터", sortOrder: 21 },
    { id: "ops-waiter-001", staffCode: "OPS-WAITER-001", displayName: "웨이터1", employeeGroup: "OPERATIONS", position: "웨이터", sortOrder: 22 },
    { id: "ops-waiter-002", staffCode: "OPS-WAITER-002", displayName: "웨이터2", employeeGroup: "OPERATIONS", position: "웨이터", sortOrder: 23 }
  ],
  timeSlots: ["11:00", "11:30", "12:00", "12:30", "23:30", "00:30"],
  serviceCalls: [
    { id: "call-complete-a-discount", serviceDate: "2034-06-15", startTime: "11:00", roomId: "room-101", courseId: "course-a", status: "방문완료", discountTypeCode: "WEEKLY_VISIT", paymentMethodCode: "CASH" },
    { id: "call-complete-b-no-discount", serviceDate: "2034-06-15", startTime: "11:30", roomId: "room-102", courseId: "course-b", status: "VISIT_COMPLETE", discountTypeCode: null, paymentMethodCode: "CARD" },
    { id: "call-complete-a-therapist2-only", serviceDate: "2034-06-15", startTime: "12:00", roomId: "room-103", courseId: "course-a", status: "방문완료", discountTypeCode: null, paymentMethodCode: "CASH" },
    { id: "call-complete-d-two-therapists", serviceDate: "2034-06-15", startTime: "12:30", roomId: "room-201", courseId: "course-d", status: "방문완료", discountTypeCode: null, paymentMethodCode: "CASH" },
    { id: "call-invalid-d-missing-second", serviceDate: "2034-06-15", startTime: "12:30", roomId: "room-202", courseId: "course-d", status: "방문완료", discountTypeCode: null, paymentMethodCode: "CASH", erpStrengthenedRule: "D_COURSE_SECOND_THERAPIST_REQUIRED" },
    { id: "call-earcare-zero-worker", serviceDate: "2034-06-16", startTime: "11:00", roomId: "room-101", courseId: "course-a", status: "방문완료", discountTypeCode: null, paymentMethodCode: "CASH" },
    { id: "call-reserved", serviceDate: "2034-06-15", startTime: "23:30", roomId: "room-101", courseId: "course-a", status: "예약", discountTypeCode: null, paymentMethodCode: null },
    { id: "call-in-use-ended", serviceDate: "2034-06-15", startTime: "00:30", roomId: "room-102", courseId: "course-a", status: "사용중", discountTypeCode: null, paymentMethodCode: null },
    { id: "call-cleaning", serviceDate: "2034-06-15", startTime: "12:00", roomId: "room-103", courseId: "course-b", status: "청소중", discountTypeCode: null, paymentMethodCode: null },
    { id: "call-no-show", serviceDate: "2034-06-15", startTime: "12:00", roomId: "room-201", courseId: "course-a", status: "노쇼", discountTypeCode: null, paymentMethodCode: null },
    { id: "call-canceled", serviceDate: "2034-06-15", startTime: "12:30", roomId: "room-202", courseId: "course-a", status: "취소", discountTypeCode: null, paymentMethodCode: null }
  ],
  assignments: [
    { serviceCallId: "call-complete-a-discount", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-complete-a-discount", assignmentRole: "EARCARE", employeeId: "earcare-ear-001" },
    { serviceCallId: "call-complete-b-no-discount", assignmentRole: "THERAPIST_2", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-complete-b-no-discount", assignmentRole: "EARCARE", employeeId: "earcare-ear-001" },
    { serviceCallId: "call-complete-a-therapist2-only", assignmentRole: "THERAPIST_2", employeeId: "therapist-thr-002" },
    { serviceCallId: "call-complete-d-two-therapists", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-complete-d-two-therapists", assignmentRole: "THERAPIST_2", employeeId: "therapist-thr-002" },
    { serviceCallId: "call-invalid-d-missing-second", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-earcare-zero-worker", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-earcare-zero-worker", assignmentRole: "EARCARE", employeeId: "earcare-ear-001" },
    { serviceCallId: "call-reserved", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-in-use-ended", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-001" },
    { serviceCallId: "call-cleaning", assignmentRole: "THERAPIST_1", employeeId: "therapist-thr-002" }
  ],
  attendance: {
    operations: [
      { employeeId: "ops-lead-001", attendanceDate: "2034-06-15", statusCode: "NORMAL" },
      { employeeId: "ops-counter-001", attendanceDate: "2034-06-15", statusCode: "NORMAL" },
      { employeeId: "ops-waiter-001", attendanceDate: "2034-06-15", statusCode: "NORMAL" },
      { employeeId: "ops-waiter-002", attendanceDate: "2034-06-15", statusCode: "DAY_OFF" }
    ],
    earcare: [
      { employeeId: "earcare-ear-001", attendanceDate: "2034-06-15", statusCode: "NORMAL" },
      { employeeId: "earcare-ear-002", attendanceDate: "2034-06-15", statusCode: "DAY_OFF" },
      { employeeId: "earcare-ear-001", attendanceDate: "2034-06-16", statusCode: "DAY_OFF" },
      { employeeId: "earcare-ear-002", attendanceDate: "2034-06-16", statusCode: "DAY_OFF" }
    ]
  },
  expenses: [{ id: "expense-food", expenseDate: "2034-06-15", amount: 50000, description: "식대", handledByEmployeeId: "ops-counter-001" }],
  incentiveRules: {
    opsDaily: [
      { id: "ops-daily-30", thresholdCallCount: 30, personalAmount: 50000 },
      { id: "ops-daily-40", thresholdCallCount: 40, personalAmount: 100000 },
      { id: "ops-daily-50", thresholdCallCount: 50, personalAmount: 200000 }
    ],
    opsMonthly: [
      { id: "ops-monthly-1000", thresholdCallCount: 1000, totalAmount: 3000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
      { id: "ops-monthly-1100", thresholdCallCount: 1100, totalAmount: 5000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
      { id: "ops-monthly-1200", thresholdCallCount: 1200, totalAmount: 8000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
      { id: "ops-monthly-1300", thresholdCallCount: 1300, totalAmount: 12000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
      { id: "ops-monthly-1400", thresholdCallCount: 1400, totalAmount: 18000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
      { id: "ops-monthly-1500", thresholdCallCount: 1500, totalAmount: 25000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 }
    ]
  },
  monthlyClosingInputs: {
    therapistDailySettlements: [
      {
        serviceDate: "2034-06-15",
        settlements: [
          {
            employeeId: "therapist-thr-003",
            staffCode: "THR-003",
            displayName: "마사지사3",
            sortOrder: 3,
            totalCallCount: 45,
            totalCommissionAmount: 3000000,
            courseBreakdown: {
              A: { courseCode: "A", callCount: 45, commissionAmount: 3000000 },
              B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
              C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
              D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
              E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
            },
            assignmentEvidence: [],
            warningCounts: { zeroPolicy: 0, missingPolicy: 0 }
          },
          {
            employeeId: "therapist-thr-001",
            staffCode: "THR-001",
            displayName: "마사지사1",
            sortOrder: 1,
            totalCallCount: 42,
            totalCommissionAmount: 2500000,
            courseBreakdown: {
              A: { courseCode: "A", callCount: 20, commissionAmount: 700000 },
              B: { courseCode: "B", callCount: 10, commissionAmount: 900000 },
              C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
              D: { courseCode: "D", callCount: 12, commissionAmount: 900000 },
              E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
            },
            assignmentEvidence: [],
            warningCounts: { zeroPolicy: 0, missingPolicy: 0 }
          },
          {
            employeeId: "therapist-thr-002",
            staffCode: "THR-002",
            displayName: "마사지사2",
            sortOrder: 2,
            totalCallCount: 40,
            totalCommissionAmount: 900000,
            courseBreakdown: {
              A: { courseCode: "A", callCount: 20, commissionAmount: 0 },
              B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
              C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
              D: { courseCode: "D", callCount: 20, commissionAmount: 900000 },
              E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
            },
            assignmentEvidence: [],
            warningCounts: { zeroPolicy: 1, missingPolicy: 0 }
          }
        ],
        warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        excludedCallCount: 0
      }
    ],
    fullAttendanceRecognitions: {
      sourceStatus: "available",
      sourceDayCount: 30,
      rows: [
        { employeeId: "therapist-thr-003", staffCode: "THR-003", displayName: "마사지사3", fullAttendanceDays: 21, recognizedHoursThreshold: 8, isAllowanceEligible: true },
        { employeeId: "therapist-thr-001", staffCode: "THR-001", displayName: "마사지사1", fullAttendanceDays: 20, recognizedHoursThreshold: 8, isAllowanceEligible: true },
        { employeeId: "therapist-thr-002", staffCode: "THR-002", displayName: "마사지사2", fullAttendanceDays: 19, recognizedHoursThreshold: 8, isAllowanceEligible: false }
      ],
      warningMessages: []
    }
  }
} as const;

export const MIGRATION_EXPECTED_RESULTS = {
  callCalculation: {
    completedIds: ["call-complete-a-discount", "call-complete-b-no-discount", "call-complete-a-therapist2-only", "call-complete-d-two-therapists"],
    excludedIds: ["call-reserved", "call-in-use-ended", "call-cleaning", "call-no-show", "call-canceled", "call-invalid-d-missing-second"],
    payments: {
      "call-complete-a-discount": { basePrice: 1500000, discountAmount: 100000, paymentAmount: 1400000, earcarePoolAmount: 100000, opsCallCredit: 10 },
      "call-complete-b-no-discount": { basePrice: 1800000, discountAmount: 0, paymentAmount: 1800000, earcarePoolAmount: 200000, opsCallCredit: 20 },
      "call-complete-d-two-therapists": { basePrice: 3200000, discountAmount: 0, paymentAmount: 3200000, earcarePoolAmount: 0, opsCallCredit: 10 }
    },
    dailySummary: { reservationCount: 1, inUseCount: 1, cleaningCount: 1, completedCount: 5, noShowCount: 1, canceledCount: 1, paymentTotal: 7900000, discountTotal: 100000, earcarePoolTotal: 400000, therapistCommissionTotal: 3400000, expenseTotal: 50000, netSales: 7850000 }
  },
  roomStatus: [
    { roomId: "room-101", activeCallId: "call-reserved", displayStatus: "예약" },
    { roomId: "room-102", activeCallId: "call-in-use-ended", displayStatus: "종료확인" },
    { roomId: "room-103", activeCallId: "call-cleaning", displayStatus: "청소중" },
    { roomId: "room-201", activeCallId: null, displayStatus: "빈방" },
    { roomId: "room-202", activeCallId: null, displayStatus: "빈방" }
  ],
  operations: {
    dailyThreshold: { dailyOpsCallCredit: 50, appliedThresholdCallCount: 50, personalIncentiveAmount: 200000, eligibleCount: 3, distributedAmount: 600000 },
    monthlyThresholds: [1000, 1100, 1200, 1300, 1400, 1500],
    monthlyPreview: { monthlyOpsCallCredit: 1500, appliedThresholdCallCount: 1500, totalMonthlyIncentiveAmount: 25000000 }
  },
  earcareDaily: {
    normalDay: { earcarePoolTotal: 400000, eligibleCount: 1, distributedAmount: 400000 },
    zeroWorkerDay: { earcarePoolTotal: 100000, eligibleCount: 0, distributedAmount: 0 }
  },
  therapistDaily: {
    "therapist-thr-001": { totalCallCount: 3, totalCommissionAmount: 2500000 },
    "therapist-thr-002": { totalCallCount: 2, totalCommissionAmount: 900000, zeroPolicyCount: 1 }
  },
  monthlyClosing: {
    fullAttendanceThresholdHours: 8,
    fullAttendanceBonusThresholdDays: 20,
    countKingThresholdCalls: 40,
    rows: {
      "therapist-thr-003": { monthlySettlementAmount: 3000000, fullAttendanceAllowanceAmount: 2000000, countKingBonusAmount: 5000000, finalPayoutAmount: 10000000 },
      "therapist-thr-001": { monthlySettlementAmount: 2500000, fullAttendanceAllowanceAmount: 2000000, countKingBonusAmount: 3000000, finalPayoutAmount: 7500000 },
      "therapist-thr-002": { monthlySettlementAmount: 900000, fullAttendanceAllowanceAmount: 0, countKingBonusAmount: 1000000, finalPayoutAmount: 1900000 }
    }
  },
  mismatchReportShape: ["area", "fixtureId", "expected", "actual", "sourceReference", "relatedRequirement", "message"]
} as const;

export type MigrationMismatchReport = {
  area: string;
  fixtureId: string;
  expected: unknown;
  actual: unknown;
  sourceReference: string;
  relatedRequirement: string;
  message: string;
};
