import { prisma } from "@/lib/prisma";
import { ServiceCallDomainError } from "./service-call-domain-error";

// isNoShowStatus·isCanceledStatus와 같은 값이다(S10). listAssignedServiceCallsForEmployeeFromDate가
// SQL where에 그대로 쓴다 — masters/employee-service.ts가 손으로 복제해 두던 자리를 여기로 모은다.
const NO_SHOW_OR_CANCELED_STATUSES = ["노쇼", "NO_SHOW", "취소", "CANCELED"];

/** 근무표(28)와 같은 좁은 타입: 직원 비활성 거절(B08, masters/employee-service.ts)이 요구하는 모양만 둔다. */
type AssignedCallFromDateReadClient = {
  serviceCall: { findMany(args: unknown): Promise<{ id: string; serviceDate: Date; startTime: string }[]> };
};

/**
 * 그 직원이 주어진 날짜(포함)부터 어느 배정 역할로든 배정된, 노쇼·취소가 아닌 콜 요약(S10). 직원
 * 비활성 거절(B08)이 원장 테이블을 직접 읽고 노쇼·취소 상태를 복제하던 자리를 이 질의로 옮긴다
 * (isNoShowStatus·isCanceledStatus와 같은 기준). 날짜·시간 순 정렬은 호출하는 쪽이 한다(시간 슬롯
 * 정렬 순서를 알아야 하는데, 그 정보는 master data라 이 함수가 갖고 있지 않다).
 */
export async function listAssignedServiceCallsForEmployeeFromDate(input: {
  employeeId: string;
  fromDate: string;
  prismaClient?: AssignedCallFromDateReadClient;
}): Promise<Array<{ serviceCallId: string; serviceDate: string; startTime: string }>> {
  const employeeId = input.employeeId.trim();
  if (!employeeId) {
    throw new ServiceCallDomainError("직원을 선택하세요.", "INVALID_SERVICE_CALL_QUERY");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fromDate)) {
    throw new ServiceCallDomainError("날짜는 YYYY-MM-DD 형식이어야 합니다.", "INVALID_SERVICE_CALL_QUERY");
  }

  const client = input.prismaClient ?? (prisma as unknown as AssignedCallFromDateReadClient);
  const records = await client.serviceCall.findMany({
    where: {
      serviceDate: { gte: new Date(`${input.fromDate}T00:00:00.000Z`) },
      status: { notIn: NO_SHOW_OR_CANCELED_STATUSES },
      assignments: { some: { employeeId, isActive: true } }
    },
    select: { id: true, serviceDate: true, startTime: true }
  });

  return records.map((record) => ({
    serviceCallId: record.id,
    serviceDate: record.serviceDate.toISOString().slice(0, 10),
    startTime: record.startTime
  }));
}
