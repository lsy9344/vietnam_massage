import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { businessTodayServiceDate } from "@/lib/operating-date";
import { listAuditActors, recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { listAssignedServiceCallsForEmployeeOnDate } from "@/modules/calls/service-call-service";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { toIsoDateOnly } from "@/modules/masters/operating-month-service";
import { assertValidParsedDate, isoDateFieldSchema, listPlannedWorkingDayStatusesForDate } from "@/modules/masters/planned-working-day-query";
import { setPlannedWorkingDay } from "@/modules/settlements/schedule-service";
import { listTherapistAttendanceForEmployeeInRange, upsertTherapistAttendance } from "@/modules/settlements/therapist-attendance-service";
import type { TherapistAttendanceDayRequestStatus } from "@/modules/therapists/therapist-attendance-calendar-service";

/**
 * 휴무 신청과 정정 요청(스펙 D22–D24, M24, 티켓 08·09). 한 표(TherapistRequest)에 두 종류를 담는다.
 * 08이 "휴무"를 만들고 승인했다. 이 티켓(09)이 "정정"(requestTherapistCorrection,
 * approveTherapistCorrectionRequest)을 채운다 — 승인 쪽 저장 경로가 upsertTherapistAttendance라
 * 달라서 approveTherapistDayOffRequest와는 다른 함수다. 거절·취소·목록 조회는 종류와 무관해 그대로
 * 재사용한다.
 */

// DB 저장값은 "이전 기록" 같은 다른 코드 칸처럼 한국어 문자열이다. 화면·DTO는 06이 이미 정한
// TherapistAttendanceDayRequestStatus의 영문 kind/status를 그대로 쓴다(타입을 다시 적지 않는다).
export const therapistRequestKinds = ["day_off", "special_day_off", "correction"] as const;
export type TherapistRequestKind = (typeof therapistRequestKinds)[number];

type DbRequestKind = "휴무" | "소중한날 휴가" | "정정";

// 09(정정 요청 만들기)가 쓸 변환이라 지금부터 export해 둔다(toDbKind("correction") === "정정").
export function toDbKind(kind: TherapistRequestKind): DbRequestKind {
  if (kind === "special_day_off") return "소중한날 휴가";
  return kind === "correction" ? "정정" : "휴무";
}

function fromDbKind(kind: string): TherapistRequestKind {
  if (kind === "소중한날 휴가") return "special_day_off";
  return kind === "정정" ? "correction" : "day_off";
}

type RequestStatusValue = NonNullable<TherapistAttendanceDayRequestStatus>["status"];

export type TherapistRequestErrorField = "date" | "reason" | "kind";

export class TherapistRequestDomainError extends Error {
  constructor(message: string, public readonly code: string, public readonly field?: TherapistRequestErrorField) {
    super(message);
    this.name = "TherapistRequestDomainError";
  }
}

type RequestRecord = {
  id: string;
  employeeId: string;
  kind: string;
  targetDate: Date;
  requestedCheckInTime: string | null;
  requestedCheckOutTime: string | null;
  reason: string | null;
  status: string;
  resolutionReason: string | null;
  resolvedByAccountId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: { displayName: string; staffCode: string } | null;
};

type RequestTimeSlotRecord = { value: string; sortOrder: number; createdAt: Date; isActive: boolean };
type RequestEmployeeRecord = { id: string; displayName: string; staffCode: string; employeeGroup: string; sortOrder: number; isActive: boolean };
type RequestPlannedWorkingDayRecord = {
  id: string;
  employeeId: string;
  workDate: Date;
  planStatus: string;
  plannedStartTime?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type RequestOperatingMonthRecord = { id: string; monthKey: string; status: string };

// 승인(approveTherapistDayOffRequest·approveTherapistCorrectionRequest)이 같은 트랜잭션 안에서
// setPlannedWorkingDay(근무표 서비스)·upsertTherapistAttendance(출퇴근 서비스)·
// listAssignedServiceCallsForEmployeeOnDate(콜 서비스)를 그대로 부르기 때문에, 그 서비스들이
// 요구하는 모양을 모두 담아야 한다(06의 TherapistAttendanceCalendarPrismaClient와 같은 방식의
// 교차 타입). upsertTherapistAttendance·listTherapistAttendanceForEmployeeInRange는 therapistAttendance
// 모델까지 요구해 타입이 더 커지므로, 이 둘은 clock-in-service.ts처럼 호출부에서 `as unknown as`로
// 넘긴다(operatingMonth만 이 타입에 직접 둔다 — 정정 요청·승인이 날짜로 운영월을 직접 찾아야 해서다).
type TherapistRequestPrismaClient = {
  timeSlot: { findMany(args?: unknown): Promise<RequestTimeSlotRecord[]> };
  employee: {
    findMany(args?: unknown): Promise<RequestEmployeeRecord[]>;
    findUnique(args: unknown): Promise<RequestEmployeeRecord | null>;
  };
  plannedWorkingDay: {
    findMany(args?: unknown): Promise<RequestPlannedWorkingDayRecord[]>;
    findUnique(args: unknown): Promise<RequestPlannedWorkingDayRecord | null>;
    upsert(args: unknown): Promise<RequestPlannedWorkingDayRecord>;
    delete(args: unknown): Promise<RequestPlannedWorkingDayRecord>;
  };
  operatingMonth: { findUnique(args: unknown): Promise<RequestOperatingMonthRecord | null> };
  serviceCall: { findMany(args?: unknown): Promise<unknown[]> };
  therapistRequest: {
    create(args: unknown): Promise<RequestRecord>;
    findMany(args?: unknown): Promise<RequestRecord[]>;
    findUnique(args: unknown): Promise<RequestRecord | null>;
    update(args: unknown): Promise<RequestRecord>;
    count(args?: unknown): Promise<number>;
  };
  userAccount: {
    findMany(args: unknown): Promise<Array<{ id: string; accountId: string; employee: { displayName: string } | null }>>;
  };
  auditLog: { create(args: unknown): Promise<unknown> };
  // runInTransaction이 이미 트랜잭션 안인지(이 자리가 없는지)를 보고 새 트랜잭션을 열지 정한다
  // (schedule-service·therapist-notice-service와 같은 모양).
  $transaction?<T>(callback: (tx: TherapistRequestPrismaClient) => Promise<T>): Promise<T>;
};

function getClient(client?: TherapistRequestPrismaClient) {
  return client ?? (prisma as unknown as TherapistRequestPrismaClient);
}

function runInTransaction<T>(client: TherapistRequestPrismaClient, callback: (tx: TherapistRequestPrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }
  return callback(client);
}

function toDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

// 휴무 계열(보통 휴무, 소중한날 휴가)만 "기한 지남"이 있다(M24) — 정정 요청은 애초에 이미 지난
// (또는 오늘의) 출퇴근을 고치는 일이라 날짜가 지나 있는 것이 정상이고, 같은 규칙을 적용하면 거의
// 모든 정정 요청이 대기 상태로 뜨는 즉시 처리할 수 없게 된다(09가 바로잡음).
function isDayOffFamilyKind(kind: string) {
  return kind === "휴무" || kind === "소중한날 휴가";
}

/**
 * "기한 지남"은 저장하지 않고 읽을 때 정한다(M24) — 대기 중인 휴무 계열 신청의 날짜가 지났으면
 * 기한 지남이다. 정정 요청에는 이 규칙이 없다(isDayOffFamilyKind 참고).
 */
function toStatusValue(dbStatus: string, kind: string, targetDateIso: string, todayServiceDate: string): RequestStatusValue {
  if (dbStatus === "대기") {
    return isDayOffFamilyKind(kind) && targetDateIso < todayServiceDate ? "expired" : "pending";
  }
  if (dbStatus === "승인") return "approved";
  if (dbStatus === "거절") return "rejected";
  return "canceled";
}

function requestSnapshot(request: RequestRecord): AuditJsonSnapshot {
  return {
    id: request.id,
    employeeId: request.employeeId,
    kind: request.kind,
    targetDate: toIsoDateOnly(request.targetDate),
    reason: request.reason,
    status: request.status,
    resolutionReason: request.resolutionReason
  };
}

export type TherapistRequestSelfDto = {
  id: string;
  kind: TherapistRequestKind;
  targetDate: string;
  status: RequestStatusValue;
  reason: string | null;
};

export type TherapistRequestAdminListItemDto = {
  id: string;
  kind: TherapistRequestKind;
  employeeId: string;
  displayName: string;
  staffCode: string;
  targetDate: string;
  status: RequestStatusValue;
  /** 정정 요청만 쓴다(09). 휴무 신청은 항상 null이다. */
  requestedCheckInTime: string | null;
  requestedCheckOutTime: string | null;
  reason: string | null;
  resolutionReason: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  /** 대기 중인 휴무 신청에서만 채운다. 그날 그 Therapist에게 배정된 예약 수(가정, 승인을 막지 않는 경고용). */
  assignedCallCount: number | null;
  createdAt: string;
};

const createDayOffSchema = z.object({
  date: isoDateFieldSchema,
  kind: z.enum(["day_off", "special_day_off"]).default("day_off"),
  reason: z.string().trim().max(500).nullish()
});

/**
 * 휴무 신청(스펙 D22, M24). Therapist 본인만 부른다 — employeeId는 언제나
 * requireTherapistAccess()가 돌려준 값이다(M3). 오늘(운영일) 이후의 날짜만, 이미 휴무로 지정된
 * 날과 이미 대기 중인 신청이 있는 날은 거절한다. 신청 마감일·하루 인원 제한은 없다(스펙 D22).
 * 신청 제출 자체는 감사에 남기지 않는다(D28은 승인·거절만 남긴다).
 */
export async function requestTherapistDayOff(input: {
  employeeId: string;
  date: string;
  kind?: string;
  reason?: string | null;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestSelfDto> {
  const parsed = createDayOffSchema.safeParse({ date: input.date, kind: input.kind, reason: input.reason ?? null });
  if (!parsed.success) {
    throw new TherapistRequestDomainError(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.", "INVALID_THERAPIST_REQUEST_INPUT", "date");
  }
  assertValidParsedDate(parsed.data.date);

  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);
  if (parsed.data.date < todayServiceDate) {
    throw new TherapistRequestDomainError("지난 날짜는 신청할 수 없습니다.", "THERAPIST_REQUEST_DATE_IN_PAST", "date");
  }

  const [planned] = await listPlannedWorkingDayStatusesForDate({ employeeIds: [input.employeeId], date: parsed.data.date, prismaClient: client });
  if (planned?.status === "휴무") {
    throw new TherapistRequestDomainError("이미 휴무로 지정된 날입니다.", "THERAPIST_DAY_OFF_ALREADY_SET", "date");
  }

  const pending = await client.therapistRequest.findMany({
    where: { employeeId: input.employeeId, targetDate: toDate(parsed.data.date), status: "대기" }
  });
  if (pending.length > 0) {
    throw new TherapistRequestDomainError("이미 신청 중인 날입니다.", "THERAPIST_DAY_OFF_REQUEST_ALREADY_PENDING", "date");
  }

  const reason = parsed.data.reason?.trim() || null;
  const created = await client.therapistRequest.create({
    data: { employeeId: input.employeeId, kind: toDbKind(parsed.data.kind), targetDate: toDate(parsed.data.date), reason }
  });

  return { id: created.id, kind: parsed.data.kind, targetDate: parsed.data.date, status: "pending", reason: created.reason };
}

const createCorrectionSchema = z.object({
  date: isoDateFieldSchema,
  reason: z.string().trim().min(1, "정정 사유를 입력하세요.").max(500)
});

// upsertTherapistAttendance의 checkInTime/checkOutTime과 같은 HH:mm 형식 검사(그 서비스의
// timeRegex는 비공개라 여기서 다시 둔다. toDate처럼 이 코드베이스에서 흔한 작은 중복이다).
const correctionTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * 정정 요청(스펙 D23, M24). Therapist 본인만 부른다 — employeeId는 언제나
 * requireTherapistAccess()가 돌려준 값이다(M3). 출근·퇴근 둘 중 하나는 적어야 한다(빠뜨린 출근·
 * 퇴근도 포함). 잠긴·마감확정 운영월의 날짜나 같은 날에 대기 중인 정정 요청이 있으면 거절한다
 * (스펙 D23). 신청 제출 자체는 감사에 남기지 않는다(D28은 승인·거절만 남긴다).
 *
 * (가정) 휴무 신청과 달리 미래 날짜 제한은 두지 않는다 — 정정은 이미 지난(또는 오늘의) 출퇴근을
 * 고치는 일이고, 이 요청으로 이어지는 두 진입점(05의 "이미 찍음", 06의 "퇴근 미입력")이 이미
 * 오늘·과거 날짜로만 연결한다.
 */
export async function requestTherapistCorrection(input: {
  employeeId: string;
  date: string;
  requestedCheckInTime?: string | null;
  requestedCheckOutTime?: string | null;
  reason: string;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestSelfDto> {
  const parsed = createCorrectionSchema.safeParse({ date: input.date, reason: input.reason });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field: TherapistRequestErrorField = issue?.path[0] === "reason" ? "reason" : "date";
    throw new TherapistRequestDomainError(issue?.message ?? "입력값을 확인하세요.", "INVALID_THERAPIST_REQUEST_INPUT", field);
  }
  assertValidParsedDate(parsed.data.date);

  const requestedCheckInTime = input.requestedCheckInTime?.trim() || null;
  const requestedCheckOutTime = input.requestedCheckOutTime?.trim() || null;
  if (!requestedCheckInTime && !requestedCheckOutTime) {
    throw new TherapistRequestDomainError("출근 또는 퇴근 시각 중 하나는 적어야 합니다.", "THERAPIST_CORRECTION_TIME_REQUIRED");
  }
  if (requestedCheckInTime && !correctionTimeRegex.test(requestedCheckInTime)) {
    throw new TherapistRequestDomainError("출근 시각은 HH:mm 형식이어야 합니다.", "INVALID_THERAPIST_REQUEST_INPUT");
  }
  if (requestedCheckOutTime && !correctionTimeRegex.test(requestedCheckOutTime)) {
    throw new TherapistRequestDomainError("퇴근 시각은 HH:mm 형식이어야 합니다.", "INVALID_THERAPIST_REQUEST_INPUT");
  }

  const client = getClient(input.prismaClient);
  const monthKey = parsed.data.date.slice(0, 7);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { monthKey } });
  if (operatingMonth && isOperatingMonthPayoutLocked(operatingMonth.status)) {
    throw new TherapistRequestDomainError("마감확정 또는 잠금 운영월의 날짜는 정정을 요청할 수 없습니다.", "OPERATING_MONTH_LOCKED", "date");
  }

  const pending = await client.therapistRequest.findMany({
    where: { employeeId: input.employeeId, targetDate: toDate(parsed.data.date), kind: "정정", status: "대기" }
  });
  if (pending.length > 0) {
    throw new TherapistRequestDomainError("이미 대기 중인 정정 요청이 있습니다.", "THERAPIST_CORRECTION_REQUEST_ALREADY_PENDING", "date");
  }

  const created = await client.therapistRequest.create({
    data: {
      employeeId: input.employeeId,
      kind: "정정",
      targetDate: toDate(parsed.data.date),
      requestedCheckInTime,
      requestedCheckOutTime,
      reason: parsed.data.reason
    }
  });

  return { id: created.id, kind: "correction", targetDate: parsed.data.date, status: "pending", reason: created.reason };
}

/**
 * 신청 취소(스펙 D22, M24). 승인 전에만, 기한이 지나지 않았을 때만 Therapist 본인이 취소할 수
 * 있다. 상태 전환만 하므로 종류와 무관하다 — 09의 정정 요청 취소도 이 함수를 그대로 쓸 수 있다.
 * 취소는 감사에 남기지 않는다(D28은 승인·거절만 남긴다).
 */
export async function cancelTherapistRequest(input: {
  employeeId: string;
  requestId: string;
  actorAccountId: string;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestSelfDto> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);

  const existing = await client.therapistRequest.findUnique({ where: { id: input.requestId } });
  // 남의 신청이든 없는 신청이든 같은 오류로 묶어 어느 쪽인지 알려주지 않는다(M6 보안, markTherapistNoticeRead와 같은 방식).
  if (!existing || existing.employeeId !== input.employeeId) {
    throw new TherapistRequestDomainError("신청을 찾을 수 없습니다.", "THERAPIST_REQUEST_NOT_FOUND");
  }
  const targetDateIso = toIsoDateOnly(existing.targetDate);
  if (existing.status !== "대기" || targetDateIso < todayServiceDate) {
    throw new TherapistRequestDomainError("취소할 수 없는 신청입니다.", "THERAPIST_REQUEST_NOT_CANCELABLE");
  }

  const updated = await client.therapistRequest.update({
    where: { id: input.requestId },
    data: { status: "취소", resolvedByAccountId: input.actorAccountId, resolvedAt: now }
  });

  return { id: updated.id, kind: fromDbKind(updated.kind), targetDate: targetDateIso, status: "canceled", reason: updated.reason };
}

/**
 * 날짜로 대기 중인 휴무 신청을 찾아 취소한다. 근태 달력(06)의 `TherapistAttendanceDayRequestStatus`
 * 자리는 날짜만 알고 신청 id를 담지 않는다(타입을 바꾸지 않는다) — 하루에 대기 중인 휴무 신청은
 * 하나뿐이라는 규칙(requestTherapistDayOff의 중복 검사)에 기대어 날짜로 찾는다.
 */
export async function cancelTherapistDayOffRequestForDate(input: {
  employeeId: string;
  date: string;
  actorAccountId: string;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestSelfDto> {
  const client = getClient(input.prismaClient);
  const pending = await client.therapistRequest.findMany({
    where: { employeeId: input.employeeId, targetDate: toDate(input.date), status: "대기" }
  });
  const target = pending[0];
  if (!target) {
    throw new TherapistRequestDomainError("신청을 찾을 수 없습니다.", "THERAPIST_REQUEST_NOT_FOUND");
  }
  return cancelTherapistRequest({ employeeId: input.employeeId, requestId: target.id, actorAccountId: input.actorAccountId, now: input.now, prismaClient: client });
}

export type TherapistRequestDayStatusDto = {
  targetDate: string;
  kind: TherapistRequestKind;
  status: RequestStatusValue;
  rejectionReason: string | null;
};

// 근태 달력(06)이 요구하는 모양만 둔다. therapist-attendance-calendar-service.ts의 combined 타입이
// 이 두 필드만 더 가지면 되므로, 그 서비스 쪽 메모리 Prisma 테스트 fixture를 크게 넓히지 않는다
// (06의 TherapistClockOutMissingPrismaClient와 같은 이유).
export type TherapistRequestRangeReadClient = {
  timeSlot: { findMany(args?: unknown): Promise<RequestTimeSlotRecord[]> };
  therapistRequest: { findMany(args?: unknown): Promise<RequestRecord[]> };
};

/** 승인된 소중한날 휴가만 읽는다. 다른 신청이 뒤에 생겨도 휴가 표시는 유지된다. */
export async function listApprovedSpecialDayOffs(input: {
  employeeIds: string[];
  startDate: string;
  endDate: string;
  prismaClient?: Pick<TherapistRequestRangeReadClient, "therapistRequest">;
}): Promise<Array<{ employeeId: string; date: string }>> {
  const client = input.prismaClient ?? prisma;
  const rows = await client.therapistRequest.findMany({
    where: {
      employeeId: { in: input.employeeIds },
      kind: "소중한날 휴가",
      status: "승인",
      targetDate: { gte: toDate(input.startDate), lte: toDate(input.endDate) }
    },
    select: { employeeId: true, targetDate: true }
  });
  return rows.map((row) => ({ employeeId: row.employeeId, date: toIsoDateOnly(row.targetDate) }));
}

/**
 * 근태 달력(06)의 `TherapistAttendanceDayRequestStatus` 자리를 채우는 좁은 조회(스펙 M24).
 * 날짜 하나에 신청이 여러 번 있었으면(예: 거절 뒤 다시 신청) 대기 중인 것을 먼저 보이고, 없으면
 * 가장 최근에 만들어진 것을 보인다.
 */
export async function listTherapistRequestsForEmployeeInRange(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  now?: Date;
  prismaClient?: TherapistRequestRangeReadClient;
}): Promise<TherapistRequestDayStatusDto[]> {
  const client = input.prismaClient ?? (prisma as unknown as TherapistRequestRangeReadClient);
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);

  const requests = await client.therapistRequest.findMany({
    where: { employeeId: input.employeeId, targetDate: { gte: toDate(input.startDate), lte: toDate(input.endDate) } }
  });

  const byDate = new Map<string, RequestRecord>();
  for (const request of requests) {
    const dateIso = toIsoDateOnly(request.targetDate);
    const current = byDate.get(dateIso);
    if (!current) {
      byDate.set(dateIso, request);
      continue;
    }
    const currentPending = current.status === "대기";
    const candidatePending = request.status === "대기";
    if (candidatePending && !currentPending) {
      byDate.set(dateIso, request);
    } else if (candidatePending === currentPending && request.createdAt > current.createdAt) {
      byDate.set(dateIso, request);
    }
  }

  return [...byDate.entries()].map(([dateIso, request]) => ({
    targetDate: dateIso,
    kind: fromDbKind(request.kind),
    status: toStatusValue(request.status, request.kind, dateIso, todayServiceDate),
    rejectionReason: request.resolutionReason
  }));
}

/** 승인함 배지(design.md, 스펙 M5)가 쓰는 대기 건수. 기한 지남도 처리되지 않았으므로 대기로 센다. */
export async function countPendingTherapistRequests(options: { prismaClient?: TherapistRequestPrismaClient } = {}): Promise<number> {
  return getClient(options.prismaClient).therapistRequest.count({ where: { status: "대기" } });
}

async function toAdminListItemDto(
  client: TherapistRequestPrismaClient,
  request: RequestRecord,
  todayServiceDate: string,
  resolvedByNames: Map<string, { name: string }>
): Promise<TherapistRequestAdminListItemDto> {
  const targetDate = toIsoDateOnly(request.targetDate);
  const status = toStatusValue(request.status, request.kind, targetDate, todayServiceDate);
  const kind = fromDbKind(request.kind);
  const assignedCallCount =
    kind !== "correction" && status === "pending"
      ? (await listAssignedServiceCallsForEmployeeOnDate({ employeeId: request.employeeId, date: targetDate, prismaClient: client })).length
      : null;

  return {
    id: request.id,
    kind,
    employeeId: request.employeeId,
    displayName: request.employee?.displayName ?? "-",
    staffCode: request.employee?.staffCode ?? "-",
    targetDate,
    status,
    requestedCheckInTime: request.requestedCheckInTime,
    requestedCheckOutTime: request.requestedCheckOutTime,
    reason: request.reason,
    resolutionReason: request.resolutionReason,
    resolvedByName: request.resolvedByAccountId ? resolvedByNames.get(request.resolvedByAccountId)?.name ?? request.resolvedByAccountId : null,
    resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
    assignedCallCount,
    createdAt: request.createdAt.toISOString()
  };
}

const requestWithEmployeeInclude = { employee: { select: { displayName: true, staffCode: true } } } as const;

/**
 * 승인함 목록(M5, D24). 휴무 신청과 정정 요청을 한 표에서 읽어 함께 돌려준다. 대기 중(기한 지남
 * 포함)이 위에 날짜가 가까운 순으로, 처리된 신청은 아래에 최근 처리 순으로 온다(가정, 선례 없음).
 */
export async function listTherapistRequestsForAdmin(options: {
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
} = {}): Promise<TherapistRequestAdminListItemDto[]> {
  const client = getClient(options.prismaClient);
  const now = options.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);

  const requests = await client.therapistRequest.findMany({ include: requestWithEmployeeInclude });
  const resolvedByNames = await listAuditActors(
    requests.map((request) => request.resolvedByAccountId).filter((id): id is string => id !== null),
    { prismaClient: client }
  );

  const rows = await Promise.all(requests.map((request) => toAdminListItemDto(client, request, todayServiceDate, resolvedByNames)));

  return rows.sort((a, b) => {
    const aUnresolved = a.status === "pending" || a.status === "expired";
    const bUnresolved = b.status === "pending" || b.status === "expired";
    if (aUnresolved !== bUnresolved) return aUnresolved ? -1 : 1;
    if (aUnresolved) return a.targetDate.localeCompare(b.targetDate);
    return (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "");
  });
}

// "기한 지남"은 휴무 계열 신청에만 있다(M24, toStatusValue와 같은 이유) — 정정 요청은 지난 날짜를
// 고치는 일이라 날짜가 지나 있어도 승인·거절할 수 있어야 한다.
function assertActionable(request: RequestRecord, todayServiceDate: string) {
  if (request.status !== "대기") {
    throw new TherapistRequestDomainError("이미 처리된 신청입니다.", "THERAPIST_REQUEST_ALREADY_RESOLVED");
  }
  if (isDayOffFamilyKind(request.kind) && toIsoDateOnly(request.targetDate) < todayServiceDate) {
    throw new TherapistRequestDomainError("기한이 지난 신청입니다.", "THERAPIST_REQUEST_EXPIRED");
  }
}

/**
 * 휴무 신청 승인(M5, M24). 신청 상태 바꾸기 + 근무표 서비스로 그날을 휴무로 저장하기 + 감사 기록을
 * 한 트랜잭션에서 한다(스펙 D22). 그날 그 Therapist에게 배정된 예약이 있어도 승인을 막지 않는다
 * (가정 — 승인 화면이 그 수를 보여줄 뿐이다). 정정 요청(kind="정정") 승인은 다른 저장 경로
 * (upsertTherapistAttendance)가 필요해 approveTherapistCorrectionRequest가 따로 맡는다.
 */
export async function approveTherapistDayOffRequest(input: {
  requestId: string;
  actorId: string;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestAdminListItemDto> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);

  const before = await client.therapistRequest.findUnique({ where: { id: input.requestId }, include: requestWithEmployeeInclude });
  if (!before) {
    throw new TherapistRequestDomainError("신청을 찾을 수 없습니다.", "THERAPIST_REQUEST_NOT_FOUND");
  }
  if (before.kind !== "휴무" && before.kind !== "소중한날 휴가") {
    throw new TherapistRequestDomainError("아직 지원하지 않는 신청 종류입니다.", "THERAPIST_REQUEST_KIND_NOT_SUPPORTED");
  }
  assertActionable(before, todayServiceDate);
  const targetDateIso = toIsoDateOnly(before.targetDate);

  const after = await runInTransaction(client, async (tx) => {
    const updated = await tx.therapistRequest.update({
      where: { id: input.requestId },
      data: { status: "승인", resolvedByAccountId: input.actorId, resolvedAt: now },
      include: requestWithEmployeeInclude
    });

    // setPlannedWorkingDay는 runInTransaction이라 이미 트랜잭션 안의 tx를 그대로 받으면 새로 열지
    // 않는다(0절 7번 함정). 자기 감사 기록(planned_working_day.changed)을 따로 남긴다.
    await setPlannedWorkingDay({ employeeId: before.employeeId, date: targetDateIso, status: "휴무", actorId: input.actorId, prismaClient: tx });

    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "therapist_request.approved",
        targetType: "therapist_request",
        targetId: updated.id,
        beforeValue: requestSnapshot(before),
        afterValue: requestSnapshot(updated)
      },
      { prismaClient: tx as any }
    );

    return updated;
  });

  const resolvedByNames = await listAuditActors([input.actorId], { prismaClient: client });
  return toAdminListItemDto(client, after, todayServiceDate, resolvedByNames);
}

/**
 * 정정 요청 승인(M5, M24, ADR 0004). 신청 상태 바꾸기 + 출퇴근 저장("정정 승인") + 감사 기록을 한
 * 트랜잭션에서 한다(스펙 D23, D24). 저장은 upsertTherapistAttendance를 그대로 불러 밤샘·잠긴
 * 운영월 거절·만근 재판정이 그대로 걸리게 한다 — 이 함수가 여는 트랜잭션을 그 서비스가 받아
 * 그대로 쓰도록 그 서비스의 $transaction을 optional로 넓혔다(코드베이스 지도 0절 2번 함정).
 * 승인하는 사람이 시각을 고치는 기능은 없다(스펙) — 요청에 없는 쪽 시각은 기존 출퇴근 기록을
 * 그대로 쓰고, 출근 기록 자체가 없는데 퇴근만 요청했으면 저장할 수 없어 거절 뒤 대리 입력을
 * 안내한다(THERAPIST_CORRECTION_CHECK_IN_REQUIRED, 코드베이스 지도 6절 함정).
 *
 * 날짜별 지급 확인 금액(코스 수당)은 출퇴근을 읽지 않고 계산되므로(therapist-daily-settlement-
 * service.ts에 attendance 참조가 전혀 없다, 07이 이미 코드로 확인함 — merged-07.md) 이 승인은 그
 * 금액을 바꾸지 않는다. ADR 0004의 지급 재확인 규칙은 그 금액이 바뀔 때만 켜지는 계산 상태라
 * 여기서 따로 표시하지 않는다.
 */
export async function approveTherapistCorrectionRequest(input: {
  requestId: string;
  actorId: string;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestAdminListItemDto> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);

  const before = await client.therapistRequest.findUnique({ where: { id: input.requestId }, include: requestWithEmployeeInclude });
  if (!before) {
    throw new TherapistRequestDomainError("신청을 찾을 수 없습니다.", "THERAPIST_REQUEST_NOT_FOUND");
  }
  if (before.kind !== "정정") {
    throw new TherapistRequestDomainError("아직 지원하지 않는 신청 종류입니다.", "THERAPIST_REQUEST_KIND_NOT_SUPPORTED");
  }
  assertActionable(before, todayServiceDate);
  const targetDateIso = toIsoDateOnly(before.targetDate);

  const monthKey = targetDateIso.slice(0, 7);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { monthKey } });
  if (!operatingMonth) {
    throw new TherapistRequestDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const existingRows = await listTherapistAttendanceForEmployeeInRange({
    employeeId: before.employeeId,
    startDate: targetDateIso,
    endDate: targetDateIso,
    prismaClient: client as unknown as Parameters<typeof listTherapistAttendanceForEmployeeInRange>[0]["prismaClient"]
  });
  const existing = existingRows[0] ?? null;

  const checkInTime = before.requestedCheckInTime ?? existing?.checkInTime ?? "";
  if (!checkInTime) {
    throw new TherapistRequestDomainError(
      "출근 기록이 없어 승인할 수 없습니다. 거절한 뒤 출퇴근 화면에서 직접 입력하세요.",
      "THERAPIST_CORRECTION_CHECK_IN_REQUIRED"
    );
  }
  const checkOutTime = before.requestedCheckOutTime ?? existing?.checkOutTime ?? "";

  const after = await runInTransaction(client, async (tx) => {
    const updated = await tx.therapistRequest.update({
      where: { id: input.requestId },
      data: { status: "승인", resolvedByAccountId: input.actorId, resolvedAt: now },
      include: requestWithEmployeeInclude
    });

    // upsertTherapistAttendance는 $transaction이 optional로 넓혀져 있어, 이미 트랜잭션 안인 tx를
    // 받으면 새로 열지 않고 그대로 쓴다(이 함수와 같은 모양의 runInTransaction).
    await upsertTherapistAttendance({
      operatingMonthId: operatingMonth.id,
      attendanceDate: targetDateIso,
      employeeId: before.employeeId,
      checkInTime,
      checkOutTime,
      method: "정정 승인",
      actorId: input.actorId,
      prismaClient: tx as unknown as Parameters<typeof upsertTherapistAttendance>[0]["prismaClient"]
    });

    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "therapist_request.approved",
        targetType: "therapist_request",
        targetId: updated.id,
        beforeValue: requestSnapshot(before),
        afterValue: requestSnapshot(updated)
      },
      { prismaClient: tx as any }
    );

    return updated;
  });

  const resolvedByNames = await listAuditActors([input.actorId], { prismaClient: client });
  return toAdminListItemDto(client, after, todayServiceDate, resolvedByNames);
}

const rejectSchema = z.object({ reason: z.string().trim().min(1, "거절 사유를 입력하세요.") });

/** 신청 거절(M5, M24). 사유가 필수다(스펙 D22·D23). 종류와 무관해 09의 정정 요청 거절도 그대로 쓴다. */
export async function rejectTherapistRequest(input: {
  requestId: string;
  actorId: string;
  reason: string;
  now?: Date;
  prismaClient?: TherapistRequestPrismaClient;
}): Promise<TherapistRequestAdminListItemDto> {
  const parsed = rejectSchema.safeParse({ reason: input.reason });
  if (!parsed.success) {
    throw new TherapistRequestDomainError(parsed.error.issues[0]?.message ?? "거절 사유를 입력하세요.", "THERAPIST_REQUEST_REJECTION_REASON_REQUIRED", "reason");
  }

  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);

  const before = await client.therapistRequest.findUnique({ where: { id: input.requestId }, include: requestWithEmployeeInclude });
  if (!before) {
    throw new TherapistRequestDomainError("신청을 찾을 수 없습니다.", "THERAPIST_REQUEST_NOT_FOUND");
  }
  assertActionable(before, todayServiceDate);

  const after = await runInTransaction(client, async (tx) => {
    const updated = await tx.therapistRequest.update({
      where: { id: input.requestId },
      data: { status: "거절", resolutionReason: parsed.data.reason, resolvedByAccountId: input.actorId, resolvedAt: now },
      include: requestWithEmployeeInclude
    });

    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "therapist_request.rejected",
        targetType: "therapist_request",
        targetId: updated.id,
        beforeValue: requestSnapshot(before),
        afterValue: requestSnapshot(updated)
      },
      { prismaClient: tx as any }
    );

    return updated;
  });

  const resolvedByNames = await listAuditActors([input.actorId], { prismaClient: client });
  return toAdminListItemDto(client, after, todayServiceDate, resolvedByNames);
}
