import { expect, test } from "@playwright/test";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { assertValidAuditAction } from "../../src/modules/audit/audit-event";
import { recordAuditEvent } from "../../src/modules/audit/audit-service";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const users = [
  {
    accountId: "story13_administrator",
    role: "administrator",
    password: "Story13!administrator",
    landing: "/live"
  },
  {
    accountId: "story13_counter",
    role: "counter",
    password: "Story13!counter",
    landing: "/calls"
  },
  {
    accountId: "story13_settlement_manager",
    role: "settlement_manager",
    password: "Story13!settlement_manager",
    landing: "/settlements"
  },
  {
    accountId: "story13_waiter",
    role: "waiter",
    password: "Story13!waiter",
    landing: "/rooms"
  },
  {
    accountId: "story13_read_only_viewer",
    role: "read_only_viewer",
    password: "Story13!read_only_viewer",
    landing: "/rooms"
  }
];

const serviceCallTargetId = "E2E-STORY-1-3-SERVICE-CALL";
const monthlyCloseTargetId = "E2E-STORY-1-3-MONTHLY-CLOSE";

async function login(page: import("@playwright/test").Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedAuthAccount(input: {
  accountId: string;
  email: string;
  displayName: string;
  staffCode: string;
  role: string;
  secret: string;
}) {
  const sortOrder = 7100 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const employeeDefaults = {
    employeeGroup: "OPERATIONS",
    position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
    shiftType: input.role === "counter" || input.role === "waiter" ? "주간" : "전체",
    baseSalary: 0,
    employmentStatus: "재직",
    sortOrder
  };
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      ...employeeDefaults,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
      ...employeeDefaults,
      isActive: true
    }
  });
  const passwordHash = await hash(input.secret, argon2idOptions);

  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: input.email,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: input.email,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

test.describe("Story 1.3 감사 로그 기반과 조회", () => {
  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}-story13@example.local`,
        displayName: user.accountId,
        staffCode: `E2E13-${user.accountId.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }

    await recordAuditEvent({
      actorId: "story13_administrator",
      action: "service_call.status_changed",
      targetType: "service_call",
      targetId: serviceCallTargetId,
      beforeValue: { status: "예약", payoutImpact: false },
      afterValue: { status: "방문완료", payoutImpact: true },
      reason: "Story 1.3 e2e fixture"
    }, {
      prismaClient: prisma as any
    });

    await recordAuditEvent({
      actorId: "story13_administrator",
      action: "monthly_close.confirmed",
      targetType: "monthly_close",
      targetId: monthlyCloseTargetId,
      beforeValue: { status: "preview", operationMonth: "2026-06" },
      afterValue: { status: "confirmed", operationMonth: "2026-06" },
      reason: "Story 1.3 filter fixture"
    }, {
      prismaClient: prisma as any
    });
  });

  test("administrator는 /audit 조회 화면에서 감사 이벤트와 필터를 볼 수 있다", async ({ page }) => {
    await login(page, "story13_administrator", "Story13!administrator");
    await page.goto("/audit?targetType=service_call");

    await expect(page).toHaveURL(/\/audit\?targetType=service_call$/);
    await expect(page.getByRole("heading", { name: "변경 이력 조회", level: 1 })).toBeVisible();
    await expect(page.getByLabel("대상 유형")).toHaveValue("service_call");
    await expect(page.getByText("service_call.status_changed").first()).toBeVisible();
    await expect(page.getByText(serviceCallTargetId).first()).toBeVisible();
    await expect(page.getByText("Story 1.3 e2e fixture").first()).toBeVisible();
    await expect(page.getByText("status: 예약").first()).toBeVisible();
    await expect(page.getByText("status: 방문완료").first()).toBeVisible();
    await expect(page.getByText(monthlyCloseTargetId)).toHaveCount(0);
  });

  test("administrator는 대상 유형 필터와 빈 상태를 조회할 수 있다", async ({ page }) => {
    await login(page, "story13_administrator", "Story13!administrator");
    await page.goto("/audit");

    await page.getByLabel("대상 유형").fill("monthly_close");
    await page.getByRole("button", { name: "조회" }).click();
    await expect(page).toHaveURL(/\/audit\?.*targetType=monthly_close/);
    await expect(page.getByText("monthly_close.confirmed").first()).toBeVisible();
    await expect(page.getByText(monthlyCloseTargetId).first()).toBeVisible();
    await expect(page.getByText(serviceCallTargetId)).toHaveCount(0);

    await page.getByLabel("대상 유형").fill("missing_story13_target");
    await page.getByRole("button", { name: "조회" }).click();
    await expect(page).toHaveURL(/\/audit\?.*targetType=missing_story13_target/);
    await expect(page.getByText("조건에 맞는 감사 로그가 없다.")).toBeVisible();
  });

  test("administrator는 잘못된 날짜 조건에서 빈 화면 대신 한국어 오류를 본다", async ({ page }) => {
    await login(page, "story13_administrator", "Story13!administrator");
    await page.goto("/audit?from=2026-02-31");

    await expect(page.getByText("시작일 날짜가 올바르지 않습니다.")).toBeVisible();
    await expect(page.getByText("조회 결과를 표시할 수 없습니다.")).toBeVisible();

    await page.goto("/audit?from=2026-06-08&to=2026-06-07");
    await expect(page.getByText("종료일은 시작일과 같거나 이후여야 합니다.")).toBeVisible();
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /audit 접근은 차단되고 sidebar 감사 로그도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/audit");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });
      await expect(menu.getByText("감사 로그", { exact: true })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: "감사 로그" })).toHaveCount(0);
    });
  }

  test("감사 action은 dot notation만 허용한다", () => {
    expect(() => assertValidAuditAction("service_call.status_changed")).not.toThrow();
    expect(() => assertValidAuditAction("service_call_status_changed")).toThrow("dot notation");
    expect(() => assertValidAuditAction("ServiceCall.statusChanged")).toThrow("dot notation");
  });

  test("감사 스냅샷은 JSON 값만 허용한다", async () => {
    await expect(
      recordAuditEvent(
        {
          actorId: "story13_administrator",
          action: "service_call.status_changed",
          targetType: "service_call",
          targetId: "invalid-json-snapshot",
          beforeValue: Number.NaN,
          afterValue: null
        },
        { prismaClient: prisma as any }
      )
    ).rejects.toThrow("JSON number");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
