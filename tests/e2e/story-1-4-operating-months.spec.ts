import { expect, test } from "@playwright/test";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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
    accountId: "story14_administrator",
    role: "administrator",
    password: "Story14!administrator",
    landing: "/live"
  },
  {
    accountId: "story14_counter",
    role: "counter",
    password: "Story14!counter",
    landing: "/calls"
  },
  {
    accountId: "story14_settlement_manager",
    role: "settlement_manager",
    password: "Story14!settlement_manager",
    landing: "/settlements"
  },
  {
    accountId: "story14_waiter",
    role: "waiter",
    password: "Story14!waiter",
    landing: "/rooms"
  },
  {
    accountId: "story14_read_only_viewer",
    role: "read_only_viewer",
    password: "Story14!read_only_viewer",
    landing: "/rooms"
  }
];

const story14MonthKeys = ["2031-04", "2031-05"];

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
  const sortOrder = 7200 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
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

test.describe("Story 1.4 운영월 관리", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}-story14@example.local`,
        displayName: user.accountId,
        staffCode: `E2E14-${user.accountId.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }

    await (prisma as any).auditLog.deleteMany({
      where: {
        targetType: "operating_month",
        action: { in: ["operating_month.created", "operating_month.status_changed"] }
      }
    });
    await (prisma as any).operatingMonth.deleteMany({
      where: { monthKey: { in: story14MonthKeys } }
    });
    await (prisma as any).operatingMonth.create({
      data: {
        monthKey: "2031-05",
        startDate: new Date("2031-05-01T00:00:00.000Z"),
        endDate: new Date("2031-05-31T00:00:00.000Z"),
        status: "작성중"
      }
    });
  });

  test("administrator는 운영월을 생성하고 중복 오류와 상태 변경 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story14_administrator", "Story14!administrator");
    await page.goto("/masters/operating-months");

    await expect(page.getByRole("heading", { name: "운영월 관리", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "운영월" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "생성 시각" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "수정 시각" })).toBeVisible();
    await expect(page.getByRole("row", { name: /2031-05/ }).getByText("선택 기준")).toBeVisible();

    const monthInput = page.getByLabel("새 운영월");
    await monthInput.fill("2031-13");
    await expect.poll(() => monthInput.evaluate((input) => (input as HTMLInputElement).validity.valid)).toBe(false);
    await monthInput.fill("2031-04");

    await page.getByRole("button", { name: "운영월 생성" }).click();
    await expect(page.getByText("2031-04").first()).toBeVisible();
    await expect(page.getByText("2031-04-01").first()).toBeVisible();
    await expect(page.getByText("2031-04-30").first()).toBeVisible();
    await expect(page.getByText("작성중").first()).toBeVisible();

    await page.getByLabel("새 운영월").fill("2031-04");
    await page.getByRole("button", { name: "운영월 생성" }).click();
    await expect(page.getByText("이미 존재하는 운영월입니다.")).toBeVisible();

    await page.getByRole("row", { name: /2031-04/ }).getByRole("button", { name: "검토중으로 변경" }).click();
    await expect(page.getByRole("row", { name: /2031-04/ }).getByText("검토중")).toBeVisible();

    await page.goto("/audit?targetType=operating_month");
    await expect(page.getByRole("row", { name: /operating_month\.created/ }).filter({ hasText: "2031-04" })).toBeVisible();
    const statusChangedAuditRow = page.getByRole("row", { name: /operating_month\.status_changed/ }).filter({ hasText: "2031-04" });
    await expect(statusChangedAuditRow).toBeVisible();
    await statusChangedAuditRow.locator("details").nth(1).locator("summary").click();
    await expect(statusChangedAuditRow.getByText('"status": "검토중"')).toBeVisible();
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /masters/operating-months 접근은 차단되고 sidebar 운영월도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/operating-months");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });
      await expect(menu.getByText("운영월", { exact: true })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: "운영월" })).toHaveCount(0);
    });
  }

  test.afterAll(async () => {
    await (prisma as any).operatingMonth.deleteMany({
      where: { monthKey: { in: story14MonthKeys } }
    });
    await prisma.$disconnect();
  });
});
