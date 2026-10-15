import type { ServiceCallRowDto } from "@/modules/calls/service-call-service";

/**
 * 정산 근거 콜의 요약. 관리자는 이 값으로 원장의 그 날짜·그 콜로 가고, 원장 권한이 없는 정산 담당은
 * 링크 대신 이 요약을 그 자리에서 본다(스토리 148). 고객/메모, 연락처, 금액은 넣지 않는다.
 */
export type SettlementEvidenceCallDto = {
  serviceCallId: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  courseCode: string;
  therapistNames: string[];
  status: string;
};

export function settlementEvidenceCall(row: ServiceCallRowDto): SettlementEvidenceCallDto {
  return {
    serviceCallId: row.id,
    operatingMonthId: row.operatingMonthId,
    serviceDate: row.serviceDate,
    startTime: row.startTime,
    courseCode: row.courseCode,
    therapistNames: [row.therapist1, row.therapist2].flatMap((assignee) => (assignee ? [assignee.displayName] : [])),
    status: row.status
  };
}
