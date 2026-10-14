import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { masterPanel, masterRow, openMasterPanel } from "./support/masters";


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


async function seedAuthAccount(input: {
  accountId: string;
  email: string;
  displayName: string;
  staffCode: string;
  role: string;
  secret: string;
}) {
  const sortOrder = 7400 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
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
    await expect(page.getByRole("navigation", { name: "설정 화면" }).getByRole("link", { name: "코드·시간" })).toHaveAttribute("aria-current", "page");
    // "상태"는 "근무상태" heading에도 부분 매칭(strict 위반)하므로 exact로 정확히 겨냥한다.
    for (const heading of ["상태", "결제수단", "할인구분", "근무상태", "확인값", "시간 슬롯"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    for (const value of ["예약", "사용중", "청소중", "방문완료", "노쇼", "취소", "현금", "카드", "계좌", "기타", "일주일내방문", "생일자", "후기작성", "정상", "휴무", "지각", "조퇴", "결근", "Y", "N", "11:00", "01:00"]) {
      // 티켓 07: 목록은 읽기 전용이고 표시명·시간 슬롯 값은 행의 첫 칸 버튼이다.
      await expect(page.getByRole("button", { name: value, exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "01:30", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "02:00", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "02:30", exact: true })).toHaveCount(0);

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
    const panel = await openMasterPanel(page, "현금");
    await panel.getByLabel("표시명").fill("현금 결제");
    await panel.getByRole("button", { name: "저장" }).click();
    // 새 표시명의 행을 골라 연 패널에 원래 고유 ID가 있어야 같은 코드다.
    const renamedPanel = await openMasterPanel(page, "현금 결제");
    await expect(renamedPanel.getByRole("heading", { name: "현금 결제" })).toBeVisible();
    await expect(renamedPanel).toContainText(before.id);

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
    const panel = await openMasterPanel(page, "카드");
    await panel.getByLabel("정렬 순서").fill("10");
    await panel.getByRole("button", { name: "적용" }).click();

    await expect(page.getByText("같은 코드 유형에서 정렬 순서가 이미 사용 중입니다.")).toBeVisible();
    const after = await getCodeItem("PAYMENT_METHOD", "CARD");
    expect(after.id).toBe(card.id);
    expect(after.sortOrder).toBe(card.sortOrder);
  });

  test("administrator는 시간 슬롯을 추가하고 값을 수정해도 stable id를 보존하며 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    // 슬롯 추가는 시간 슬롯 구역의 서랍이다. 만든 슬롯은 바로 골라 패널에 열린다.
    await page.getByRole("button", { name: "슬롯 추가" }).click();
    const drawer = page.getByRole("dialog", { name: "슬롯 추가" });
    await drawer.locator("#new-time-slot-value").fill("10:00");
    await drawer.locator("#new-time-slot-sort").fill("5");
    await drawer.getByRole("button", { name: "슬롯 추가" }).click();
    await expect(masterRow(page, "10:00")).toBeVisible();

    const before = await getTimeSlot("10:00");
    const panel = masterPanel(page);
    await expect(panel.getByLabel("시간 슬롯")).toHaveValue("10:00");
    await panel.getByLabel("시간 슬롯").fill("10:30");
    await panel.getByRole("button", { name: "저장" }).click();
    const renamedPanel = await openMasterPanel(page, "10:30");
    await expect(renamedPanel.getByRole("heading", { name: "10:30" })).toBeVisible();
    await expect(renamedPanel).toContainText(before.id);

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
    const panel = await openMasterPanel(page, "11:00");
    await panel.getByLabel("시간 슬롯").fill("11:30");
    await panel.getByRole("button", { name: "저장" }).click();

    await expect(page.getByText("이미 존재하는 시간 슬롯입니다.")).toBeVisible();
    const after = await getTimeSlot("11:00");
    expect(after.id).toBe(slot.id);
    expect(after.value).toBe("11:00");
  });

  test("administrator는 시간 슬롯을 비활성 처리하고 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story16_administrator", "Story16!administrator");
    await page.goto("/masters/codes");

    const slot = await getTimeSlot("01:00");
    const panel = await openMasterPanel(page, "01:00");
    await panel.getByRole("button", { name: "비활성 처리" }).click();
    // toContainText("비활성")은 "비활성 처리" 버튼 라벨에도 매칭되는 거짓 양성이라 동기화하지 못한다.
    // 비활성 반영을 DB 폴링으로 확정한 뒤 /audit으로 navigate한다(in-flight POST abort 회피).
    await expect.poll(async () => (await getTimeSlot("01:00")).isActive).toBe(false);

    const after = await getTimeSlot("01:00");
    expect(after.id).toBe(slot.id);
    expect(after.isActive).toBe(false);

    await page.goto("/audit?targetType=time_slot");
    const auditRow = page.getByRole("row", { name: /time_slot\.deactivated/ }).filter({ hasText: slot.id });
    await expect(auditRow).toBeVisible();
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /masters/codes 접근은 차단되고 코드/시간 슬롯 링크도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/codes");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      // 도크와 구역 탭 어디에도 코드/시간 슬롯으로 가는 링크가 없다.
      await expect(page.locator('a[href^="/masters/codes"]')).toHaveCount(0);
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
