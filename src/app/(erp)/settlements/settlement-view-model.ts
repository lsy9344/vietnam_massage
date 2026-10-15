import type { TherapistAttendanceDto } from "@/modules/settlements/therapist-attendance-service";
import type { TherapistAssignmentEvidenceDto, TherapistDailySettlementDto } from "@/modules/settlements/therapist-daily-settlement-service";

export type SettlementCourseCode = keyof TherapistDailySettlementDto["courseBreakdown"];

/**
 * 고른 직원은 주소의 이 매개변수에 남아 새로고침에서 복원된다(정보구조 8.1 "레코드를 가리키는 패널은 주소에 id를 남긴다").
 * 서버 페이지도 읽으므로 "use client" 파일이 아니라 여기에 둔다(클라이언트 파일의 값은 서버에서 참조로만 보인다).
 */
export const EMPLOYEE_PARAM = "employee";

/**
 * 정산 화면에 그릴 금액. 값은 서비스가 준 그대로이고, 계산 근거가 없으면 0 대신 "근거 없음"으로 그린다
 * (티켓 05, design.md 6.7). 0원 정책, 기준 미달, 근무상태 제외처럼 근거가 있는 0은 그대로 0이다.
 */
export type SettlementAmount = { kind: "amount"; value: number } | { kind: "noBasis" };

const noBasis: SettlementAmount = { kind: "noBasis" };

export function settlementAmount(value: number, hasBasis: boolean): SettlementAmount {
  return hasBasis ? { kind: "amount", value } : noBasis;
}

/** 근무상태로 제외된 직원의 0원은 판정 결과라 0이다. 지급 대상인데 계산 근거가 없으면 근거 없음이다. */
export function payoutAmount(value: number, input: { isPayoutEligible: boolean; hasBasis: boolean }): SettlementAmount {
  return settlementAmount(value, !input.isPayoutEligible || input.hasBasis);
}

/** 귀케어 풀은 그날 계산된 방문완료 콜에서 나온다. 그런 콜이 없으면 풀과 배분에 근거가 없다. */
export function earcareHasBasis(result: { sourceCallCount: number }) {
  return result.sourceCallCount > 0;
}

/** 운영팀 인센 정책이 없으면 근거가 없다. 기준 미달의 0은 정책이 정한 결과다. */
export function incentiveRuleHasBasis(ruleStatus: string) {
  return ruleStatus !== "missing_policy";
}

function hasRatedEvidence(evidence: TherapistAssignmentEvidenceDto[]) {
  return evidence.some((item) => item.rateStatus !== "missing_policy");
}

/** 정책이 없어 0원으로 남긴 담당 건은 근거 없음, 0원으로 등록한 정책은 0원이다. */
export function therapistEvidenceAmount(evidence: TherapistAssignmentEvidenceDto): SettlementAmount {
  return settlementAmount(evidence.commissionAmount, evidence.rateStatus !== "missing_policy");
}

/** 방문완료 담당 콜이 없거나 모든 담당 건에 정책이 없으면 근거 없음. 일부만 없으면 서비스 합계를 그리고 정책 상태가 따로 알린다. */
export function therapistSettlementAmount(settlement: TherapistDailySettlementDto | null): SettlementAmount {
  if (!settlement) return noBasis;
  return settlementAmount(settlement.totalCommissionAmount, hasRatedEvidence(settlement.assignmentEvidence));
}

export function therapistDailyTotal(settlements: TherapistDailySettlementDto[]): SettlementAmount {
  return settlementAmount(
    settlements.reduce((sum, row) => sum + row.totalCommissionAmount, 0),
    hasRatedEvidence(settlements.flatMap((row) => row.assignmentEvidence))
  );
}

export function therapistCourseAmount(settlement: TherapistDailySettlementDto, courseCode: SettlementCourseCode): SettlementAmount {
  return settlementAmount(
    settlement.courseBreakdown[courseCode].commissionAmount,
    hasRatedEvidence(settlement.assignmentEvidence.filter((item) => item.courseCode === courseCode))
  );
}

/** 직원 비교 표의 한 행: 출퇴근(활성 마사지사 전원)과 일별 정산(방문완료 담당이 있는 마사지사)을 직원 기준으로 합친다. */
export type TherapistComparisonRow = {
  employeeId: string;
  displayName: string;
  staffCode: string;
  sortOrder: number;
  /** 출퇴근 조회가 실패했거나 활성 마사지사가 아니면 null. */
  attendance: TherapistAttendanceDto | null;
  /** 그날 방문완료 담당 콜이 없거나 정산 조회가 실패하면 null. */
  settlement: TherapistDailySettlementDto | null;
};

/** 두 조회는 서로 독립이라 하나가 실패해도 다른 쪽의 직원은 그대로 보인다. */
export function therapistComparisonRows(
  settlements: TherapistDailySettlementDto[] | null,
  attendanceRows: TherapistAttendanceDto[] | null
): TherapistComparisonRow[] {
  const rows = new Map<string, TherapistComparisonRow>();
  for (const attendance of attendanceRows ?? []) {
    rows.set(attendance.employeeId, { ...identity(attendance), attendance, settlement: null });
  }
  for (const settlement of settlements ?? []) {
    const existing = rows.get(settlement.employeeId);
    rows.set(settlement.employeeId, existing ? { ...existing, settlement } : { ...identity(settlement), attendance: null, settlement });
  }
  return [...rows.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode));
}

function identity(row: { employeeId: string; displayName: string; staffCode: string; sortOrder: number }) {
  return { employeeId: row.employeeId, displayName: row.displayName, staffCode: row.staffCode, sortOrder: row.sortOrder };
}
