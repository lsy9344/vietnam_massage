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

const codeAuditActions = [
  "code_item.created",
  "code_item.display_name_changed",
  "code_item.sort_order_changed",
  "code_item.deactivated",
  "time_slot.created",
  "time_slot.value_changed",
  "time_slot.sort_order_changed",
  "time_slot.deactivated"
];

const defaultCodes = [
  { codeType: "SERVICE_STATUS", code: "RESERVED", displayName: "예약", sortOrder: 10 },
  { codeType: "SERVICE_STATUS", code: "VISIT_COMPLETE", displayName: "방문완료", sortOrder: 40 },
  { codeType: "PAYMENT_METHOD", code: "CASH", displayName: "현금", sortOrder: 10 },
  { codeType: "DISCOUNT_TYPE", code: "WEEKLY_RETURN", displayName: "일주일내방문", sortOrder: 10 },
  { codeType: "ATTENDANCE_STATUS", code: "NORMAL", displayName: "정상", sortOrder: 10 },
  { codeType: "CONFIRMATION", code: "Y", displayName: "Y", sortOrder: 10 },
  { codeType: "CONFIRMATION", code: "N", displayName: "N", sortOrder: 20 }
] as const;

const defaultTimeSlotValues = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00"] as const;
const customTimeSlotValues = ["10:00", "10:30"] as const;

const users = [
  {
    accountId: "story16_administrator",
    role: "administrator",
    password: "Story16!administrator",
    landing: "/live"
  },
  {
    accountId: "story16_counter",
    role: "counter",
    password: "Story16!counter",
    landing: "/calls"
  },
  {
    accountId: "story16_settlement_manager",
    role: "settlement_manager",
    password: "Story16!settlement_manager",
    landing: "/settlements"
  },
  {
    accountId: "story16_waiter",
    role: "waiter",
    password: "Story16!waiter",
    landing: "/rooms"
  },
  {
    accountId: "story16_read_only_viewer",
    role: "read_only_viewer",
    password: "Story16!read_only_viewer",
    landing: "/rooms"
  }
];

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
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
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

async function restoreDefaults() {
  await (prisma as any).codeItem.updateMany({
    where: { codeType: { in: ["SERVICE_STATUS", "PAYMENT_METHOD", "DISCOUNT_TYPE", "ATTENDANCE_STATUS", "CONFIRMATION"] } },
    data: { isActive: true }
  });
  for (const code of defaultCodes) {
    await (prisma as any).codeItem.updateMany({
      where: { codeType: code.codeType, code: code.code },
      data: {
        displayName: code.displayName,
        sortOrder: code.sortOrder,
        isActive: true
      }
    });
  }
  for (const [index, value] of defaultTimeSlotValues.entries()) {
    await (prisma as any).timeSlot.updateMany({
      where: { value },
      data: {
        sortOrder: (index + 1) * 10,
        isActive: true
      }
    });
  }
}

async function getCodeItem(codeType: string, code: string) {
  const item = await (prisma as any).codeItem.findFirst({ where: { codeType, code } });
  expect(item).not.toBeNull();
  return item as { id: string; codeType: string; code: string; displayName: string; sortOrder: number; isActive: boolean };
}

async function getTimeSlot(value: string) {
  const slot = await (prisma as any).timeSlot.findFirst({ where: { value } });
  expect(slot).not.toBeNull();
  return slot as { id: string; value: string; sortOrder: number; isActive: boolean };
}

function rowByDisplayValue(page: import("@playwright/test").Page, value: string) {
  return page.locator("tbody tr").filter({ has: page.getByDisplayValue(value) });
}

test.describe("Story 1.6 코드와 시간 슬롯 관리", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}-story16@example.local`,
        displayName: user.accountId,
        staffCode: `E2E16-${user.accountId.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }

    await (prisma as any).auditLog.deleteMany({
      where: {
        targetType: { in: ["code_item", "time_slot"] },
        action: { in: codeAuditActions }
      }
    });
    await (prisma as any).codeItem.deleteMany({
      where: { codeType: { in: ["SERVICE_STATUS", "PAYMENT_METHOD", "DISCOUNT_TYPE", "ATTENDANCE_STATUS", "CONFIRMATION"] } }
    });
    await (prisma as any).timeSlot.deleteMany({
      where: { value: { in: [...defaultTimeSlotValues, ...customTimeSlotValues, "01:30", "02:00", "02:30"] } }
    });
  });

  test("administrator는 기본 코드와 29개 시간 슬롯을 볼 수 있고 01:30 이후 기본값은 보이지 않는다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    await expect(page.getByRole("heading", { name: "코드/시간 슬롯", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "코드/시간 슬롯" })).toBeVisible();
    for (const heading of ["상태", "결제수단", "할인구분", "근무상태", "확인값", "시간 슬롯"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    for (const value of ["예약", "사용중", "청소중", "방문완료", "노쇼", "취소", "현금", "카드", "계좌", "기타", "일주일내방문", "생일자", "후기작성", "정상", "휴무", "지각", "조퇴", "결근", "Y", "N", "11:00", "01:00"]) {
      await expect(page.getByDisplayValue(value).first()).toBeVisible();
    }
    await expect(page.getByDisplayValue("01:30")).toHaveCount(0);
    await expect(page.getByDisplayValue("02:00")).toHaveCount(0);
    await expect(page.getByDisplayValue("02:30")).toHaveCount(0);

    const slots = await (prisma as any).timeSlot.findMany({ orderBy: { sortOrder: "asc" } });
    expect(slots.map((slot: { value: string }) => slot.value)).toEqual([...defaultTimeSlotValues]);

    await page.goto("/audit?targetType=code_item");
    await expect(page.getByRole("row", { name: /code_item\.created/ }).first()).toBeVisible();
    await page.goto("/audit?targetType=time_slot");
    await expect(page.getByRole("row", { name: /time_slot\.created/ }).first()).toBeVisible();
  });

  test("administrator는 코드 표시명을 수정해도 stable id와 code를 보존하고 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    const before = await getCodeItem("PAYMENT_METHOD", "CASH");
    const row = rowByDisplayValue(page, "현금");
    await row.locator('input[name="displayName"]').fill("현금 결제");
    await row.getByRole("button", { name: "저장" }).click();
    await expect(rowByDisplayValue(page, "현금 결제")).toContainText(`고유 ID: ${before.id}`);

    const after = await getCodeItem("PAYMENT_METHOD", "CASH");
    expect(after.id).toBe(before.id);
    expect(after.code).toBe("CASH");
    expect(after.displayName).toBe("현금 결제");

    await page.goto("/audit?targetType=code_item");
    const auditRow = page.getByRole("row", { name: /code_item\.display_name_changed/ }).filter({ hasText: "현금 결제" });
    await expect(auditRow).toBeVisible();
    await expect(auditRow).toContainText(before.id);
  });

  test("administrator는 중복 코드 정렬 순서 오류를 볼 수 있고 기존 값은 유지된다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    const card = await getCodeItem("PAYMENT_METHOD", "CARD");
    const row = rowByDisplayValue(page, "카드");
    await row.locator('input[name="sortOrder"]').fill("10");
    await row.getByRole("button", { name: "적용" }).click();

    await expect(page.getByText("같은 코드 유형에서 정렬 순서가 이미 사용 중입니다.")).toBeVisible();
    const after = await getCodeItem("PAYMENT_METHOD", "CARD");
    expect(after.id).toBe(card.id);
    expect(after.sortOrder).toBe(card.sortOrder);
  });

  test("administrator는 시간 슬롯을 추가하고 값을 수정해도 stable id를 보존하며 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    await page.locator("#new-time-slot-value").fill("10:00");
    await page.locator("#new-time-slot-sort").fill("5");
    await page.getByRole("button", { name: "슬롯 추가" }).click();
    await expect(rowByDisplayValue(page, "10:00")).toBeVisible();

    const before = await getTimeSlot("10:00");
    const row = rowByDisplayValue(page, "10:00");
    await row.locator('input[name="value"]').fill("10:30");
    await row.getByRole("button", { name: "저장" }).click();
    await expect(rowByDisplayValue(page, "10:30")).toContainText(`고유 ID: ${before.id}`);

    const after = await getTimeSlot("10:30");
    expect(after.id).toBe(before.id);
    expect(after.value).toBe("10:30");

    await page.goto("/audit?targetType=time_slot");
    const auditRow = page.getByRole("row", { name: /time_slot\.value_changed/ }).filter({ hasText: before.id });
    await expect(auditRow).toBeVisible();
    await expect(auditRow).toContainText("10:30");
  });

  test("administrator는 중복 시간 슬롯 값 오류를 볼 수 있고 기존 슬롯은 유지된다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    const slot = await getTimeSlot("11:00");
    const row = rowByDisplayValue(page, "11:00");
    await row.locator('input[name="value"]').fill("11:30");
    await row.getByRole("button", { name: "저장" }).click();

    await expect(page.getByText("이미 존재하는 시간 슬롯입니다.")).toBeVisible();
    const after = await getTimeSlot("11:00");
    expect(after.id).toBe(slot.id);
    expect(after.value).toBe("11:00");
  });

  test("administrator는 시간 슬롯을 비활성 처리하고 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    const slot = await getTimeSlot("01:00");
    const row = rowByDisplayValue(page, "01:00");
    await row.getByRole("button", { name: "비활성 처리" }).click();
    await expect(rowByDisplayValue(page, "01:00")).toContainText("비활성");

    const after = await getTimeSlot("01:00");
    expect(after.id).toBe(slot.id);
    expect(after.isActive).toBe(false);

    await page.goto("/audit?targetType=time_slot");
    const auditRow = page.getByRole("row", { name: /time_slot\.deactivated/ }).filter({ hasText: slot.id });
    await expect(auditRow).toBeVisible();
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /masters/codes 접근은 차단되고 sidebar 코드/시간 슬롯도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/codes");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });
      await expect(menu.getByText("코드/시간 슬롯", { exact: true })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: "코드/시간 슬롯" })).toHaveCount(0);
    });
  }

  test.afterAll(async () => {
    await restoreDefaults();
    await (prisma as any).timeSlot.deleteMany({
      where: { value: { in: [...customTimeSlotValues] } }
    });
    await prisma.$disconnect();
  });
});
