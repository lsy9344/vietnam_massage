import { prisma } from "@/lib/prisma";
import { listAuditActors, recordAuditEvent } from "@/modules/audit/audit-service";

export type TherapistMemoDto = {
  id: string;
  employeeId: string;
  body: string;
  /** ISO 문자열(employee-forms.tsx가 쓰는 EmployeeDto.createdAt과 같은 모양). */
  createdAt: string;
  authorAccountId: string;
  authorName: string;
};

type TherapistMemoRecord = {
  id: string;
  employeeId: string;
  body: string;
  createdAt: Date;
  authorAccountId: string;
};

type TherapistMemoPrismaClient = {
  employee: {
    findUnique(args: unknown): Promise<{ employeeGroup: string } | null>;
  };
  therapistInternalMemo: {
    create(args: unknown): Promise<TherapistMemoRecord>;
    findMany(args: unknown): Promise<TherapistMemoRecord[]>;
  };
  userAccount: {
    findMany(args: unknown): Promise<Array<{ id: string; accountId: string; employee: { displayName: string } | null }>>;
  };
  // runInTransaction이 이미 트랜잭션 안인지(이 자리가 없는지)를 보고 새 트랜잭션을 열지 정한다(schedule-service와 같은 모양).
  $transaction?<T>(callback: (tx: TherapistMemoPrismaClient) => Promise<T>): Promise<T>;
};

function getClient(client?: TherapistMemoPrismaClient) {
  return client ?? (prisma as unknown as TherapistMemoPrismaClient);
}

function runInTransaction<T>(client: TherapistMemoPrismaClient, callback: (tx: TherapistMemoPrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }
  return callback(client);
}

export class TherapistMemoDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "TherapistMemoDomainError";
  }
}

/** 메모는 Therapist 구분 직원에게만 쓴다(D27의 "그 Therapist 패널"). 휴직·퇴사 여부는 보지 않는다 —
 * 패널은 비활성 직원도 선택할 수 있고, 지난 일에 대한 메모도 남길 수 있어야 한다. */
async function assertTherapistEmployee(client: TherapistMemoPrismaClient, employeeId: string) {
  const employee = await client.employee.findUnique({ where: { id: employeeId }, select: { employeeGroup: true } });
  if (!employee) {
    throw new TherapistMemoDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
  }
  if (employee.employeeGroup !== "THERAPIST") {
    throw new TherapistMemoDomainError(
      "Therapist(KTV) 구분 직원에게만 내부 메모를 쓸 수 있습니다.",
      "THERAPIST_MEMO_EMPLOYEE_NOT_THERAPIST"
    );
  }
}

/** 작성 계정의 표시 이름을 감사 모듈의 행위자 이름 풀이(listAuditActors)로 그대로 채운다(M1: 재사용). */
async function withAuthorNames(client: TherapistMemoPrismaClient, records: TherapistMemoRecord[]): Promise<TherapistMemoDto[]> {
  const actors = await listAuditActors(records.map((record) => record.authorAccountId), { prismaClient: client });
  return records.map((record) => ({
    id: record.id,
    employeeId: record.employeeId,
    body: record.body,
    createdAt: record.createdAt.toISOString(),
    authorAccountId: record.authorAccountId,
    authorName: actors.get(record.authorAccountId)?.name ?? record.authorAccountId
  }));
}

/**
 * D27/M24: Therapist 내부 메모 추가. 추가만 가능하고(수정·삭제 없음) 대상이 Therapist 구분 직원인지
 * 다시 확인한 뒤, 저장과 감사 기록(D28)을 한 트랜잭션에서 한다. 호출부(서버 액션)가 이미
 * `therapist:manage` 권한을 확인했다고 보고, 이 함수는 권한을 보지 않는다 — actorId는 그 액션이
 * 확인한 계정 id여야 한다.
 */
export async function addTherapistMemo(input: {
  employeeId: string;
  body: string;
  actorId: string;
  prismaClient?: TherapistMemoPrismaClient;
}): Promise<TherapistMemoDto> {
  const client = getClient(input.prismaClient);
  const body = input.body.trim();

  const record = await runInTransaction(client, async (tx) => {
    await assertTherapistEmployee(tx, input.employeeId);
    const created = await tx.therapistInternalMemo.create({
      data: { employeeId: input.employeeId, authorAccountId: input.actorId, body }
    });
    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "therapist_memo.added",
        targetType: "therapist_internal_memo",
        targetId: created.id,
        beforeValue: null,
        afterValue: { employeeId: created.employeeId, body: created.body }
      },
      { prismaClient: tx as any }
    );
    return created;
  });

  const [dto] = await withAuthorNames(client, [record]);
  return dto;
}

/** 한 Therapist의 메모를 최신순으로 돌려준다. 권한 경계는 호출부(페이지 데이터 로드 단계)에 있다. */
export async function listTherapistMemos(
  employeeId: string,
  options: { prismaClient?: TherapistMemoPrismaClient } = {}
): Promise<TherapistMemoDto[]> {
  const client = getClient(options.prismaClient);
  const records = await client.therapistInternalMemo.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" }
  });
  return withAuthorNames(client, records);
}

/**
 * 직원 화면이 직원을 고르는 동안 서버를 다시 부르지 않으므로(클라이언트 상태 선택), 관리자가 볼 수 있는
 * Therapist 전원의 메모를 페이지 데이터 로드 단계에서 한 번에 모아 보낸다. 이 함수를 부르기 전에
 * 호출부가 `therapist:manage`를 이미 확인했어야 한다 — 그래야 관리자가 아닌 역할에는 메모가 서버에서
 * 아예 나가지 않는다.
 */
export async function listTherapistMemosByEmployeeIds(
  employeeIds: string[],
  options: { prismaClient?: TherapistMemoPrismaClient } = {}
): Promise<Record<string, TherapistMemoDto[]>> {
  const client = getClient(options.prismaClient);
  const grouped: Record<string, TherapistMemoDto[]> = {};
  for (const employeeId of employeeIds) {
    grouped[employeeId] = [];
  }
  if (employeeIds.length === 0) {
    return grouped;
  }

  const records = await client.therapistInternalMemo.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: { createdAt: "desc" }
  });
  const dtos = await withAuthorNames(client, records);
  for (const dto of dtos) {
    (grouped[dto.employeeId] ??= []).push(dto);
  }
  return grouped;
}
