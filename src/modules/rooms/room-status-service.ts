import { prisma } from "@/lib/prisma";
import type { RoomDisplayStatus, RoomStatusAssigneeDto, RoomStatusCourseDto, RoomStatusDto } from "@/modules/rooms/dtos";

const OPERATING_DAY_START_HOUR = 11;
const SERVICE_TIMEZONE_OFFSET_MINUTES = 9 * 60;

export const ACTIVE_ROOM_OCCUPANCY_STATUSES = ["예약", "RESERVED", "사용중", "IN_USE", "USING", "청소중", "CLEANING"] as const;
export const EXCLUDED_ROOM_OCCUPANCY_STATUSES = ["방문완료", "VISIT_COMPLETE", "노쇼", "NO_SHOW", "취소", "CANCELED"] as const;

export const ROOM_STATUS_GUIDANCE_TEXT: Record<RoomDisplayStatus, string> = {
  예약: "예약 고객 입실 준비가 필요합니다.",
  사용중: "서비스가 진행 중입니다.",
  청소중: "정리 후 입실 가능합니다.",
  종료확인: "종료 확인이 필요합니다.",
  빈방: "입실 가능합니다."
};

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
};

type RoomRecord = {
  id: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CoursePolicyRecord = {
  id: string;
  courseId: string;
  name: string;
  durationMinutes: number;
  tvDisplayName: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type CourseRecord = {
  id: string;
  code: string;
  isActive: boolean;
  policies?: CoursePolicyRecord[];
};

type EmployeeRecord = {
  id: string;
  displayName: string;
  staffCode: string;
};

type ServiceCallAssignmentRecord = {
  id: string;
  serviceCallId: string;
  employeeId: string;
  assignmentRole: string;
  isActive?: boolean;
  employee?: EmployeeRecord;
};

type ServiceCallRecord = {
  id: string;
  operatingMonthId: string;
  operatingMonth?: OperatingMonthRecord;
  serviceDate: Date;
  startTime: string;
  roomId: string;
  room?: RoomRecord;
  courseId: string;
  course?: CourseRecord;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  assignments?: ServiceCallAssignmentRecord[];
};

type RoomStatusPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  room: {
    findMany(args?: unknown): Promise<RoomRecord[]>;
  };
  coursePolicy: {
    findMany(args?: unknown): Promise<CoursePolicyRecord[]>;
  };
  serviceCall: {
    findMany(args?: unknown): Promise<ServiceCallRecord[]>;
  };
};

export type ListRoomStatusesInput = {
  operatingMonthId: string;
  serviceDate: string;
  now?: Date;
  prismaClient?: RoomStatusPrismaClient;
};

export class RoomStatusDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RoomStatusDomainError";
  }
}

function getClient(client?: RoomStatusPrismaClient) {
  return client ?? (prisma as unknown as RoomStatusPrismaClient);
}

function toDateOnly(isoDate: string) {
  const { year, month, day } = parseDateParts(isoDate);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function toIsoDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateParts(serviceDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  if (!match) {
    throw new RoomStatusDomainError("서비스 날짜 형식이 올바르지 않습니다.", "INVALID_SERVICE_DATE");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (Number.isNaN(date.getTime()) || toIsoDateOnly(date) !== serviceDate) {
    throw new RoomStatusDomainError("서비스 날짜 형식이 올바르지 않습니다.", "INVALID_SERVICE_DATE");
  }

  return { year, month, day };
}

function parseStartTime(startTime: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) {
    throw new RoomStatusDomainError("시작시간 형식이 올바르지 않습니다.", "INVALID_START_TIME");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new RoomStatusDomainError("시작시간 형식이 올바르지 않습니다.", "INVALID_START_TIME");
  }

  return { hour, minute };
}

function normalizeOperatingDateTime(serviceDate: string, startTime: string) {
  const { year, month, day } = parseDateParts(serviceDate);
  const { hour, minute } = parseStartTime(startTime);
  const nextCalendarDayOffset = hour < OPERATING_DAY_START_HOUR ? 1 : 0;
  const utcMillis =
    Date.UTC(year, month - 1, day + nextCalendarDayOffset, hour, minute, 0, 0) - SERVICE_TIMEZONE_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMillis);
}

function isActiveRoomOccupancyStatus(status: string) {
  return ACTIVE_ROOM_OCCUPANCY_STATUSES.includes(status as (typeof ACTIVE_ROOM_OCCUPANCY_STATUSES)[number]);
}

function toDisplayStatus(status: string): Exclude<RoomDisplayStatus, "종료확인" | "빈방"> {
  if (status === "예약" || status === "RESERVED") return "예약";
  if (status === "청소중" || status === "CLEANING") return "청소중";
  return "사용중";
}

function effectiveForMonth(policy: CoursePolicyRecord, monthKey: string) {
  return policy.isActive && policy.effectiveFromMonth <= monthKey && (policy.effectiveToMonth === null || policy.effectiveToMonth >= monthKey);
}

function firstCurrentPolicy(policies: CoursePolicyRecord[], monthKey: string) {
  return [...policies]
    .filter((policy) => effectiveForMonth(policy, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth) || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0] ?? null;
}

async function findCoursePolicy(tx: RoomStatusPrismaClient, call: ServiceCallRecord, monthKey: string) {
  const includedPolicy = firstCurrentPolicy(call.course?.policies ?? [], monthKey);
  if (includedPolicy) {
    return includedPolicy;
  }

  const policies = await tx.coursePolicy.findMany({ where: { courseId: call.courseId, isActive: true } });
  return firstCurrentPolicy(policies, monthKey);
}

function toCourseDto(call: ServiceCallRecord, policy: CoursePolicyRecord): RoomStatusCourseDto {
  return {
    id: call.course?.id ?? call.courseId,
    code: call.course?.code ?? "",
    name: policy.name,
    tvDisplayName: policy.tvDisplayName,
    durationMinutes: policy.durationMinutes
  };
}

function toAssigneeDto(record: EmployeeRecord): RoomStatusAssigneeDto {
  return {
    id: record.id,
    displayName: record.displayName,
    staffCode: record.staffCode
  };
}

function assignmentByRole(record: ServiceCallRecord, role: "THERAPIST_1" | "THERAPIST_2" | "EARCARE") {
  return (record.assignments ?? []).find((assignment) => assignment.assignmentRole === role && assignment.isActive !== false)?.employee ?? null;
}

function compareLatestActiveCall(a: ServiceCallRecord, b: ServiceCallRecord) {
  const serviceDateComparison = toIsoDateOnly(a.serviceDate).localeCompare(toIsoDateOnly(b.serviceDate));
  if (serviceDateComparison !== 0) return serviceDateComparison;

  const aStart = normalizeOperatingDateTime(toIsoDateOnly(a.serviceDate), a.startTime).getTime();
  const bStart = normalizeOperatingDateTime(toIsoDateOnly(b.serviceDate), b.startTime).getTime();
  if (aStart !== bStart) return aStart - bStart;

  const aUpdated = a.updatedAt?.getTime() ?? 0;
  const bUpdated = b.updatedAt?.getTime() ?? 0;
  if (aUpdated !== bUpdated) return aUpdated - bUpdated;

  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return aCreated - bCreated;

  return a.id.localeCompare(b.id);
}

function latestActiveCallByRoom(calls: ServiceCallRecord[]) {
  const grouped = new Map<string, ServiceCallRecord>();

  for (const call of calls) {
    if (!isActiveRoomOccupancyStatus(call.status)) {
      continue;
    }

    const current = grouped.get(call.roomId);
    if (!current || compareLatestActiveCall(call, current) > 0) {
      grouped.set(call.roomId, call);
    }
  }

  return grouped;
}

function emptyRoomStatus(room: RoomRecord, serviceDate: string, now: Date): RoomStatusDto {
  return {
    roomId: room.id,
    roomDisplayName: room.displayName,
    roomSortOrder: room.sortOrder,
    displayStatus: "빈방",
    sourceCallStatus: null,
    activeCallId: null,
    serviceDate,
    startTime: null,
    expectedEndAt: null,
    remainingMinutes: null,
    course: null,
    therapist1: null,
    therapist2: null,
    earcare: null,
    guidanceText: ROOM_STATUS_GUIDANCE_TEXT["빈방"],
    updatedAt: now.toISOString()
  };
}

async function activeRoomStatus(tx: RoomStatusPrismaClient, input: { room: RoomRecord; call: ServiceCallRecord; monthKey: string; now: Date }) {
  const sourceDisplayStatus = toDisplayStatus(input.call.status);
  const policy = await findCoursePolicy(tx, input.call, input.monthKey);
  const startAt = normalizeOperatingDateTime(toIsoDateOnly(input.call.serviceDate), input.call.startTime);
  const expectedEndAt = policy ? new Date(startAt.getTime() + policy.durationMinutes * 60 * 1000) : null;
  const rawRemainingMinutes = expectedEndAt ? Math.ceil((expectedEndAt.getTime() - input.now.getTime()) / 60000) : null;
  const remainingMinutes = rawRemainingMinutes === null ? null : Math.max(0, rawRemainingMinutes);
  const displayStatus: RoomDisplayStatus =
    sourceDisplayStatus === "사용중" && remainingMinutes !== null && remainingMinutes <= 0 ? "종료확인" : sourceDisplayStatus;
  const therapist1 = assignmentByRole(input.call, "THERAPIST_1");
  const therapist2 = assignmentByRole(input.call, "THERAPIST_2");
  const earcare = assignmentByRole(input.call, "EARCARE");

  return {
    roomId: input.room.id,
    roomDisplayName: input.room.displayName,
    roomSortOrder: input.room.sortOrder,
    displayStatus,
    sourceCallStatus: input.call.status,
    activeCallId: input.call.id,
    serviceDate: toIsoDateOnly(input.call.serviceDate),
    startTime: input.call.startTime,
    expectedEndAt: expectedEndAt?.toISOString() ?? null,
    remainingMinutes: sourceDisplayStatus === "사용중" ? remainingMinutes : null,
    course: policy ? toCourseDto(input.call, policy) : null,
    therapist1: therapist1 ? toAssigneeDto(therapist1) : null,
    therapist2: therapist2 ? toAssigneeDto(therapist2) : null,
    earcare: earcare ? toAssigneeDto(earcare) : null,
    guidanceText: ROOM_STATUS_GUIDANCE_TEXT[displayStatus],
    updatedAt: input.now.toISOString()
  };
}

export async function listRoomStatuses(input: ListRoomStatusesInput): Promise<RoomStatusDto[]> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: input.operatingMonthId } });
  if (!operatingMonth) {
    throw new RoomStatusDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const rooms = await client.room.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const calls = await client.serviceCall.findMany({
    where: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: toDateOnly(input.serviceDate),
      status: { in: [...ACTIVE_ROOM_OCCUPANCY_STATUSES] }
    },
    include: {
      operatingMonth: true,
      room: true,
      course: { include: { policies: true } },
      assignments: { where: { isActive: true }, include: { employee: true } }
    }
  });
  const latestByRoom = latestActiveCallByRoom(calls);

  return Promise.all(
    rooms.map((room) => {
      const activeCall = latestByRoom.get(room.id);
      if (!activeCall) {
        return emptyRoomStatus(room, input.serviceDate, now);
      }

      return activeRoomStatus(client, {
        room,
        call: activeCall,
        monthKey: operatingMonth.monthKey,
        now
      });
    })
  );
}
