import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addTherapistMemoSchema } from "@/modules/therapists/therapist-memo-schema";
import * as therapistMemoService from "@/modules/therapists/therapist-memo-service";
import {
  TherapistMemoDomainError,
  addTherapistMemo,
  listTherapistMemos,
  listTherapistMemosByEmployeeIds
} from "@/modules/therapists/therapist-memo-service";

function createMemoryPrisma() {
  const employees = new Map([
    ["emp-therapist-1", { employeeGroup: "THERAPIST" }],
    ["emp-therapist-2", { employeeGroup: "THERAPIST" }],
    ["emp-ops-1", { employeeGroup: "OPERATIONS" }]
  ]);
  const accounts = new Map([
    ["acct-admin-1", { id: "acct-admin-1", accountId: "administrator", employee: { displayName: "대표" } }],
    ["acct-admin-2", { id: "acct-admin-2", accountId: "admin2", employee: null }]
  ]);
  const memos: any[] = [];
  const auditEvents: any[] = [];
  let sequence = 0;

  const client: any = {
    employee: {
      async findUnique({ where }: any) {
        const employee = employees.get(where.id);
        return employee ? { employeeGroup: employee.employeeGroup } : null;
      }
    },
    therapistInternalMemo: {
      async create({ data }: any) {
        sequence += 1;
        const record = {
          id: `memo-${sequence}`,
          employeeId: data.employeeId,
          authorAccountId: data.authorAccountId,
          body: data.body,
          createdAt: new Date(Date.UTC(2026, 9, 20, 0, sequence, 0))
        };
        memos.push(record);
        return record;
      },
      async findMany({ where, orderBy }: any) {
        const ids = where.employeeId?.in ?? (where.employeeId ? [where.employeeId] : null);
        const matches = memos.filter((memo) => (ids ? ids.includes(memo.employeeId) : true));
        if (orderBy?.createdAt === "desc") {
          matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return matches;
      }
    },
    userAccount: {
      async findMany({ where }: any) {
        const ids: string[] = where.OR.flatMap((clause: any) => clause.id?.in ?? clause.accountId?.in ?? []);
        return [...accounts.values()].filter((account) => ids.includes(account.id) || ids.includes(account.accountId));
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt: new Date(), ...data };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    memos,
    auditEvents
  };

  return client;
}

describe("therapist-memo-service (티켓 12, 스펙 D27)", () => {
  it("Therapist 직원에게 메모를 추가하면 작성 계정의 표시 이름과 함께 돌아온다", async () => {
    const prismaClient = createMemoryPrisma();

    const memo = await addTherapistMemo({
      employeeId: "emp-therapist-1",
      body: "  지각이 잦다. 다음 달 지켜볼 것  ",
      actorId: "acct-admin-1",
      prismaClient
    });

    assert.equal(memo.employeeId, "emp-therapist-1");
    assert.equal(memo.body, "지각이 잦다. 다음 달 지켜볼 것");
    assert.equal(memo.authorAccountId, "acct-admin-1");
    assert.equal(memo.authorName, "대표");
    assert.equal(typeof memo.createdAt, "string");
  });

  it("연결된 직원이 없는 작성 계정은 accountId를 이름으로 대신한다", async () => {
    const prismaClient = createMemoryPrisma();

    const memo = await addTherapistMemo({ employeeId: "emp-therapist-1", body: "메모", actorId: "acct-admin-2", prismaClient });

    assert.equal(memo.authorName, "admin2");
  });

  it("Therapist 구분이 아닌 직원에게는 메모를 추가할 수 없다", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      addTherapistMemo({ employeeId: "emp-ops-1", body: "메모", actorId: "acct-admin-1", prismaClient }),
      (error: unknown) => error instanceof TherapistMemoDomainError && error.code === "THERAPIST_MEMO_EMPLOYEE_NOT_THERAPIST"
    );
    assert.equal(prismaClient.memos.length, 0);
  });

  it("존재하지 않는 직원에게는 메모를 추가할 수 없다", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      addTherapistMemo({ employeeId: "emp-missing", body: "메모", actorId: "acct-admin-1", prismaClient }),
      (error: unknown) => error instanceof TherapistMemoDomainError && error.code === "EMPLOYEE_NOT_FOUND"
    );
  });

  it("추가가 therapist_memo.added 감사 기록으로 남는다(D28)", async () => {
    const prismaClient = createMemoryPrisma();

    const memo = await addTherapistMemo({ employeeId: "emp-therapist-1", body: "메모", actorId: "acct-admin-1", prismaClient });

    assert.equal(prismaClient.auditEvents.length, 1);
    const event = prismaClient.auditEvents[0];
    assert.equal(event.action, "therapist_memo.added");
    assert.equal(event.targetType, "therapist_internal_memo");
    assert.equal(event.targetId, memo.id);
    assert.equal(event.actorId, "acct-admin-1");
    assert.deepEqual(event.afterValue, { employeeId: "emp-therapist-1", body: "메모" });
  });

  it("목록은 최신 메모가 먼저 온다", async () => {
    const prismaClient = createMemoryPrisma();
    const first = await addTherapistMemo({ employeeId: "emp-therapist-1", body: "첫 메모", actorId: "acct-admin-1", prismaClient });
    const second = await addTherapistMemo({ employeeId: "emp-therapist-1", body: "둘째 메모", actorId: "acct-admin-1", prismaClient });

    const memos = await listTherapistMemos("emp-therapist-1", { prismaClient });

    assert.deepEqual(memos.map((memo) => memo.id), [second.id, first.id]);
  });

  it("추가만 가능하다: 메모를 고치거나 지우는 함수가 없다", () => {
    assert.equal("updateTherapistMemo" in therapistMemoService, false);
    assert.equal("deleteTherapistMemo" in therapistMemoService, false);
  });

  it("직원 id별로 메모를 한 번에 모아 돌려준다. 메모가 없는 직원도 빈 배열로 키가 있다", async () => {
    const prismaClient = createMemoryPrisma();
    await addTherapistMemo({ employeeId: "emp-therapist-1", body: "메모 A", actorId: "acct-admin-1", prismaClient });

    const grouped = await listTherapistMemosByEmployeeIds(["emp-therapist-1", "emp-therapist-2"], { prismaClient });

    assert.equal(grouped["emp-therapist-1"].length, 1);
    assert.deepEqual(grouped["emp-therapist-2"], []);
  });

  it("직원 id 목록이 비어 있으면 DB를 조회하지 않고 빈 결과를 돌려준다", async () => {
    const prismaClient = createMemoryPrisma();

    const grouped = await listTherapistMemosByEmployeeIds([], { prismaClient });

    assert.deepEqual(grouped, {});
  });

  it("빈 본문은 스키마가 거절한다", () => {
    const result = addTherapistMemoSchema.safeParse({ employeeId: "emp-therapist-1", body: "   " });
    assert.equal(result.success, false);
  });

  it("2000자를 넘는 본문은 스키마가 거절한다", () => {
    const result = addTherapistMemoSchema.safeParse({ employeeId: "emp-therapist-1", body: "a".repeat(2001) });
    assert.equal(result.success, false);
  });
});
