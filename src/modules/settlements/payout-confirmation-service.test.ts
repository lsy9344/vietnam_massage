import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmPayoutConfirmation,
  derivePayoutConfirmationStatus,
  listPayoutConfirmations,
  reconfirmPayoutConfirmation,
  releasePayoutConfirmation,
  type PayoutConfirmationEventDto
} from "@/modules/settlements/payout-confirmation-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function event(overrides: Partial<PayoutConfirmationEventDto> = {}): PayoutConfirmationEventDto {
  return {
    id: "event-1",
    eventType: "confirm",
    amount: 700000,
    reason: null,
    occurredAt: "2026-06-10T13:00:00.000Z",
    actorAccountId: "account-admin",
    actor: { accountId: "admin", employeeDisplayName: "관리자", employeeStaffCode: "ADM-001" },
    ...overrides
  };
}

function createConfirmationPrisma(options: { operatingMonthStatus?: string } = {}) {
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.operatingMonthStatus ?? "작성중"
  };
  const events: any[] = [];
  const transactionOptions: unknown[] = [];

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    },
    payoutConfirmationEvent: {
      async findMany({ where }: any = {}) {
        return events
          .filter(
            (record) =>
              record.unitType === where.unitType &&
              record.operatingMonthId === where.operatingMonthId &&
              sameDateValue(record.serviceDate, where.serviceDate) &&
              (where.employeeId?.in ? where.employeeId.in.includes(record.employeeId) : record.employeeId === where.employeeId)
          )
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
      },
      async create({ data }: any) {
        const record = {
          id: `event-${events.length + 1}`,
          createdAt: new Date(`2026-06-10T14:00:0${events.length}.000Z`),
          actorAccount: { accountId: data.actorAccountId === "account-admin" ? "admin" : data.actorAccountId, employee: { displayName: "관리자", staffCode: "ADM-001" } },
          ...data
        };
        events.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>, optionsArg?: unknown) {
      transactionOptions.push(optionsArg);
      return callback(client);
    },
    events,
    operatingMonth_: operatingMonth,
    transactionOptions
  };

  function sameDateValue(a: Date | null, b: Date | null) {
    if (a === null || b === null) return a === b;
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  return client;
}

describe("derivePayoutConfirmationStatus", () => {
  it("사건이 없으면 미확인이다", () => {
    const result = derivePayoutConfirmationStatus([], 500000, "작성중");
    assert.deepEqual(result, { status: "unconfirmed", currentAmount: 500000, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history: [] });
  });

  it("마지막 사건이 해제면 미확인이다", () => {
    const history = [event({ eventType: "release", amount: null })];
    const result = derivePayoutConfirmationStatus(history, 500000, "작성중");
    assert.equal(result.status, "unconfirmed");
    assert.equal(result.lastConfirmedAmount, null);
  });

  it("마지막 사건에 금액이 없으면 확인 금액 미기록이고, 작성중·검토중 운영월에서만 재확인 필요로 센다", () => {
    const history = [event({ amount: null })];

    const drafting = derivePayoutConfirmationStatus(history, 500000, "작성중");
    assert.equal(drafting.status, "confirmed_amount_unrecorded");
    assert.equal(drafting.lastConfirmedAmount, null);
    assert.equal(drafting.difference, null);
    assert.equal(drafting.requiresReconfirmation, true);

    const reviewing = derivePayoutConfirmationStatus(history, 500000, "검토중");
    assert.equal(reviewing.requiresReconfirmation, true);

    const locked = derivePayoutConfirmationStatus(history, 500000, "마감확정");
    assert.equal(locked.status, "confirmed_amount_unrecorded");
    assert.equal(locked.requiresReconfirmation, false);
  });

  it("마지막 확인 금액과 현재 금액이 다르면 지급 재확인 필요와 이전 금액·현재 금액·차이를 반환한다", () => {
    const history = [event({ amount: 700000 })];
    const result = derivePayoutConfirmationStatus(history, 750000, "검토중");
    assert.equal(result.status, "needs_reconfirmation");
    assert.equal(result.lastConfirmedAmount, 700000);
    assert.equal(result.difference, 50000);
    assert.equal(result.requiresReconfirmation, true);
  });

  it("마지막 확인 금액과 현재 금액이 같으면 확인됨이다", () => {
    const history = [event({ amount: 700000 })];
    const result = derivePayoutConfirmationStatus(history, 700000, "검토중");
    assert.equal(result.status, "confirmed");
    assert.equal(result.lastConfirmedAmount, 700000);
    assert.equal(result.difference, 0);
    assert.equal(result.requiresReconfirmation, false);
  });
});

describe("confirmPayoutConfirmation", () => {
  it("확인 당시 금액·처리자·시각을 사건으로 남기고 확인됨을 반환한다", async () => {
    const prismaClient = createConfirmationPrisma();

    const result = await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    assert.equal(result.status, "confirmed");
    assert.equal(result.lastConfirmedAmount, 700000);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].eventType, "confirm");
    assert.equal(result.history[0].amount, 700000);
    assert.equal(result.history[0].actorAccountId, "account-admin");
    assert.ok(result.history[0].occurredAt);
  });

  it("이미 확인된 단위를 다시 확인하면 거절된다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      () =>
        confirmPayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "therapist-1",
          amount: 700000,
          actorId: "account-admin",
          prismaClient
        }),
      /이미 확인된 지급 확인/
    );
  });

  it("마감확정·잠금 운영월에서는 사건을 쓸 수 없다", async () => {
    await assert.rejects(
      () =>
        confirmPayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "therapist-1",
          amount: 700000,
          actorId: "account-admin",
          prismaClient: createConfirmationPrisma({ operatingMonthStatus: "잠금" })
        }),
      /마감확정 또는 잠금 운영월/
    );
  });

  it("운영월 범위 밖 날짜는 거절한다", async () => {
    await assert.rejects(
      () =>
        confirmPayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-07-01",
          employeeId: "therapist-1",
          amount: 700000,
          actorId: "account-admin",
          prismaClient: createConfirmationPrisma()
        }),
      /운영월 범위를 벗어난 날짜입니다/
    );
  });

  it("월 단위(OPS_MONTHLY)는 날짜를 지정할 수 없고, 그 밖의 단위는 날짜가 필요하다", async () => {
    const prismaClient = createConfirmationPrisma();

    await assert.rejects(
      () =>
        confirmPayoutConfirmation({
          unitType: "OPS_MONTHLY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "ops-1",
          amount: 100000,
          actorId: "account-admin",
          prismaClient
        }),
      /날짜를 지정할 수 없습니다/
    );

    await assert.rejects(
      () =>
        confirmPayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: null,
          employeeId: "therapist-1",
          amount: 100000,
          actorId: "account-admin",
          prismaClient
        }),
      /날짜가 필요합니다/
    );
  });

  it("지급 확인 트랜잭션은 Serializable isolation을 사용한다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });
    assert.deepEqual(prismaClient.transactionOptions, [{ isolationLevel: "Serializable" }]);
  });
});

describe("reconfirmPayoutConfirmation", () => {
  it("사유와 함께 재확인하면 현재 금액이 새 기준이 되고 이전 확인 기록은 남는다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    const reconfirmed = await reconfirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 750000,
      actorId: "account-admin",
      reason: "출근 정정으로 금액이 바뀜",
      prismaClient
    });

    assert.equal(reconfirmed.status, "confirmed");
    assert.equal(reconfirmed.lastConfirmedAmount, 750000);
    assert.equal(reconfirmed.history.length, 2);
    assert.equal(reconfirmed.history[0].eventType, "reconfirm");
    assert.equal(reconfirmed.history[0].reason, "출근 정정으로 금액이 바뀜");
    assert.equal(reconfirmed.history[1].eventType, "confirm");

    // 재확인 이후 금액이 또 바뀌면 다시 지급 재확인 필요가 된다.
    const after = derivePayoutConfirmationStatus(reconfirmed.history, 800000, "작성중");
    assert.equal(after.status, "needs_reconfirmation");
    assert.equal(after.lastConfirmedAmount, 750000);
    assert.equal(after.difference, 50000);
  });

  it("확인된 사건이 없으면 재확인을 거절한다", async () => {
    await assert.rejects(
      () =>
        reconfirmPayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "therapist-1",
          amount: 700000,
          actorId: "account-admin",
          reason: "사유",
          prismaClient: createConfirmationPrisma()
        }),
      /확인된 지급 확인이 없어/
    );
  });

  it("사유가 비어 있으면 재확인을 거절한다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      () =>
        reconfirmPayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "therapist-1",
          amount: 750000,
          actorId: "account-admin",
          reason: "   ",
          prismaClient
        }),
      /재확인 사유를 입력하세요/
    );
  });
});

describe("releasePayoutConfirmation", () => {
  it("사유와 함께 해제하면 미확인으로 돌아가고 이전 확인 기록은 남는다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    const released = await releasePayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      currentAmount: 700000,
      actorId: "account-admin",
      reason: "잘못 확인함",
      prismaClient
    });

    assert.equal(released.status, "unconfirmed");
    assert.equal(released.lastConfirmedAmount, null);
    assert.equal(released.history.length, 2);
    assert.equal(released.history[0].eventType, "release");
    assert.equal(released.history[0].reason, "잘못 확인함");
    assert.equal(released.history[0].amount, null);

    // 해제 뒤에는 다시 확인할 수 있다.
    const reconfirmed = await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 650000,
      actorId: "account-admin",
      prismaClient
    });
    assert.equal(reconfirmed.status, "confirmed");
    assert.equal(reconfirmed.history.length, 3);
  });

  it("확인된 사건이 없으면 해제를 거절한다", async () => {
    await assert.rejects(
      () =>
        releasePayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "therapist-1",
          currentAmount: 700000,
          actorId: "account-admin",
          reason: "사유",
          prismaClient: createConfirmationPrisma()
        }),
      /확인된 지급 확인이 없어/
    );
  });

  it("사유 없는 해제는 거절한다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      () =>
        releasePayoutConfirmation({
          unitType: "THERAPIST_DAILY",
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: "therapist-1",
          currentAmount: 700000,
          actorId: "account-admin",
          reason: "",
          prismaClient
        }),
      /해제 사유를 입력하세요/
    );
  });
});

describe("listPayoutConfirmations", () => {
  it("여러 직원의 지급 확인을 한 번에 읽고, 사건이 없는 직원은 미확인으로 돌려준다", async () => {
    const prismaClient = createConfirmationPrisma();
    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "therapist-1",
      amount: 700000,
      actorId: "account-admin",
      prismaClient
    });

    const result = await listPayoutConfirmations({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      operatingMonthStatus: "작성중",
      units: [
        { employeeId: "therapist-1", currentAmount: 700000 },
        { employeeId: "therapist-2", currentAmount: 0 }
      ],
      prismaClient
    });

    assert.equal(result.get("therapist-1")?.status, "confirmed");
    assert.equal(result.get("therapist-2")?.status, "unconfirmed");
  });
});
