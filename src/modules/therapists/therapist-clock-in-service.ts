import { prisma } from "@/lib/prisma";
import { businessClockString, businessTodayServiceDate } from "@/lib/operating-date";
import { LOGIN_LOCKOUT_MINUTES, LOGIN_LOCKOUT_THRESHOLD } from "@/modules/masters/account-service";
import { verifyTherapistClockInCode } from "@/modules/therapists/therapist-clock-code-service";
import { upsertTherapistAttendance, type TherapistAttendanceDto } from "@/modules/settlements/therapist-attendance-service";

/**
 * 출근 코드로 직접 찍기(스펙 D13–D15, M4, M23). Therapist "오늘" 탭의 출근·퇴근 버튼이 이 함수
 * 하나를 부른다. 저장 자체는 04가 넓힌 출퇴근 서비스(upsertTherapistAttendance, method "직접")가
 * 하고, 이 서비스는 그 앞에서 (1) 코드 잠금·검증과 (2) "이미 찍음" 판정만 더한다(M1: 조립).
 */

export type TherapistClockInAction = "check_in" | "check_out";

const errorCodes = [
  "CLOCK_CODE_INVALID",
  "CLOCK_CODE_LOCKED",
  "ALREADY_CLOCKED_IN",
  "ALREADY_CLOCKED_OUT",
  "CHECK_IN_REQUIRED_BEFORE_CHECK_OUT",
  "OPERATING_MONTH_NOT_FOUND"
] as const;
export type TherapistClockInErrorCode = (typeof errorCodes)[number];

export class TherapistClockInDomainError extends Error {
  constructor(
    message: string,
    public readonly code: TherapistClockInErrorCode,
    /** CLOCK_CODE_INVALID는 remainingAttempts, CLOCK_CODE_LOCKED는 lockedUntil(ISO)을 들고 있다. */
    public readonly details?: { remainingAttempts?: number; lockedUntil?: string }
  ) {
    super(message);
    this.name = "TherapistClockInDomainError";
  }
}

type ClockInAccountRecord = { clockInCodeFailedCount: number; clockInCodeLockedUntil: Date | null };
type ClockInAttendanceRecord = { isActive: boolean; checkInMinute: number; checkOutMinute: number | null };
type ClockInOperatingMonthRecord = { id: string; monthKey: string };

export type TherapistClockInPrismaClient = {
  userAccount: {
    findUnique(args: unknown): Promise<ClockInAccountRecord | null>;
    update(args: unknown): Promise<unknown>;
  };
  timeSlot: {
    findMany(args?: unknown): Promise<Array<{ value: string }>>;
  };
  operatingMonth: {
    findUnique(args: unknown): Promise<ClockInOperatingMonthRecord | null>;
  };
  therapistAttendance: {
    findUnique(args: unknown): Promise<ClockInAttendanceRecord | null>;
  };
};

function getClient(client?: TherapistClockInPrismaClient) {
  return client ?? (prisma as unknown as TherapistClockInPrismaClient);
}

function toDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function minuteToTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function isLocked(account: { clockInCodeLockedUntil: Date | null }, now: Date) {
  return account.clockInCodeLockedUntil !== null && account.clockInCodeLockedUntil > now;
}

/**
 * 출근 코드로 찍기(M4). employeeId·accountId는 언제나 requireTherapistAccess()에서 온 값이다(M3) —
 * 이 함수는 요청에서 직원 id를 받지 않는다. 저장된 출퇴근을 돌려주거나, 코드 틀림(남은 횟수), 잠김
 * (풀리는 시각), 이미 찍음, 잠긴 운영월(TherapistAttendanceDomainError가 그대로 샌다) 같은 도메인
 * 오류를 낸다.
 */
export async function clockInWithCode(input: {
  employeeId: string;
  accountId: string;
  action: TherapistClockInAction;
  code: string;
  now?: Date;
  secret?: string;
  prismaClient?: TherapistClockInPrismaClient;
}): Promise<TherapistAttendanceDto> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();

  const slots = await client.timeSlot.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const attendanceDate = businessTodayServiceDate(slots, now);
  const monthKey = attendanceDate.slice(0, 7);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { monthKey } });
  if (!operatingMonth) {
    throw new TherapistClockInDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const existing = await client.therapistAttendance.findUnique({
    where: {
      operatingMonthId_attendanceDate_employeeId: {
        operatingMonthId: operatingMonth.id,
        attendanceDate: toDate(attendanceDate),
        employeeId: input.employeeId
      }
    }
  });
  const activeExisting = existing?.isActive ? existing : null;

  // 이미 찍음(D15): 버튼은 이 상태에서 "정정 요청" 안내로 바뀌어 눌리지 않아야 하지만, 겹친 요청
  // 같은 경우를 대비해 서버도 막는다. 코드를 검증하기 전에 먼저 본다 — 애초에 할 수 없는 동작에
  // 코드 실패 횟수를 쓰게 하지 않는다.
  if (input.action === "check_in" && activeExisting) {
    throw new TherapistClockInDomainError("이미 출근을 찍었습니다.", "ALREADY_CLOCKED_IN");
  }
  if (input.action === "check_out") {
    if (!activeExisting) {
      throw new TherapistClockInDomainError("출근을 먼저 찍어야 퇴근을 찍을 수 있습니다.", "CHECK_IN_REQUIRED_BEFORE_CHECK_OUT");
    }
    if (activeExisting.checkOutMinute !== null) {
      throw new TherapistClockInDomainError("이미 퇴근을 찍었습니다.", "ALREADY_CLOCKED_OUT");
    }
  }

  const account = await client.userAccount.findUnique({ where: { id: input.accountId } });
  if (!account) {
    throw new Error("세션 계정을 찾을 수 없습니다.");
  }
  if (isLocked(account, now)) {
    throw new TherapistClockInDomainError("출근 코드가 잠겨 있습니다.", "CLOCK_CODE_LOCKED", {
      lockedUntil: account.clockInCodeLockedUntil!.toISOString()
    });
  }

  const valid = await verifyTherapistClockInCode({ now, submittedCode: input.code, secret: input.secret });
  if (!valid) {
    const failedCount = account.clockInCodeFailedCount + 1;
    const lockedUntil = failedCount >= LOGIN_LOCKOUT_THRESHOLD ? new Date(now.getTime() + LOGIN_LOCKOUT_MINUTES * 60 * 1000) : null;
    await client.userAccount.update({
      where: { id: input.accountId },
      data: { clockInCodeFailedCount: failedCount, clockInCodeLockedUntil: lockedUntil }
    });
    if (lockedUntil) {
      throw new TherapistClockInDomainError("출근 코드가 잠겼습니다.", "CLOCK_CODE_LOCKED", { lockedUntil: lockedUntil.toISOString() });
    }
    throw new TherapistClockInDomainError("출근 코드가 올바르지 않습니다.", "CLOCK_CODE_INVALID", {
      remainingAttempts: LOGIN_LOCKOUT_THRESHOLD - failedCount
    });
  }

  await client.userAccount.update({
    where: { id: input.accountId },
    data: { clockInCodeFailedCount: 0, clockInCodeLockedUntil: null }
  });

  const nowClock = businessClockString(now);
  const checkInTime = input.action === "check_in" ? nowClock : minuteToTime(activeExisting!.checkInMinute);
  const checkOutTime = input.action === "check_out" ? nowClock : "";

  return upsertTherapistAttendance({
    operatingMonthId: operatingMonth.id,
    attendanceDate,
    employeeId: input.employeeId,
    checkInTime,
    checkOutTime,
    method: "직접",
    actorId: input.accountId,
    prismaClient: input.prismaClient as unknown as Parameters<typeof upsertTherapistAttendance>[0]["prismaClient"]
  });
}
