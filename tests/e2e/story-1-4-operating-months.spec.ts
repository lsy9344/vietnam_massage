import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { masterPanel } from "./support/masters";
import { auditAfterValue, openAuditEntry } from "./support/audit";


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
    await expect(page.getByRole("navigation", { name: "설정 화면" }).getByRole("link", { name: "운영월" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("columnheader", { name: "시작일" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "종료일" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "현재 상태" })).toBeVisible();
    // "선택 기준" 배지는 오늘이 포함된 운영월(없으면 목록 첫 행)에 붙는다. 공유 DB에는 다른 스펙의
    // 운영월도 있으므로 어느 행인지 고정할 수 없다. 배지가 정확히 하나만 있는지로 확인한다.
    await expect(page.getByRole("row", { name: /2031-05/ }).first()).toBeVisible();
    await expect(page.getByText("선택 기준")).toHaveCount(1);

    // 티켓 07: 생성은 도구줄의 서랍이고, 만든 운영월은 바로 골라 패널이 열린다.
    await page.getByRole("button", { name: "운영월 생성" }).click();
    const drawer = page.getByRole("dialog", { name: "운영월 생성" });
    const monthInput = drawer.getByLabel("새 운영월");
    await monthInput.fill("2031-13");
    await expect.poll(() => monthInput.evaluate((input) => (input as HTMLInputElement).validity.valid)).toBe(false);
    await monthInput.fill("2031-04");

    await drawer.getByRole("button", { name: "운영월 생성" }).click();
    const createdRow = page.getByRole("row", { name: /2031-04/ });
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByText("2031-04-01")).toBeVisible();
    await expect(createdRow.getByText("2031-04-30")).toBeVisible();
    await expect(createdRow.getByText("작성중")).toBeVisible();
    const panel = masterPanel(page);
    await expect(panel.getByRole("heading", { name: "2031-04" })).toBeVisible();
    await expect(panel.getByText("생성 시각")).toBeVisible();
    await expect(panel.getByText("수정 시각")).toBeVisible();

    await page.getByRole("button", { name: "운영월 생성" }).click();
    await drawer.getByLabel("새 운영월").fill("2031-04");
    await drawer.getByRole("button", { name: "운영월 생성" }).click();
    await expect(drawer.getByText("이미 존재하는 운영월입니다.")).toBeVisible();
    await page.keyboard.press("Escape");

    await panel.getByRole("button", { name: "검토중으로 변경" }).click();
    await expect(createdRow.getByText("검토중")).toBeVisible();
    // 상태 변경 server action을 DB 폴링으로 확정한 뒤 /audit으로 navigate한다.
    // (in-flight POST 중 goto하면 net::ERR_ABORTED로 status_changed 감사 로그가 누락된다.)
    await expect
      .poll(async () => (await (prisma as any).operatingMonth.findUnique({ where: { monthKey: "2031-04" }, select: { status: true } }))?.status)
      .toBe("검토중");

    await page.goto("/audit?targetType=operating_month");
    // 티켓 08: 변경 전·후 전체 값은 기록을 골라 여는 변경 상세 패널에 있다.
    const createdPanel = await openAuditEntry(page, { action: /operating_month\.created/, contains: "2031-04" });
    await expect(auditAfterValue(createdPanel, "monthKey")).toHaveText("2031-04");
    const statusChangedPanel = await openAuditEntry(page, { action: /operating_month\.status_changed/, contains: "2031-04" });
    await expect(auditAfterValue(statusChangedPanel, "status")).toHaveText("검토중");
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /masters/operating-months 접근은 차단되고 운영월 링크도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/operating-months");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      // 도크와 구역 탭 어디에도 운영월 설정으로 가는 링크가 없다.
      await expect(page.locator('a[href^="/masters/operating-months"]')).toHaveCount(0);
    });
  }

  test.afterAll(async () => {
    await (prisma as any).operatingMonth.deleteMany({
      where: { monthKey: { in: story14MonthKeys } }
    });
    await prisma.$disconnect();
  });
});
