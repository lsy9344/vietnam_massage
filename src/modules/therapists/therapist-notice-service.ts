import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";

// "전체" | "특정"(CONTEXT.md 공지 용어: "Therapist 전체 또는 특정 Therapist"). "특정"일 때만
// targetEmployeeId가 있다(DB CHECK chk_therapist_notices_target_employee_consistent).
export const therapistNoticeTargetTypes = ["전체", "특정"] as const;
export type TherapistNoticeTargetType = (typeof therapistNoticeTargetTypes)[number];

export type TherapistNoticeErrorField = "body" | "targetEmployeeId";

export class TherapistNoticeDomainError extends Error {
  constructor(message: string, public readonly code: string, public readonly field?: TherapistNoticeErrorField) {
    super(message);
    this.name = "TherapistNoticeDomainError";
  }
}

type RecipientRecord = {
  id: string;
  noticeId: string;
  employeeId: string;
  readAt: Date | null;
  employee: { displayName: string; staffCode: string } | null;
};

type NoticeRecord = {
  id: string;
  authorAccountId: string;
  body: string;
  targetType: string;
  targetEmployeeId: string | null;
  targetEmployee: { displayName: string; staffCode: string } | null;
  sentAt: Date;
  withdrawnAt: Date | null;
  withdrawnByAccountId: string | null;
  recipients: RecipientRecord[];
};

type ActiveTherapistAccountRecord = {
  employeeId: string | null;
  employee: { displayName: string; staffCode: string } | null;
};

type TherapistNoticePrismaClient = {
  userAccount: {
    findMany(args?: unknown): Promise<ActiveTherapistAccountRecord[]>;
  };
  therapistNotice: {
    create(args: unknown): Promise<NoticeRecord>;
    findMany(args?: unknown): Promise<NoticeRecord[]>;
    findUnique(args: unknown): Promise<NoticeRecord | null>;
    update(args: unknown): Promise<NoticeRecord>;
  };
  therapistNoticeRecipient: {
    createMany(args: unknown): Promise<unknown>;
    findMany(args?: unknown): Promise<RecipientRecord[]>;
    findUnique(args: unknown): Promise<RecipientRecord | null>;
    update(args: unknown): Promise<RecipientRecord>;
    count(args?: unknown): Promise<number>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: TherapistNoticePrismaClient) => Promise<T>): Promise<T>;
};

// 공지 DTO가 필요한 조인(대상 직원 이름, 받는 사람 이름과 읽음 시각). create 뒤 재조회·내리기·목록이
// 모두 같은 모양을 쓴다.
const noticeWithRecipientsInclude = {
  recipients: { include: { employee: { select: { displayName: true, staffCode: true } } } },
  targetEmployee: { select: { displayName: true, staffCode: true } }
} as const;

function getClient(client?: TherapistNoticePrismaClient) {
  return client ?? (prisma as unknown as TherapistNoticePrismaClient);
}

/** 이미 트랜잭션 안(client가 트랜잭션 콜백 인자라 $transaction이 없음)이면 새로 열지 않고 그대로 쓴다. */
function runInTransaction<T>(client: TherapistNoticePrismaClient, callback: (tx: TherapistNoticePrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }
  return callback(client);
}

export type TherapistNoticeListItemDto = {
  id: string;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export type TherapistNoticeRecipientDto = {
  employeeId: string;
  displayName: string;
  staffCode: string;
  readAt: string | null;
};

export type TherapistNoticeAdminListItemDto = {
  id: string;
  body: string;
  targetType: TherapistNoticeTargetType;
  targetEmployeeId: string | null;
  targetEmployeeName: string | null;
  sentAt: string;
  withdrawnAt: string | null;
  recipientCount: number;
  readCount: number;
  unreadCount: number;
};

export type TherapistNoticeAdminDetailDto = TherapistNoticeAdminListItemDto & {
  recipients: TherapistNoticeRecipientDto[];
};

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toRecipientDto(recipient: RecipientRecord): TherapistNoticeRecipientDto {
  return {
    employeeId: recipient.employeeId,
    displayName: recipient.employee?.displayName ?? "-",
    staffCode: recipient.employee?.staffCode ?? "-",
    readAt: toIsoOrNull(recipient.readAt)
  };
}

function toAdminListItemDto(notice: NoticeRecord): TherapistNoticeAdminListItemDto {
  const recipientCount = notice.recipients.length;
  const readCount = notice.recipients.filter((recipient) => recipient.readAt !== null).length;
  return {
    id: notice.id,
    body: notice.body,
    targetType: notice.targetType as TherapistNoticeTargetType,
    targetEmployeeId: notice.targetEmployeeId,
    targetEmployeeName: notice.targetEmployee?.displayName ?? null,
    sentAt: notice.sentAt.toISOString(),
    withdrawnAt: toIsoOrNull(notice.withdrawnAt),
    recipientCount,
    readCount,
    unreadCount: recipientCount - readCount
  };
}

function toAdminDetailDto(notice: NoticeRecord): TherapistNoticeAdminDetailDto {
  return {
    ...toAdminListItemDto(notice),
    recipients: notice.recipients.map(toRecipientDto)
  };
}

function noticeSnapshot(notice: NoticeRecord): AuditJsonSnapshot {
  return {
    id: notice.id,
    targetType: notice.targetType,
    targetEmployeeId: notice.targetEmployeeId,
    sentAt: notice.sentAt.toISOString(),
    withdrawnAt: toIsoOrNull(notice.withdrawnAt),
    recipientCount: notice.recipients.length
  };
}

/**
 * 받는 사람 후보(스펙 D25, M24 13절 10번): 활성 Therapist 계정(role "therapist", isActive)이고
 * 연결된 직원이 Therapist 구분이며 퇴사가 아닌 사람. 전체 공지는 이 전체를, 특정 공지는 이 가운데
 * 한 명만 받는 사람으로 고정한다 — 보낸 뒤 직원 상태가 바뀌어도 이미 만든 받는 사람 줄은 그대로다.
 */
async function listActiveTherapistAccounts(client: TherapistNoticePrismaClient) {
  const accounts = await client.userAccount.findMany({
    where: {
      role: "therapist",
      isActive: true,
      employee: { employeeGroup: "THERAPIST", employmentStatus: { not: "퇴사" } }
    },
    select: { employeeId: true, employee: { select: { displayName: true, staffCode: true } } }
  });
  return accounts.filter((account): account is ActiveTherapistAccountRecord & { employeeId: string } => account.employeeId !== null);
}

export type TherapistNoticeTargetOptionDto = { employeeId: string; displayName: string; staffCode: string };

/** 공지 보내기 화면의 "특정 Therapist" 선택지(관리자 전용). 전체 공지와 같은 대상 후보다. */
export async function listTherapistNoticeTargetOptions(
  options: { prismaClient?: TherapistNoticePrismaClient } = {}
): Promise<TherapistNoticeTargetOptionDto[]> {
  const accounts = await listActiveTherapistAccounts(getClient(options.prismaClient));
  return accounts
    .map((account) => ({ employeeId: account.employeeId, displayName: account.employee?.displayName ?? "-", staffCode: account.employee?.staffCode ?? "-" }))
    .sort((a, b) => a.staffCode.localeCompare(b.staffCode));
}

const sendNoticeSchema = z.object({
  body: z.string().trim().min(1, "공지 본문을 입력하세요."),
  targetType: z.enum(therapistNoticeTargetTypes),
  targetEmployeeId: z.string().trim().min(1).nullish()
});

/**
 * 공지 보내기(M5). 관리자만 부른다(화면·서버 액션이 therapist:manage를 검사). 대상은 전체 또는
 * 특정 Therapist 한 명이고, 받는 사람 줄은 이 시점의 활성 Therapist 계정으로 고정한다(D25).
 */
export async function sendTherapistNotice(input: {
  actorId: string;
  body: string;
  targetType: TherapistNoticeTargetType;
  targetEmployeeId?: string | null;
  now?: Date;
  prismaClient?: TherapistNoticePrismaClient;
}): Promise<TherapistNoticeAdminDetailDto> {
  const parsed = sendNoticeSchema.safeParse({
    body: input.body,
    targetType: input.targetType,
    targetEmployeeId: input.targetEmployeeId ?? null
  });
  if (!parsed.success) {
    throw new TherapistNoticeDomainError(parsed.error.issues[0]?.message ?? "공지 입력값이 올바르지 않습니다.", "INVALID_NOTICE_INPUT", "body");
  }
  if (parsed.data.targetType === "특정" && !parsed.data.targetEmployeeId) {
    throw new TherapistNoticeDomainError("대상 Therapist를 선택하세요.", "TARGET_EMPLOYEE_REQUIRED", "targetEmployeeId");
  }

  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();
  const activeAccounts = await listActiveTherapistAccounts(client);

  const recipientEmployeeIds =
    parsed.data.targetType === "전체"
      ? activeAccounts.map((account) => account.employeeId)
      : activeAccounts.filter((account) => account.employeeId === parsed.data.targetEmployeeId).map((account) => account.employeeId);

  if (parsed.data.targetType === "특정" && recipientEmployeeIds.length === 0) {
    throw new TherapistNoticeDomainError("대상 Therapist 계정을 찾을 수 없습니다.", "THERAPIST_ACCOUNT_NOT_FOUND", "targetEmployeeId");
  }

  return runInTransaction(client, async (tx) => {
    const notice = await tx.therapistNotice.create({
      data: {
        authorAccountId: input.actorId,
        body: parsed.data.body,
        targetType: parsed.data.targetType,
        targetEmployeeId: parsed.data.targetType === "특정" ? parsed.data.targetEmployeeId : null,
        sentAt: now
      }
    });

    if (recipientEmployeeIds.length > 0) {
      await tx.therapistNoticeRecipient.createMany({
        data: recipientEmployeeIds.map((employeeId) => ({ noticeId: notice.id, employeeId }))
      });
    }

    const sent = await tx.therapistNotice.findUnique({ where: { id: notice.id }, include: noticeWithRecipientsInclude });
    if (!sent) {
      throw new TherapistNoticeDomainError("공지를 저장하지 못했습니다.", "NOTICE_NOT_FOUND");
    }

    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "therapist_notice.sent",
        targetType: "therapist_notice",
        targetId: sent.id,
        afterValue: noticeSnapshot(sent)
      },
      { prismaClient: tx as any }
    );

    return toAdminDetailDto(sent);
  });
}

/**
 * 공지 내리기(M5, D25). 보낸 공지는 고칠 수 없고 내리기만 한다. 이미 내린 공지는 멱등하게
 * 그대로 돌려준다(새 감사 기록을 만들지 않는다, deactivateUserAccount와 같은 모양).
 */
export async function withdrawTherapistNotice(input: {
  actorId: string;
  noticeId: string;
  now?: Date;
  prismaClient?: TherapistNoticePrismaClient;
}): Promise<TherapistNoticeAdminDetailDto> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();

  return runInTransaction(client, async (tx) => {
    const before = await tx.therapistNotice.findUnique({ where: { id: input.noticeId }, include: noticeWithRecipientsInclude });
    if (!before) {
      throw new TherapistNoticeDomainError("공지를 찾을 수 없습니다.", "NOTICE_NOT_FOUND");
    }
    if (before.withdrawnAt !== null) {
      return toAdminDetailDto(before);
    }

    const after = await tx.therapistNotice.update({
      where: { id: input.noticeId },
      data: { withdrawnAt: now, withdrawnByAccountId: input.actorId },
      include: noticeWithRecipientsInclude
    });

    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "therapist_notice.withdrawn",
        targetType: "therapist_notice",
        targetId: after.id,
        beforeValue: noticeSnapshot(before),
        afterValue: noticeSnapshot(after)
      },
      { prismaClient: tx as any }
    );

    return toAdminDetailDto(after);
  });
}

/**
 * 관리자 공지 목록(M5): 최신순, 공지마다 대상 인원·읽은 사람·읽지 않은 사람과 각 사람의 이름을 함께
 * 돌려준다(공지별 읽음 현황) — 목록 규모가 작아(Therapist 수십 명) 펼침마다 다시 불러오지 않는다.
 */
export async function listTherapistNoticesForAdmin(options: { prismaClient?: TherapistNoticePrismaClient } = {}): Promise<TherapistNoticeAdminDetailDto[]> {
  const notices = await getClient(options.prismaClient).therapistNotice.findMany({
    include: noticeWithRecipientsInclude,
    orderBy: { sentAt: "desc" }
  });
  return notices.map(toAdminDetailDto);
}

/**
 * 내게 온 공지 목록(M4): 내린 공지는 빼고 최신순이다(D25 — 내린 공지는 Therapist에게 보이지 않는다).
 * employeeId는 언제나 requireTherapistAccess()가 돌려준 값이다(M3).
 */
export async function listTherapistNoticesForEmployee(
  employeeId: string,
  options: { prismaClient?: TherapistNoticePrismaClient } = {}
): Promise<TherapistNoticeListItemDto[]> {
  const recipients = (await getClient(options.prismaClient).therapistNoticeRecipient.findMany({
    where: { employeeId, notice: { withdrawnAt: null } },
    include: { notice: true }
  })) as unknown as Array<RecipientRecord & { notice: NoticeRecord }>;

  return recipients
    .slice()
    .sort((a, b) => b.notice.sentAt.getTime() - a.notice.sentAt.getTime())
    .map((recipient) => ({
      id: recipient.notice.id,
      body: recipient.notice.body,
      sentAt: recipient.notice.sentAt.toISOString(),
      readAt: toIsoOrNull(recipient.readAt)
    }));
}

/** 공지 탭 숫자 자리(01이 둔 TherapistTabBar의 noticeUnreadCount)가 쓰는 읽지 않은 수. */
export async function countUnreadTherapistNotices(
  employeeId: string,
  options: { prismaClient?: TherapistNoticePrismaClient } = {}
): Promise<number> {
  return getClient(options.prismaClient).therapistNoticeRecipient.count({
    where: { employeeId, readAt: null, notice: { withdrawnAt: null } }
  });
}

/**
 * 공지 열기(M4): 읽음으로 기록한다(D25, 107). 이미 읽었으면 그대로 두어(멱등) 첫 읽은 시각을 지키고,
 * 내린 공지나 남의 공지는 "공지를 찾을 수 없습니다"로 같이 묶어 어느 쪽인지 구분해 알려주지 않는다(M6 보안).
 */
export async function markTherapistNoticeRead(input: {
  employeeId: string;
  noticeId: string;
  now?: Date;
  prismaClient?: TherapistNoticePrismaClient;
}): Promise<TherapistNoticeListItemDto> {
  const client = getClient(input.prismaClient);
  const recipient = await client.therapistNoticeRecipient.findUnique({
    where: { noticeId_employeeId: { noticeId: input.noticeId, employeeId: input.employeeId } },
    include: { notice: true }
  });
  const notice = (recipient as unknown as (RecipientRecord & { notice: NoticeRecord }) | null)?.notice ?? null;
  if (!recipient || !notice || notice.withdrawnAt !== null) {
    throw new TherapistNoticeDomainError("공지를 찾을 수 없습니다.", "NOTICE_NOT_FOUND");
  }

  const updated = recipient.readAt === null ? await client.therapistNoticeRecipient.update({ where: { id: recipient.id }, data: { readAt: input.now ?? new Date() } }) : recipient;

  return {
    id: notice.id,
    body: notice.body,
    sentAt: notice.sentAt.toISOString(),
    readAt: toIsoOrNull(updated.readAt)
  };
}
