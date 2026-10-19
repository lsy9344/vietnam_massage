import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TherapistNoticeDomainError,
  countUnreadTherapistNotices,
  listTherapistNoticesForAdmin,
  listTherapistNoticesForEmployee,
  markTherapistNoticeRead,
  sendTherapistNotice,
  withdrawTherapistNotice
} from "@/modules/therapists/therapist-notice-service";

function createMemoryPrisma() {
  const employees = new Map<string, { id: string; displayName: string; staffCode: string; employeeGroup: string; employmentStatus: string }>();
  const accounts = new Map<string, { id: string; role: string; isActive: boolean; employeeId: string | null }>();
  const notices = new Map<string, any>();
  const recipients = new Map<string, any>();
  const auditEvents: any[] = [];
  let noticeSeq = 1;
  let recipientSeq = 1;

  function employee(id: string, staffCode: string, displayName: string, options: { employeeGroup?: string; employmentStatus?: string } = {}) {
    employees.set(id, { id, staffCode, displayName, employeeGroup: options.employeeGroup ?? "THERAPIST", employmentStatus: options.employmentStatus ?? "재직" });
  }

  function account(id: string, employeeId: string | null, options: { role?: string; isActive?: boolean } = {}) {
    accounts.set(id, { id, employeeId, role: options.role ?? "therapist", isActive: options.isActive ?? true });
  }

  function employeeSummary(employeeId: string | null) {
    if (!employeeId) return null;
    const found = employees.get(employeeId);
    return found ? { displayName: found.displayName, staffCode: found.staffCode } : null;
  }

  function joinNotice(notice: any) {
    return {
      ...notice,
      targetEmployee: employeeSummary(notice.targetEmployeeId),
      recipients: [...recipients.values()]
        .filter((recipient) => recipient.noticeId === notice.id)
        .map((recipient) => ({ ...recipient, employee: employeeSummary(recipient.employeeId) }))
    };
  }

  function joinRecipient(recipient: any) {
    return { ...recipient, notice: notices.get(recipient.noticeId) ?? null };
  }

  const client: any = {
    userAccount: {
      async findMany({ where }: any = {}) {
        return [...accounts.values()]
          .filter((acc) => {
            if (where?.role && acc.role !== where.role) return false;
            if (typeof where?.isActive === "boolean" && acc.isActive !== where.isActive) return false;
            if (where?.employee) {
              const emp = acc.employeeId ? employees.get(acc.employeeId) : null;
              if (!emp) return false;
              if (where.employee.employeeGroup && emp.employeeGroup !== where.employee.employeeGroup) return false;
              if (where.employee.employmentStatus?.not && emp.employmentStatus === where.employee.employmentStatus.not) return false;
            }
            return true;
          })
          .map((acc) => ({ employeeId: acc.employeeId, employee: employeeSummary(acc.employeeId) }));
      }
    },
    therapistNotice: {
      async create({ data }: any) {
        const record = { id: `notice-${noticeSeq++}`, withdrawnAt: null, withdrawnByAccountId: null, ...data };
        notices.set(record.id, record);
        return joinNotice(record);
      },
      async findUnique({ where }: any) {
        const record = notices.get(where.id);
        return record ? joinNotice(record) : null;
      },
      async findMany({ orderBy }: any = {}) {
        const all = [...notices.values()].map(joinNotice);
        if (orderBy?.sentAt === "desc") {
          return all.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
        }
        return all;
      },
      async update({ where, data }: any) {
        const record = notices.get(where.id);
        if (!record) throw new Error("missing notice");
        const updated = { ...record, ...data };
        notices.set(where.id, updated);
        return joinNotice(updated);
      }
    },
    therapistNoticeRecipient: {
      async createMany({ data }: any) {
        for (const entry of data) {
          const id = `recipient-${recipientSeq++}`;
          recipients.set(id, { id, noticeId: entry.noticeId, employeeId: entry.employeeId, readAt: null });
        }
        return { count: data.length };
      },
      async findUnique({ where }: any) {
        const composite = where?.noticeId_employeeId;
        if (!composite) return null;
        const found = [...recipients.values()].find((r) => r.noticeId === composite.noticeId && r.employeeId === composite.employeeId);
        return found ? joinRecipient(found) : null;
      },
      async findMany({ where }: any = {}) {
        return [...recipients.values()]
          .filter((r) => {
            if (where?.employeeId && r.employeeId !== where.employeeId) return false;
            if (where?.notice?.withdrawnAt === null) {
              const notice = notices.get(r.noticeId);
              if (!notice || notice.withdrawnAt !== null) return false;
            }
            if (typeof where?.readAt === "object" && where.readAt !== null && "equals" in where.readAt) {
              // not used, kept for shape completeness
            }
            return true;
          })
          .map(joinRecipient);
      },
      async update({ where, data }: any) {
        const record = recipients.get(where.id);
        if (!record) throw new Error("missing recipient");
        const updated = { ...record, ...data };
        recipients.set(where.id, updated);
        return updated;
      },
      async count({ where }: any = {}) {
        return [...recipients.values()].filter((r) => {
          if (where?.employeeId && r.employeeId !== where.employeeId) return false;
          if (where?.readAt === null && r.readAt !== null) return false;
          if (where?.notice?.withdrawnAt === null) {
            const notice = notices.get(r.noticeId);
            if (!notice || notice.withdrawnAt !== null) return false;
          }
          return true;
        }).length;
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt: new Date("2026-06-10T00:00:00.000Z"), ...data };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    employee,
    account,
    employees,
    accounts,
    notices,
    recipients,
    auditEvents
  };

  return client;
}

describe("therapist notice service", () => {
  it("전체 공지는 보낸 시점의 활성 Therapist 계정에게만 받는 사람 줄을 고정한다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.employee("thr-2", "THR-002", "마사지사2");
    prismaClient.employee("thr-3", "THR-003", "마사지사3", { employmentStatus: "퇴사" });
    prismaClient.account("acct-1", "thr-1");
    prismaClient.account("acct-2", "thr-2", { isActive: false });
    prismaClient.account("acct-3", "thr-3");

    const sent = await sendTherapistNotice({
      actorId: "admin-1",
      body: "오늘 저녁 회식 안내",
      targetType: "전체",
      now: new Date("2026-10-20T10:00:00.000Z"),
      prismaClient
    });

    assert.equal(sent.recipientCount, 1);
    assert.equal(sent.recipients[0]?.employeeId, "thr-1");

    // 보낸 뒤 thr-1 계정이 비활성이 되어도 이미 만든 받는 사람 줄은 그대로다.
    prismaClient.account("acct-1", "thr-1", { isActive: false });
    const myNotices = await listTherapistNoticesForEmployee("thr-1", { prismaClient });
    assert.equal(myNotices.length, 1);
  });

  it("특정 Therapist 공지는 그 한 명에게만 가고 다른 Therapist에게는 보이지 않는다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.employee("thr-2", "THR-002", "마사지사2");
    prismaClient.account("acct-1", "thr-1");
    prismaClient.account("acct-2", "thr-2");

    await sendTherapistNotice({
      actorId: "admin-1",
      body: "thr-1에게만",
      targetType: "특정",
      targetEmployeeId: "thr-1",
      prismaClient
    });

    const forTarget = await listTherapistNoticesForEmployee("thr-1", { prismaClient });
    const forOther = await listTherapistNoticesForEmployee("thr-2", { prismaClient });
    assert.equal(forTarget.length, 1);
    assert.equal(forOther.length, 0);
  });

  it("빈 본문과 대상 Therapist 미지정은 거절한다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.account("acct-1", "thr-1");

    await assert.rejects(() => sendTherapistNotice({ actorId: "admin-1", body: "   ", targetType: "전체", prismaClient }), (error: unknown) => {
      assert.ok(error instanceof TherapistNoticeDomainError);
      assert.equal(error.code, "INVALID_NOTICE_INPUT");
      return true;
    });

    await assert.rejects(() => sendTherapistNotice({ actorId: "admin-1", body: "본문", targetType: "특정", prismaClient }), (error: unknown) => {
      assert.ok(error instanceof TherapistNoticeDomainError);
      assert.equal(error.code, "TARGET_EMPLOYEE_REQUIRED");
      return true;
    });

    await assert.rejects(
      () => sendTherapistNotice({ actorId: "admin-1", body: "본문", targetType: "특정", targetEmployeeId: "thr-없음", prismaClient }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistNoticeDomainError);
        assert.equal(error.code, "THERAPIST_ACCOUNT_NOT_FOUND");
        return true;
      }
    );
  });

  it("공지를 열면 읽음으로 기록되고, 다시 열어도 처음 읽은 시각이 그대로다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.account("acct-1", "thr-1");
    await sendTherapistNotice({ actorId: "admin-1", body: "공지 1", targetType: "전체", prismaClient });
    const [{ id: noticeId }] = await listTherapistNoticesForEmployee("thr-1", { prismaClient });

    assert.equal(await countUnreadTherapistNotices("thr-1", { prismaClient }), 1);

    const firstRead = await markTherapistNoticeRead({ employeeId: "thr-1", noticeId, now: new Date("2026-10-20T11:00:00.000Z"), prismaClient });
    assert.equal(firstRead.readAt, "2026-10-20T11:00:00.000Z");
    assert.equal(await countUnreadTherapistNotices("thr-1", { prismaClient }), 0);

    const secondRead = await markTherapistNoticeRead({ employeeId: "thr-1", noticeId, now: new Date("2026-10-20T12:00:00.000Z"), prismaClient });
    assert.equal(secondRead.readAt, "2026-10-20T11:00:00.000Z");
  });

  it("남의 공지나 존재하지 않는 공지를 열면 같은 오류로 묶인다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.employee("thr-2", "THR-002", "마사지사2");
    prismaClient.account("acct-1", "thr-1");
    prismaClient.account("acct-2", "thr-2");
    await sendTherapistNotice({ actorId: "admin-1", body: "thr-1에게만", targetType: "특정", targetEmployeeId: "thr-1", prismaClient });
    const [{ id: noticeId }] = await listTherapistNoticesForEmployee("thr-1", { prismaClient });

    await assert.rejects(
      () => markTherapistNoticeRead({ employeeId: "thr-2", noticeId, prismaClient }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistNoticeDomainError);
        assert.equal(error.code, "NOTICE_NOT_FOUND");
        return true;
      }
    );
    await assert.rejects(
      () => markTherapistNoticeRead({ employeeId: "thr-1", noticeId: "없는-공지", prismaClient }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistNoticeDomainError);
        assert.equal(error.code, "NOTICE_NOT_FOUND");
        return true;
      }
    );
  });

  it("내린 공지는 Therapist에게 보이지 않지만 관리자 목록과 기록에는 내림으로 남는다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.account("acct-1", "thr-1");
    const sent = await sendTherapistNotice({ actorId: "admin-1", body: "곧 내릴 공지", targetType: "전체", prismaClient });

    await withdrawTherapistNotice({ actorId: "admin-1", noticeId: sent.id, now: new Date("2026-10-20T13:00:00.000Z"), prismaClient });

    const myNotices = await listTherapistNoticesForEmployee("thr-1", { prismaClient });
    assert.equal(myNotices.length, 0);

    const adminList = await listTherapistNoticesForAdmin({ prismaClient });
    assert.equal(adminList.length, 1);
    assert.equal(adminList[0]?.withdrawnAt, "2026-10-20T13:00:00.000Z");

    // 열려고 하면 내린 공지도 찾을 수 없다로 묶인다.
    await assert.rejects(() => markTherapistNoticeRead({ employeeId: "thr-1", noticeId: sent.id, prismaClient }));
  });

  it("공지 내리기는 멱등하다 — 다시 내려도 새 기록을 남기지 않는다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.account("acct-1", "thr-1");
    const sent = await sendTherapistNotice({ actorId: "admin-1", body: "공지", targetType: "전체", prismaClient });

    await withdrawTherapistNotice({ actorId: "admin-1", noticeId: sent.id, now: new Date("2026-10-20T13:00:00.000Z"), prismaClient });
    await withdrawTherapistNotice({ actorId: "admin-1", noticeId: sent.id, now: new Date("2026-10-20T14:00:00.000Z"), prismaClient });

    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "therapist_notice.withdrawn").length, 1);
  });

  it("보내기와 내리기가 감사에 남는다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.account("acct-1", "thr-1");
    const sent = await sendTherapistNotice({ actorId: "admin-1", body: "공지", targetType: "전체", prismaClient });
    await withdrawTherapistNotice({ actorId: "admin-1", noticeId: sent.id, prismaClient });

    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "therapist_notice.sent" && event.targetId === sent.id).length, 1);
    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "therapist_notice.withdrawn" && event.targetId === sent.id).length, 1);
  });

  it("관리자 공지마다 대상 인원, 읽은 사람, 읽지 않은 사람 수를 본다", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.employee("thr-1", "THR-001", "마사지사1");
    prismaClient.employee("thr-2", "THR-002", "마사지사2");
    prismaClient.account("acct-1", "thr-1");
    prismaClient.account("acct-2", "thr-2");
    const sent = await sendTherapistNotice({ actorId: "admin-1", body: "전체 공지", targetType: "전체", prismaClient });
    await markTherapistNoticeRead({ employeeId: "thr-1", noticeId: sent.id, prismaClient });

    const adminList = await listTherapistNoticesForAdmin({ prismaClient });
    const detail = adminList.find((notice) => notice.id === sent.id);
    assert.equal(detail?.recipientCount, 2);
    assert.equal(detail?.readCount, 1);
    assert.equal(detail?.unreadCount, 1);
    const readRecipient = detail?.recipients.find((recipient) => recipient.employeeId === "thr-1");
    const unreadRecipient = detail?.recipients.find((recipient) => recipient.employeeId === "thr-2");
    assert.ok(readRecipient?.readAt);
    assert.equal(unreadRecipient?.readAt, null);
    assert.equal(readRecipient?.displayName, "마사지사1");
  });
});
