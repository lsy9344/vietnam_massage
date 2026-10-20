import { prisma } from "@/lib/prisma";
import { businessTodayServiceDate } from "@/lib/operating-date";
import { listTherapistDailySettlements } from "@/modules/settlements/therapist-daily-settlement-service";
import { therapistPayoutStatusOf, type TherapistPayoutStatus } from "@/modules/therapists/therapist-payout-status";

export type TherapistPayoutCallDto = {
  serviceCallId: string;
  startTime: string;
  courseCode: string;
  commissionAmount: number;
  isAmountPending: boolean;
};

export type TherapistPayoutViewDto = {
  operatingMonthId: string | null;
  serviceDate: string;
  amount: number;
  confirmationStatus: TherapistPayoutStatus | null;
  calls: TherapistPayoutCallDto[];
};

// R28: 형제 파일(therapist-request-service.ts 등)처럼 이 함수가 직접 건드리는 모양만 좁게
// 선언한다. listTherapistDailySettlements에 넘길 때는 그 함수의 prismaClient 타입(therapist-daily-
// settlement-service.ts 안에만 있고 export되지 않는다)을 Parameters로 가져와 그 자리에서만 캐스팅한다
// (monthly-closing-preview-service.ts와 같은 선례) — 이 함수의 입력 타입 자체를 `unknown`으로 두지
// 않는다.
type PayoutReadClient = {
  operatingMonth: { findUnique(args: unknown): Promise<{ id: string } | null> };
};

/**
 * Therapist에게는 현재 영업일의 자기 수당만 반환한다. 조회할 월이나 날짜를 요청에서 받지 않으며,
 * 월 명세서·월 보너스·지난 날짜 내역은 읽지 않는다. 운영팀의 정산·보존 기록은 그대로 둔다.
 */
export async function getTherapistPayoutView(input: {
  employeeId: string;
  now?: Date;
  prismaClient?: PayoutReadClient;
  dependencies?: { listTherapistDailySettlements: typeof listTherapistDailySettlements };
}): Promise<TherapistPayoutViewDto> {
  const client = input.prismaClient ?? (prisma as unknown as PayoutReadClient);
  const serviceDate = businessTodayServiceDate(input.now);
  const month = await client.operatingMonth.findUnique({ where: { monthKey: serviceDate.slice(0, 7) }, select: { id: true } });
  const empty: TherapistPayoutViewDto = { operatingMonthId: month?.id ?? null, serviceDate, amount: 0, confirmationStatus: null, calls: [] };
  if (!month) return empty;

  const { settlements } = await (input.dependencies?.listTherapistDailySettlements ?? listTherapistDailySettlements)({
    operatingMonthId: month.id,
    serviceDate,
    prismaClient: client as unknown as Parameters<typeof listTherapistDailySettlements>[0]["prismaClient"]
  });
  const settlement = settlements.find((row) => row.employeeId === input.employeeId);
  if (!settlement) return empty;

  return {
    operatingMonthId: month.id,
    serviceDate,
    amount: settlement.totalCommissionAmount,
    confirmationStatus: therapistPayoutStatusOf(settlement.payoutConfirmation),
    calls: settlement.assignmentEvidence.map((entry) => ({
      serviceCallId: entry.serviceCallId,
      startTime: entry.call.startTime,
      courseCode: entry.courseCode,
      commissionAmount: entry.commissionAmount,
      isAmountPending: entry.rateStatus === "missing_policy"
    }))
  };
}

/** 오늘 홈의 기존 수당 요약. 계산은 일별 정산 서비스가 맡는다. */
export async function expectedPayoutAmountForDate(input: {
  employeeId: string;
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: NonNullable<Parameters<typeof listTherapistDailySettlements>[0]["prismaClient"]>;
}): Promise<number> {
  const { settlements } = await listTherapistDailySettlements({
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    prismaClient: input.prismaClient
  });
  return settlements.find((settlement) => settlement.employeeId === input.employeeId)?.totalCommissionAmount ?? 0;
}
