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

const defaultRooms = [
  { displayName: "101 호실", migrationReferenceName: "1번방", sortOrder: 10 },
  { displayName: "102 호실", migrationReferenceName: "2번방", sortOrder: 20 },
  { displayName: "103 호실", migrationReferenceName: "3번방", sortOrder: 30 },
  { displayName: "201 호실", migrationReferenceName: "4번방", sortOrder: 40 },
  { displayName: "202 호실", migrationReferenceName: "5번방", sortOrder: 50 },
  { displayName: "203 호실", migrationReferenceName: "6번방", sortOrder: 60 },
  { displayName: "301 호실", migrationReferenceName: "7번방", sortOrder: 70 },
  { displayName: "302 호실", migrationReferenceName: "8번방", sortOrder: 80 },
  { displayName: "303 호실", migrationReferenceName: "9번방", sortOrder: 90 },
  { displayName: "401 호실", migrationReferenceName: "10번방", sortOrder: 100 },
  { displayName: "402 호실", migrationReferenceName: "11번방", sortOrder: 110 }
] as const;

const roomAuditActions = ["room.created", "room.display_name_changed", "room.sort_order_changed", "room.deactivated"];

const users = [
  {
    accountId: "story15_administrator",
    role: "administrator",
    password: "Story15!administrator",
    landing: "/live"
  },
  {
    accountId: "story15_counter",
    role: "counter",
    password: "Story15!counter",
    landing: "/calls"
  },
  {
    accountId: "story15_settlement_manager",
    role: "settlement_manager",
    password: "Story15!settlement_manager",
    landing: "/settlements"
  },
  {
    accountId: "story15_waiter",
    role: "waiter",
    password: "Story15!waiter",
    landing: "/rooms"
  },
  {
    accountId: "story15_read_only_viewer",
    role: "read_only_viewer",
    password: "Story15!read_only_viewer",
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
  const sortOrder = 7300 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
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

async function restoreDefaultRooms() {
  for (const room of defaultRooms) {
    await (prisma as any).room.updateMany({
      where: { migrationReferenceName: room.migrationReferenceName },
      data: {
        displayName: room.displayName,
        sortOrder: room.sortOrder,
        isActive: true
      }
    });
  }
}

async function getRoomByMigrationReferenceName(migrationReferenceName: string) {
  const room = await (prisma as any).room.findFirst({
    where: { migrationReferenceName },
    orderBy: { createdAt: "asc" }
  });

  expect(room).not.toBeNull();
  return room as {
    id: string;
    displayName: string;
    migrationReferenceName: string;
    sortOrder: number;
    isActive: boolean;
  };
}

function roomRowByDisplayValue(page: import("@playwright/test").Page, displayName: string) {
  return page.locator("tbody tr").filter({ has: page.getByDisplayValue(displayName) });
}

test.describe("Story 1.5 객실 마스터 관리", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}-story15@example.local`,
        displayName: user.accountId,
        staffCode: `E2E15-${user.accountId.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }

    await (prisma as any).auditLog.deleteMany({
      where: {
        targetType: "room",
        action: { in: roomAuditActions }
      }
    });
    await (prisma as any).room.deleteMany({
      where: { migrationReferenceName: { in: defaultRooms.map((room) => room.migrationReferenceName) } }
    });
  });

  test("administrator는 기본 11개 객실과 이관 참조값을 표준 표시명과 분리해 볼 수 있다", async ({ page }) => {
    await login(page, "story15_administrator", "Story15!administrator");
    await page.goto("/masters/rooms");

    await expect(page.getByRole("heading", { name: "객실 마스터", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "객실" })).toBeVisible();
    await expect(page.getByText("기본 객실: 11개")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "표시명" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "이관 참조값" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "정렬 순서" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "활성 여부" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "생성 시각" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "수정 시각" })).toBeVisible();

    for (const room of defaultRooms) {
      const row = roomRowByDisplayValue(page, room.displayName);
      await expect(row.locator('input[name="displayName"]')).toHaveValue(room.displayName);
      await expect(row).toContainText(room.migrationReferenceName);
      await expect(row.locator('input[name="sortOrder"]')).toHaveValue(String(room.sortOrder));
      await expect(row.getByText("활성", { exact: true })).toBeVisible();
    }

    const rooms = await (prisma as any).room.findMany({
      where: { migrationReferenceName: { in: defaultRooms.map((room) => room.migrationReferenceName) } },
      orderBy: { sortOrder: "asc" }
    });
    expect(rooms.map((room: { displayName: string }) => room.displayName)).toEqual(defaultRooms.map((room) => room.displayName));
    expect(new Set(rooms.map((room: { id: string }) => room.id)).size).toBe(defaultRooms.length);
    for (const room of rooms as Array<{ id: string; displayName: string; migrationReferenceName: string }>) {
      expect(room.id).not.toBe(room.displayName);
      expect(room.id).not.toBe(room.migrationReferenceName);
    }

    await page.goto("/audit?targetType=room");
    await expect(page.getByRole("row", { name: /room\.created/ }).first()).toBeVisible();
  });

  test("administrator는 표시명을 수정해도 고유 ID를 보존하고 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story15_administrator", "Story15!administrator");
    await page.goto("/masters/rooms");

    const before = await getRoomByMigrationReferenceName("1번방");
    const row = roomRowByDisplayValue(page, "101 호실");
    await row.locator('input[name="displayName"]').fill("101 E2E 호실");
    await row.getByRole("button", { name: "저장" }).click();
    await expect(roomRowByDisplayValue(page, "101 E2E 호실")).toContainText(`고유 ID: ${before.id}`);

    const after = await getRoomByMigrationReferenceName("1번방");
    expect(after.id).toBe(before.id);
    expect(after.displayName).toBe("101 E2E 호실");
    expect(after.migrationReferenceName).toBe("1번방");

    await page.goto("/audit?targetType=room");
    const auditRow = page.getByRole("row", { name: /room\.display_name_changed/ }).filter({ hasText: "101 E2E 호실" });
    await expect(auditRow).toBeVisible();
    await expect(auditRow).toContainText(before.id);
    await auditRow.locator("details").nth(1).locator("summary").click();
    await expect(auditRow.getByText('"displayName": "101 E2E 호실"')).toBeVisible();
    await expect(auditRow.getByText(`"id": "${before.id}"`)).toBeVisible();
  });

  test("administrator는 정렬 순서를 수정하고 중복 정렬값 오류를 볼 수 있다", async ({ page }) => {
    await login(page, "story15_administrator", "Story15!administrator");
    await page.goto("/masters/rooms");

    const room = await getRoomByMigrationReferenceName("2번방");
    const row = roomRowByDisplayValue(page, "102 호실");
    await row.locator('input[name="sortOrder"]').fill("25");
    await row.getByRole("button", { name: "적용" }).click();
    await expect(roomRowByDisplayValue(page, "102 호실").locator('input[name="sortOrder"]')).toHaveValue("25");

    const updated = await getRoomByMigrationReferenceName("2번방");
    expect(updated.id).toBe(room.id);
    expect(updated.sortOrder).toBe(25);

    const updatedRow = roomRowByDisplayValue(page, "102 호실");
    await updatedRow.locator('input[name="sortOrder"]').fill("30");
    await updatedRow.getByRole("button", { name: "적용" }).click();
    await expect(page.getByText("정렬 순서가 이미 사용 중입니다.")).toBeVisible();

    await page.goto("/audit?targetType=room");
    const auditRow = page.getByRole("row", { name: /room\.sort_order_changed/ }).filter({ hasText: room.id });
    await expect(auditRow).toBeVisible();
    await auditRow.locator("details").nth(1).locator("summary").click();
    await expect(auditRow.getByText('"sortOrder": 25')).toBeVisible();
  });

  test("administrator는 객실을 물리 삭제 대신 비활성 처리하고 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story15_administrator", "Story15!administrator");
    await page.goto("/masters/rooms");

    const room = await getRoomByMigrationReferenceName("11번방");
    const row = roomRowByDisplayValue(page, "402 호실");
    await row.getByRole("button", { name: "비활성 처리" }).click();
    await expect(roomRowByDisplayValue(page, "402 호실")).toContainText("비활성");

    const after = await getRoomByMigrationReferenceName("11번방");
    expect(after.id).toBe(room.id);
    expect(after.isActive).toBe(false);

    await page.goto("/audit?targetType=room");
    const auditRow = page.getByRole("row", { name: /room\.deactivated/ }).filter({ hasText: room.id });
    await expect(auditRow).toBeVisible();
    await auditRow.locator("details").nth(1).locator("summary").click();
    await expect(auditRow.getByText('"isActive": false')).toBeVisible();
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /masters/rooms 접근은 차단되고 sidebar 객실도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/rooms");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });
      await expect(menu.getByText("객실", { exact: true })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: "객실" })).toHaveCount(0);
    });
  }

  test.afterAll(async () => {
    await restoreDefaultRooms();
    await prisma.$disconnect();
  });
});
