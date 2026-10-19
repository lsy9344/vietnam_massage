import { getMonthlyClosingSnapshotByVersion } from "@/modules/closing/monthly-closing-service";
import { listMonthlyClosingPreview, type MonthlyClosingTherapistRowDto } from "@/modules/closing/monthly-closing-preview-service";
import { getMonthlyStatement, type MonthlyStatementDto } from "@/modules/closing/monthly-statement-service";
import { listTherapistDailySettlements } from "@/modules/settlements/therapist-daily-settlement-service";
import { therapistPayoutStatusOf, type TherapistPayoutStatus } from "@/modules/therapists/therapist-payout-status";

/**
 * 수당 탭(스펙 D19–D21, M8–M10, ADR 0004·0010, 티켓 07). 새 계산식을 만들지 않고 기존 월 명세서
 * (`getMonthlyStatement`)·월마감 미리보기(`listMonthlyClosingPreview`)·마감 스냅샷
 * (`getMonthlyClosingSnapshotByVersion`)의 결과를 이 Therapist의 행만 골라 좁은 DTO로 옮긴다(M6).
 *
 * 다른 Therapist의 이름·금액은 아예 담지 않는다. 순위·기준선(콜킹 1–3위 콜 수)은 숫자만 옮긴다(M9).
 */

export type TherapistPayoutCallDto = {
  serviceCallId: string;
  startTime: string;
  courseCode: string;
  commissionAmount: number;
  /** 코스 수당이 없어 계산하지 못한 콜(D19: "금액 확인 중"). amount는 0으로 온다(rateStatus "missing_policy"). */
  isAmountPending: boolean;
};

export type TherapistPayoutDailyEntryDto = {
  serviceDate: string;
  /** 그날 코스 수당 합계(그날 지급 확인의 현재 계산 금액과 같다). */
  amount: number;
  /** 그날 지급 확인 사건이 없으면(담당 콜이 없었던 날) null. */
  confirmationStatus: TherapistPayoutStatus | null;
  /** 마감된 달은 콜별 근거가 스냅샷에 없어 항상 빈 배열이다(evidenceAvailable이 false일 때). */
  calls: TherapistPayoutCallDto[];
};

export type TherapistPayoutRankBaselineDto = {
  rank: 1 | 2 | 3;
  /** 그 순위 Therapist의 월 콜 수(숫자만, 이름·금액은 담지 않는다). */
  callCount: number;
};

export type TherapistPayoutMonthSummaryDto = {
  /** 월 최종 금액(월 정산액 + 만근수당 + 콜킹 보너스). 집계 행이 아직 없으면 0. */
  finalAmount: number;
  /** 콜킹 기준 완료 콜 수(방문완료). 집계 행이 없으면 0. */
  totalCallCount: number;
  /** 만근 인정 일수. Story 4.1 source가 없으면 null. */
  fullAttendanceDays: number | null;
  fullAttendanceAllowanceAmount: number;
  /** 1–3위 안에 들었으면 그 순위, 아니면 null(기준 미달도 null). */
  countKingRank: number | null;
  countKingBonusAmount: number;
  /** 지금 1–3위의 콜 수(기준선, 숫자만). 아직 아무도 자격이 없으면 빈 배열. */
  rankBaseline: TherapistPayoutRankBaselineDto[];
};

export type TherapistPayoutViewDto = {
  operatingMonthId: string;
  monthKey: string;
  /** 마감확정·잠금이면 true(그 마감 버전의 확정 금액), 아니면 false(지금 계산 중, 미확정). ADR 0010. */
  isConfirmed: boolean;
  closeVersion: number | null;
  /** 날짜별 콜 근거(코스·금액)가 있는지. 마감 버전 스냅샷에는 날짜별 근거가 없다(false). */
  evidenceAvailable: boolean;
  /** evidenceAvailable이 false일 때만 채워지는 한국어 원문 안내(표시 직전 번역, resolveKoreanMessage). */
  evidenceNotice: string | null;
  dailyEntries: TherapistPayoutDailyEntryDto[];
  month: TherapistPayoutMonthSummaryDto;
};

export type TherapistPayoutViewDependencies = {
  getMonthlyStatement: typeof getMonthlyStatement;
  listMonthlyClosingPreview: typeof listMonthlyClosingPreview;
  getMonthlyClosingSnapshotByVersion: typeof getMonthlyClosingSnapshotByVersion;
};

const defaultDependencies: TherapistPayoutViewDependencies = {
  getMonthlyStatement,
  listMonthlyClosingPreview,
  getMonthlyClosingSnapshotByVersion
};

function buildDailyEntries(statement: MonthlyStatementDto): TherapistPayoutDailyEntryDto[] {
  if (statement.evidence.available) {
    return statement.evidence.dailyEntries.map((entry) => ({
      serviceDate: entry.serviceDate,
      amount: entry.amount,
      confirmationStatus: entry.payoutConfirmation ? therapistPayoutStatusOf(entry.payoutConfirmation) : null,
      // appliedPolicies[].call도 SettlementEvidenceCallDto(therapistNames 포함)지만, 여기서는
      // startTime·courseCode만 꺼내 쓴다 — 함께하는 Therapist의 이름은 옮기지 않는다(M6, D20).
      calls: entry.appliedPolicies.map((policy) => ({
        serviceCallId: policy.serviceCallId,
        startTime: policy.call.startTime,
        courseCode: policy.call.courseCode,
        commissionAmount: policy.commissionAmount,
        isAmountPending: policy.rateStatus === "missing_policy"
      }))
    }));
  }

  // 마감 버전: 날짜별 콜 근거는 스냅샷에 없지만, 지급 확인은 독립된 사건 기록이라 날짜·금액·상태는
  // payoutUnits에서 그대로 읽을 수 있다(monthly-statement-service doc 참고).
  return statement.payoutUnits
    .filter((unit): unit is { serviceDate: string; payoutConfirmation: typeof unit.payoutConfirmation } => unit.serviceDate !== null)
    .map((unit) => ({
      serviceDate: unit.serviceDate,
      amount: unit.payoutConfirmation.currentAmount,
      confirmationStatus: therapistPayoutStatusOf(unit.payoutConfirmation),
      calls: []
    }));
}

function rankBaselineOf(rows: MonthlyClosingTherapistRowDto[]): TherapistPayoutRankBaselineDto[] {
  return rows
    .filter((row): row is MonthlyClosingTherapistRowDto & { countKingRank: 1 | 2 | 3 } => row.countKingRank !== null)
    .sort((a, b) => a.countKingRank - b.countKingRank)
    .map((row) => ({ rank: row.countKingRank, callCount: row.totalCallCount }));
}

/**
 * M9: 순위·기준선은 월마감 미리보기(지금 계산 중인 달)나 그 마감 버전 스냅샷(마감된 달)의 Therapist
 * 행에서 그대로 가져온다 — getMonthlyStatement가 고른 버전(statement.closeVersion)과 같은 버전을 본다.
 */
async function therapistRankingRows(
  statement: MonthlyStatementDto,
  deps: TherapistPayoutViewDependencies,
  prismaClient: unknown
): Promise<MonthlyClosingTherapistRowDto[]> {
  if (statement.closeVersion != null) {
    const closing = await deps.getMonthlyClosingSnapshotByVersion({
      operatingMonthId: statement.operatingMonthId,
      closeVersion: statement.closeVersion,
      prismaClient: prismaClient as never
    });
    return closing.snapshot.therapists.rows;
  }
  const preview = await deps.listMonthlyClosingPreview({ operatingMonthId: statement.operatingMonthId, prismaClient: prismaClient as never });
  return preview.therapists.rows;
}

export async function getTherapistPayoutView(input: {
  employeeId: string;
  operatingMonthId: string;
  prismaClient?: unknown;
  dependencies?: Partial<TherapistPayoutViewDependencies>;
}): Promise<TherapistPayoutViewDto> {
  const deps = { ...defaultDependencies, ...input.dependencies };

  const statement = await deps.getMonthlyStatement({
    operatingMonthId: input.operatingMonthId,
    employeeId: input.employeeId,
    prismaClient: input.prismaClient as never
  });

  const rankingRows = await therapistRankingRows(statement, deps, input.prismaClient);
  const summary = statement.summary?.kind === "THERAPIST" ? statement.summary : null;

  return {
    operatingMonthId: statement.operatingMonthId,
    monthKey: statement.monthKey,
    isConfirmed: statement.isConfirmed,
    closeVersion: statement.closeVersion,
    evidenceAvailable: statement.evidence.available,
    evidenceNotice: statement.evidence.available ? null : statement.evidence.notice,
    dailyEntries: buildDailyEntries(statement),
    month: {
      finalAmount: statement.finalAmount,
      totalCallCount: summary?.totalCallCount ?? 0,
      fullAttendanceDays: summary?.fullAttendanceDays ?? null,
      fullAttendanceAllowanceAmount: summary?.fullAttendanceAllowanceAmount ?? 0,
      countKingRank: summary?.countKingRank ?? null,
      countKingBonusAmount: summary?.countKingBonusAmount ?? 0,
      rankBaseline: rankBaselineOf(rankingRows)
    }
  };
}

/**
 * "오늘" 탭의 오늘 예상 코스 수당(티켓 03 자리, M8): 그날 일별 정산 결과에서 이 Therapist의
 * totalCommissionAmount만 꺼낸다. 담당 콜이 없는 날은 이 함수를 부르지 않아도 0과 같다.
 */
export async function expectedPayoutAmountForDate(input: {
  employeeId: string;
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: unknown;
}): Promise<number> {
  const { settlements } = await listTherapistDailySettlements({
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    prismaClient: input.prismaClient as never
  });
  return settlements.find((settlement) => settlement.employeeId === input.employeeId)?.totalCommissionAmount ?? 0;
}
