import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  listMonthlyClosingPreview,
  type MonthlyClosingPreviewDto
} from "@/modules/closing/monthly-closing-preview-service";
import {
  getMonthlyClosingSnapshotByVersion,
  listMonthlyClosingVersions,
  type MonthlyClosingVersionSummaryDto
} from "@/modules/closing/monthly-closing-service";
import { type SettlementEvidenceCallDto } from "@/modules/settlements/settlement-evidence-call";
import {
  listTherapistDailyPayoutConfirmationsForMonth,
  listTherapistDailySettlements,
  type TherapistAssignmentEvidenceDto
} from "@/modules/settlements/therapist-daily-settlement-service";
import { listTherapistAttendanceForDate } from "@/modules/settlements/therapist-attendance-service";
import {
  listOpsDailyIncentives,
  listOpsDailyPayoutConfirmationsForMonth
} from "@/modules/settlements/ops-daily-incentive-service";
import { listOpsMonthlyIncentivePreview, type OpsMonthlyIncentiveRowDto } from "@/modules/settlements/ops-monthly-incentive-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

/**
 * 월 명세서(스펙 F05, 티켓 32): 직원 한 명과 운영월 하나의 현재 계산 결과 또는 마감 버전 스냅샷을 근거와 함께 보여준다.
 * 두 직군(Therapist·운영팀)을 이 서비스 하나가 함께 다룬다.
 *
 * - 마감 전(이 운영월에 마감 버전이 아직 없거나, 보는 사람이 특정 버전을 고르지 않은 draft 조회): 각 직군 서비스를
 *   다시 불러 "지금" 계산 결과와 날짜별 근거(출근, 콜 목록, 지급 확인)를 그대로 보여준다.
 * - 마감 후(마감 버전이 있으면 기본으로 가장 최근 버전을, 또는 고른 버전을): `monthly-closing-service`의 스냅샷에서
 *   그 직원의 행만 꺼낸다. 스냅샷은 월 집계(월 정산 합계, 만근수당·콜킹보너스, 코스별 집계, 적용 정책 설명)만 담고
 *   날짜별 출근·콜 목록은 담지 않으므로, 그 두 항목은 "이 마감 버전에는 해당 근거가 저장되지 않았습니다"로 대신한다.
 *   다시 계산해 채우지 않는다(스냅샷은 확정 당시 그대로 보존돼야 한다).
 * - 지급 확인 상태는 두 경우 모두 지급 확인 사건 테이블(ADR 0004)에서 그대로 읽는다. 이 테이블은 마감 스냅샷의
 *   일부가 아니라 독립된 사건 기록이고, 마감확정·잠금 운영월에서는 쓰기만 막히므로 읽기는 항상 지금 상태를 보인다.
 */

export const monthlyStatementEmployeeGroups = ["THERAPIST", "OPERATIONS"] as const;
export type MonthlyStatementEmployeeGroup = (typeof monthlyStatementEmployeeGroups)[number];

function isMonthlyStatementEmployeeGroup(value: string): value is MonthlyStatementEmployeeGroup {
  return (monthlyStatementEmployeeGroups as readonly string[]).includes(value);
}

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type EmployeeRecord = {
  id: string;
  displayName: string;
  staffCode: string;
  employeeGroup: string;
};

type MonthlyStatementPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee: {
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
  };
};

export class MonthlyStatementDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MonthlyStatementDomainError";
  }
}

/**
 * 월 집계 금액 근거. 직군마다 모양이 달라 kind로 가른다. 각 숫자 필드는 월 집계(미리보기 또는 마감 스냅샷,
 * 둘 다 같은 계산 서비스가 만든 값)에서 그대로 옮긴 것이다. 화면은 이 구조화된 값으로 직접 문구를 만들고
 * (예: closing/page.tsx의 fullAttendanceBasisText·countKingBasisText와 같은 방식), 운영팀의
 * monthlyCalculationBasis 원문은 lib/i18n/settlement-basis.ts의 settlementBasisText로 번역한다.
 * 서비스 쪽에서 한국어 문장으로 미리 조립해 두면 vi 화면에서 그 문장이 그대로 새므로 여기서는 숫자만 둔다.
 */
export type MonthlyStatementTherapistSummaryDto = {
  kind: "THERAPIST";
  totalCallCount: number;
  monthlySettlementAmount: number;
  fullAttendanceDays: number | null;
  fullAttendanceAllowanceAmount: number;
  countKingRank: number | null;
  countKingBonusAmount: number;
};

export type MonthlyStatementOperationsSummaryDto = {
  kind: "OPERATIONS";
  dailyIncentiveAmount: number;
  monthlyIncentiveAmount: number;
  /** 운영팀 월 인센 계산 근거(한국어 원문, settlementBasisText로 표시 직전 번역). 정책이 없으면 null. */
  monthlyCalculationBasis: string | null;
  dailyEvidenceCount: number;
};

/** 이 직원의 월 집계 행이 없으면(한 번도 활동이 없었거나, 마감 버전이 그 직원보다 먼저 만들어졌으면) null. */
export type MonthlyStatementSummaryDto =
  | MonthlyStatementTherapistSummaryDto
  | MonthlyStatementOperationsSummaryDto
  | null;

/** 그 날의 출근·콜 근거·금액·지급 확인. 마감 버전 스냅샷에는 이 날짜별 항목이 저장돼 있지 않다. */
export type MonthlyStatementDailyEntryDto = {
  serviceDate: string;
  /** 출근 요약(Therapist는 출퇴근 시각, 운영팀은 근무상태 표시명). 기록이 없으면 null. */
  attendanceSummary: string | null;
  callCount: number;
  amount: number;
  calls: SettlementEvidenceCallDto[];
  /**
   * S9(V08): 적용 정책 근거(코스 수당·0원 정책). Therapist만 콜마다 담당 역할(role)·적용 코스 수당
   * (commissionAmount)·그 코스 수당의 상태(rateStatus: applied/zero_policy/missing_policy)를 둔다.
   * 운영팀은 코스 수당 개념이 없어 항상 빈 배열이다.
   */
  appliedPolicies: TherapistAssignmentEvidenceDto[];
  /** 그 날 이 직원 단위의 지급 확인. 그 단위가 없으면(예: 담당 콜 없는 Therapist의 날) null. */
  payoutConfirmation: PayoutConfirmationDto | null;
};

export type MonthlyStatementEvidenceDto =
  | { available: true; dailyEntries: MonthlyStatementDailyEntryDto[] }
  | { available: false; notice: string };

/**
 * 지급 확인 단위 하나(날짜 단위, 운영팀은 월 단위 하나 더). 만근수당·콜킹보너스는 포함하지 않는다(별도 지급 확인
 * 단위가 아니다). serviceDate가 null이면 운영팀 월 인센 단위다 — 화면이 그때 쓸 문구를 직접 번역해 붙인다
 * (서비스가 "월 인센티브"를 한국어로 미리 박아 두면 vi 화면에 그대로 샌다).
 */
export type MonthlyStatementPayoutUnitDto = {
  serviceDate: string | null;
  payoutConfirmation: PayoutConfirmationDto;
};

export type MonthlyStatementDto = {
  operatingMonthId: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  employeeId: string;
  displayName: string;
  staffCode: string;
  employeeGroup: MonthlyStatementEmployeeGroup;
  /** 마감 버전 스냅샷을 보이는 중이면 true, "지금 계산 결과"(미확정)를 보이는 중이면 false. */
  isConfirmed: boolean;
  closeVersion: number | null;
  confirmedAt: string | null;
  confirmedByAccountId: string | null;
  reopenedAt: string | null;
  reopenedByAccountId: string | null;
  reopenReason: string | null;
  /** 버전 고르기 화면용, 최신순. 재오픈·재확정을 거쳐도 지난 버전이 그대로 남아 있다. */
  availableVersions: MonthlyClosingVersionSummaryDto[];
  /** 월 최종 금액(직군별 finalPayoutAmount/totalOpsPayoutAmount/payoutAmount). 집계 행이 없으면 0. */
  finalAmount: number;
  summary: MonthlyStatementSummaryDto;
  evidence: MonthlyStatementEvidenceDto;
  payoutUnits: MonthlyStatementPayoutUnitDto[];
};

export type MonthlyStatementDependencies = {
  listMonthlyClosingPreview: typeof listMonthlyClosingPreview;
  listMonthlyClosingVersions: typeof listMonthlyClosingVersions;
  getMonthlyClosingSnapshotByVersion: typeof getMonthlyClosingSnapshotByVersion;
  listTherapistDailySettlements: typeof listTherapistDailySettlements;
  listTherapistAttendanceForDate: typeof listTherapistAttendanceForDate;
  listTherapistDailyPayoutConfirmationsForMonth: typeof listTherapistDailyPayoutConfirmationsForMonth;
  listOpsDailyIncentives: typeof listOpsDailyIncentives;
  listOpsDailyPayoutConfirmationsForMonth: typeof listOpsDailyPayoutConfirmationsForMonth;
  listOpsMonthlyIncentivePreview: typeof listOpsMonthlyIncentivePreview;
};

const defaultDependencies: MonthlyStatementDependencies = {
  listMonthlyClosingPreview,
  listMonthlyClosingVersions,
  getMonthlyClosingSnapshotByVersion,
  listTherapistDailySettlements,
  listTherapistAttendanceForDate,
  listTherapistDailyPayoutConfirmationsForMonth,
  listOpsDailyIncentives,
  listOpsDailyPayoutConfirmationsForMonth,
  listOpsMonthlyIncentivePreview
};

export type GetMonthlyStatementInput = {
  operatingMonthId: string;
  employeeId: string;
  /** 특정 마감 버전을 고르면 그 스냅샷을 그대로 본다(최신이 아니어도 된다). 생략하면 버전이 있는 만큼 최신 버전, 없으면 지금 계산. */
  closeVersion?: number | null;
  prismaClient?: MonthlyStatementPrismaClient;
  dependencies?: Partial<MonthlyStatementDependencies>;
};

const statementQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  employeeId: z.string().trim().min(1, "직원을 선택하세요."),
  closeVersion: z.number().int().min(1, "마감 버전을 선택하세요.").nullish()
});

function getClient(client?: MonthlyStatementPrismaClient) {
  return client ?? (prisma as unknown as MonthlyStatementPrismaClient);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function castClient<T>(client: MonthlyStatementPrismaClient): T {
  return client as unknown as T;
}

const NO_EVIDENCE_NOTICE = "이 마감 버전에는 해당 근거가 저장되지 않았습니다.";

type StatementSections = Pick<MonthlyClosingPreviewDto, "therapists" | "operations">;

type AmountSummaryResult = { finalAmount: number; summary: MonthlyStatementSummaryDto };

/**
 * 직군별 월 집계 행(지금 계산한 미리보기 또는 마감 스냅샷, 둘 다 같은 모양이다)에서 이 직원의 금액 근거를 뽑는다.
 * 스냅샷에 그대로 저장돼 있던 숫자만 옮기고 다시 계산하지 않는다. 행이 없으면(이 직원이 그 달에 활동이
 * 없었거나, 마감 스냅샷이 이 직원보다 먼저 만들어졌으면) summary는 null이고 finalAmount는 0이다.
 */
function buildAmountSummary(sections: StatementSections, group: MonthlyStatementEmployeeGroup, employeeId: string): AmountSummaryResult {
  if (group === "THERAPIST") {
    const row = sections.therapists.rows.find((item) => item.employeeId === employeeId) ?? null;
    if (!row) return { finalAmount: 0, summary: null };
    return {
      finalAmount: row.finalPayoutAmount,
      summary: {
        kind: "THERAPIST",
        totalCallCount: row.totalCallCount,
        monthlySettlementAmount: row.monthlySettlementAmount,
        fullAttendanceDays: row.fullAttendanceDays,
        fullAttendanceAllowanceAmount: row.fullAttendanceAllowanceAmount,
        countKingRank: row.countKingRank,
        countKingBonusAmount: row.countKingBonusAmount
      }
    };
  }

  const row = sections.operations.rows.find((item) => item.employeeId === employeeId) ?? null;
  if (!row) return { finalAmount: 0, summary: null };
  return {
    finalAmount: row.totalOpsPayoutAmount,
    summary: {
      kind: "OPERATIONS",
      dailyIncentiveAmount: row.dailyIncentiveAmount,
      monthlyIncentiveAmount: row.monthlyIncentiveAmount,
      monthlyCalculationBasis: row.monthlyCalculationBasis,
      dailyEvidenceCount: row.dailyEvidenceCount
    }
  };
}

function therapistAttendanceSummary(row: { checkInTime: string | null; checkOutTime: string | null } | null) {
  if (!row || !row.checkInTime) return null;
  return `${row.checkInTime}–${row.checkOutTime ?? "퇴근 미기록"}`;
}

/** 운영월 날짜를 하루씩 돈다(운영팀의 ...ForMonth 함수와 같은 패턴, 티켓 31). */
function* eachServiceDate(startDate: Date, endDate: Date) {
  for (let cursor = startDate; cursor <= endDate; cursor = new Date(cursor.getTime() + 86400000)) {
    yield toIsoDate(cursor);
  }
}

async function buildDraftDailyEntries(input: {
  group: MonthlyStatementEmployeeGroup;
  employeeId: string;
  operatingMonthId: string;
  startDate: Date;
  endDate: Date;
  deps: MonthlyStatementDependencies;
  client: MonthlyStatementPrismaClient;
}): Promise<MonthlyStatementDailyEntryDto[]> {
  const entries: MonthlyStatementDailyEntryDto[] = [];

  for (const serviceDate of eachServiceDate(input.startDate, input.endDate)) {
    if (input.group === "THERAPIST") {
      const [settlementResult, attendanceResult] = await Promise.all([
        input.deps.listTherapistDailySettlements({
          operatingMonthId: input.operatingMonthId,
          serviceDate,
          prismaClient: castClient(input.client)
        }),
        input.deps.listTherapistAttendanceForDate({
          operatingMonthId: input.operatingMonthId,
          attendanceDate: serviceDate,
          prismaClient: castClient(input.client)
        })
      ]);
      const settlement = settlementResult.settlements.find((item) => item.employeeId === input.employeeId) ?? null;
      const attendance = attendanceResult.rows.find((item) => item.employeeId === input.employeeId) ?? null;
      if (!settlement && !attendance) continue;
      entries.push({
        serviceDate,
        attendanceSummary: therapistAttendanceSummary(attendance),
        callCount: settlement?.totalCallCount ?? 0,
        amount: settlement?.totalCommissionAmount ?? 0,
        calls: settlement ? settlement.assignmentEvidence.map((evidence) => evidence.call) : [],
        // S9(V08): 코스 수당 근거(적용/0원/수당 없음)를 담당 역할·콜별로 그대로 둔다.
        appliedPolicies: settlement ? settlement.assignmentEvidence : [],
        payoutConfirmation: settlement?.payoutConfirmation ?? null
      });
      continue;
    }

    const result = await input.deps.listOpsDailyIncentives({
      operatingMonthId: input.operatingMonthId,
      serviceDate,
      prismaClient: castClient(input.client)
    });
    const row = result.rows.find((item) => item.employeeId === input.employeeId) ?? null;
    if (!row) continue;
    entries.push({
      serviceDate,
      attendanceSummary: row.statusDisplayName,
      callCount: result.callEvidence.length,
      amount: row.payoutAmount,
      calls: result.callEvidence.flatMap((evidence) => (evidence.call ? [evidence.call] : [])),
      // 운영팀도 코스 수당이 아니라 인센 규칙이라 적용 정책(코스 수당) 개념이 없다.
      appliedPolicies: [],
      payoutConfirmation: row.payoutConfirmation
    });
  }

  return entries;
}

function buildDraftPayoutUnits(input: {
  group: MonthlyStatementEmployeeGroup;
  dailyEntries: MonthlyStatementDailyEntryDto[];
  opsMonthlyRow: OpsMonthlyIncentiveRowDto | null;
}): MonthlyStatementPayoutUnitDto[] {
  const units: MonthlyStatementPayoutUnitDto[] = [];
  for (const entry of input.dailyEntries) {
    if (entry.payoutConfirmation) {
      units.push({ serviceDate: entry.serviceDate, payoutConfirmation: entry.payoutConfirmation });
    }
  }
  if (input.group === "OPERATIONS" && input.opsMonthlyRow) {
    units.push({ serviceDate: null, payoutConfirmation: input.opsMonthlyRow.payoutConfirmation });
  }
  return units;
}

function sortPayoutUnits(rows: Array<{ serviceDate: string; payoutConfirmation: PayoutConfirmationDto }>): MonthlyStatementPayoutUnitDto[] {
  return [...rows]
    .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate))
    .map((row) => ({ serviceDate: row.serviceDate, payoutConfirmation: row.payoutConfirmation }));
}

/**
 * 마감 버전을 보는 중에는 날짜별 근거가 스냅샷에 없어 다시 계산할 수 없지만, 지급 확인은 독립된 사건 기록이라
 * 지금 상태를 그대로 읽을 수 있다(이 서비스 doc 참고). 그래서 ...ForMonth 함수로 단위별 지금 상태를 모은다.
 */
async function buildClosedPayoutUnits(input: {
  group: MonthlyStatementEmployeeGroup;
  employeeId: string;
  operatingMonthId: string;
  deps: MonthlyStatementDependencies;
  client: MonthlyStatementPrismaClient;
  opsMonthlyRow: OpsMonthlyIncentiveRowDto | null;
}): Promise<MonthlyStatementPayoutUnitDto[]> {
  if (input.group === "THERAPIST") {
    const rows = await input.deps.listTherapistDailyPayoutConfirmationsForMonth({
      operatingMonthId: input.operatingMonthId,
      prismaClient: castClient(input.client)
    });
    return sortPayoutUnits(rows.filter((row) => row.employeeId === input.employeeId));
  }

  const rows = await input.deps.listOpsDailyPayoutConfirmationsForMonth({
    operatingMonthId: input.operatingMonthId,
    prismaClient: castClient(input.client)
  });
  const units = sortPayoutUnits(rows.filter((row) => row.employeeId === input.employeeId));
  if (input.opsMonthlyRow) {
    units.push({ serviceDate: null, payoutConfirmation: input.opsMonthlyRow.payoutConfirmation });
  }
  return units;
}

/**
 * 직원 한 명·운영월 하나의 월 명세서를 돌려준다(스펙 F05, 티켓 32). 관리자·정산 담당만 이 함수를 쓰는 화면을
 * 열 수 있고(화면 라우트 접근 검사), 이 함수 자체는 조회라 권한 검사를 하지 않는다(다른 정산 조회 서비스와 같다).
 */
export async function getMonthlyStatement(input: GetMonthlyStatementInput): Promise<MonthlyStatementDto> {
  const parsed = statementQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new MonthlyStatementDomainError(parsed.error.issues[0]?.message ?? "월 명세서 조회 조건이 올바르지 않습니다.", "INVALID_MONTHLY_STATEMENT_INPUT");
  }

  const client = getClient(input.prismaClient);
  const deps = { ...defaultDependencies, ...input.dependencies };

  const [operatingMonth, employee] = await Promise.all([
    client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } }),
    client.employee.findUnique({ where: { id: parsed.data.employeeId } })
  ]);
  if (!operatingMonth) {
    throw new MonthlyStatementDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  if (!employee) {
    throw new MonthlyStatementDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
  }
  if (!isMonthlyStatementEmployeeGroup(employee.employeeGroup)) {
    throw new MonthlyStatementDomainError("이 직원의 월 명세서를 지원하지 않습니다.", "UNSUPPORTED_EMPLOYEE_GROUP");
  }
  const group = employee.employeeGroup;

  const versions = await deps.listMonthlyClosingVersions({ operatingMonthId: parsed.data.operatingMonthId, prismaClient: castClient(client) });

  let targetVersion: MonthlyClosingVersionSummaryDto | null;
  if (parsed.data.closeVersion != null) {
    targetVersion = versions.find((version) => version.closeVersion === parsed.data.closeVersion) ?? null;
    if (!targetVersion) {
      throw new MonthlyStatementDomainError("해당 마감 버전을 찾을 수 없습니다.", "MONTHLY_STATEMENT_VERSION_NOT_FOUND");
    }
  } else if (operatingMonth.status === "마감확정" || operatingMonth.status === "잠금") {
    // S9: 마감확정·잠금은 가장 최근 확정 스냅샷이 기본이다. 스냅샷이 없으면(있어야 하는데 없는 상태) 지금
    // 계산으로 내려가지 않고 바로 거절한다(_bmad-output/project-context.md:190, getMonthlyClosingSnapshot과
    // 같은 코드).
    targetVersion = versions[0] ?? null;
    if (!targetVersion) {
      throw new MonthlyStatementDomainError("확정 스냅샷을 찾을 수 없습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
    }
  } else {
    // S9: 작성중·검토중(재오픈 포함)은 버전을 고르지 않았으면 언제나 미확정 지금 계산이 기본이다(ops-monthly
    // 화면처럼 재오픈된 이전 스냅샷을 현재 기준과 섞지 않는다). 이전 마감 버전은 availableVersions로 고를 수 있다.
    targetVersion = null;
  }

  let opsMonthlyRow: OpsMonthlyIncentiveRowDto | null = null;
  if (group === "OPERATIONS") {
    const opsMonthly = await deps.listOpsMonthlyIncentivePreview({ operatingMonthId: parsed.data.operatingMonthId, prismaClient: castClient(client) });
    opsMonthlyRow = opsMonthly.rows.find((row) => row.employeeId === employee.id) ?? null;
  }

  const base = {
    operatingMonthId: operatingMonth.id,
    monthKey: operatingMonth.monthKey,
    startDate: toIsoDate(operatingMonth.startDate),
    endDate: toIsoDate(operatingMonth.endDate),
    employeeId: employee.id,
    displayName: employee.displayName,
    staffCode: employee.staffCode,
    employeeGroup: group,
    availableVersions: versions
  };

  if (targetVersion) {
    const closing = await deps.getMonthlyClosingSnapshotByVersion({
      operatingMonthId: parsed.data.operatingMonthId,
      closeVersion: targetVersion.closeVersion,
      prismaClient: castClient(client)
    });
    const summary = buildAmountSummary(closing.snapshot, group, employee.id);
    const payoutUnits = await buildClosedPayoutUnits({
      group,
      employeeId: employee.id,
      operatingMonthId: parsed.data.operatingMonthId,
      deps,
      client,
      opsMonthlyRow
    });

    return {
      ...base,
      isConfirmed: true,
      closeVersion: closing.closeVersion,
      confirmedAt: closing.confirmedAt,
      confirmedByAccountId: closing.confirmedByAccountId,
      reopenedAt: closing.reopenedAt,
      reopenedByAccountId: closing.reopenedByAccountId,
      reopenReason: closing.reopenReason,
      ...summary,
      evidence: { available: false, notice: NO_EVIDENCE_NOTICE },
      payoutUnits
    };
  }

  const preview = await deps.listMonthlyClosingPreview({ operatingMonthId: parsed.data.operatingMonthId, prismaClient: castClient(client) });
  const summary = buildAmountSummary(preview, group, employee.id);
  const dailyEntries = await buildDraftDailyEntries({
    group,
    employeeId: employee.id,
    operatingMonthId: parsed.data.operatingMonthId,
    startDate: operatingMonth.startDate,
    endDate: operatingMonth.endDate,
    deps,
    client
  });
  const payoutUnits = buildDraftPayoutUnits({ group, dailyEntries, opsMonthlyRow });

  return {
    ...base,
    isConfirmed: false,
    closeVersion: null,
    confirmedAt: null,
    confirmedByAccountId: null,
    reopenedAt: null,
    reopenedByAccountId: null,
    reopenReason: null,
    ...summary,
    evidence: { available: true, dailyEntries },
    payoutUnits
  };
}
