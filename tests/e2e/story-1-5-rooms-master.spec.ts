import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { masterRow, openMasterPanel } from "./support/masters";
import { auditAfterValue, openAuditEntry } from "./support/audit";


const defaultRooms = [
  { displayName: "401 호실", migrationReferenceName: "10번방", sortOrder: 10 },
  { displayName: "402 호실", migrationReferenceName: "11번방", sortOrder: 20 },
  { displayName: "301 호실", migrationReferenceName: "7번방", sortOrder: 30 },
  { displayName: "302 호실", migrationReferenceName: "8번방", sortOrder: 40 },
  { displayName: "303 호실", migrationReferenceName: "9번방", sortOrder: 50 },
  { displayName: "201 호실", migrationReferenceName: "4번방", sortOrder: 60 },
  { displayName: "202 호실", migrationReferenceName: "5번방", sortOrder: 70 },
  { displayName: "203 호실", migrationReferenceName: "6번방", sortOrder: 80 },
  { displayName: "101 호실", migrationReferenceName: "1번방", sortOrder: 90 },
  { displayName: "102 호실", migrationReferenceName: "2번방", sortOrder: 100 },
  { displayName: "103 호실", migrationReferenceName: "3번방", sortOrder: 110 }
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
    await expect(page.getByRole("navigation", { name: "설정 화면" }).getByRole("link", { name: "객실", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("기본 객실: 11개")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "표시명" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "이관 참조값" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "정렬 순서" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "활성 여부" })).toBeVisible();

    for (const room of defaultRooms) {
      // 티켓 07: 목록은 읽기 전용이고 편집 칸은 행을 고르면 열리는 패널에 있다.
      const row = masterRow(page, room.displayName);
      await expect(row).toContainText(room.migrationReferenceName);
      await expect(row.getByRole("cell", { name: String(room.sortOrder), exact: true })).toBeVisible();
      // 활성 여부는 기호가 붙은 상태 칩이다. 비활성 행이면 "비활성"이 보인다.
      await expect(row).toContainText("활성");
      await expect(row).not.toContainText("비활성");
    }

    const rooms = await (prisma as any).room.findMany({
      where: { migrationReferenceName: { in: defaultRooms.map((room) => room.migrationReferenceName) } },
      orderBy: { sortOrder: "asc" }
    });
    expect(rooms.map((room: { displayName: string }) => room.displayName)).toEqual(defaultRooms.map((room) => room.displayName));
    expect(new Set(rooms.map((room: { id: string }) => room.id)).size).toBe(defaultRooms.length);

    // 생성·수정 시각과 고유 ID는 패널의 기록 정보에 있다.
    const panel = await openMasterPanel(page, "101 호실");
    await expect(panel.getByLabel("표시명")).toHaveValue("101 호실");
    await expect(panel.getByText("생성 시각")).toBeVisible();
    await expect(panel.getByText("수정 시각")).toBeVisible();
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
    const panel = await openMasterPanel(page, "101 호실");
    await panel.getByLabel("표시명").fill("101 E2E 호실");
    await panel.getByRole("button", { name: "저장" }).click();
    // 새 표시명의 행을 골라 연 패널에 원래 고유 ID가 있어야 같은 객실이다.
    const renamedPanel = await openMasterPanel(page, "101 E2E 호실");
    await expect(renamedPanel.getByRole("heading", { name: "101 E2E 호실" })).toBeVisible();
    await expect(renamedPanel).toContainText(before.id);

    const after = await getRoomByMigrationReferenceName("1번방");
    expect(after.id).toBe(before.id);
    expect(after.displayName).toBe("101 E2E 호실");
    expect(after.migrationReferenceName).toBe("1번방");

    await page.goto("/audit?targetType=room");
    // 티켓 08: 변경 전·후 전체 값은 기록을 골라 여는 변경 상세 패널에 있다.
    const auditPanel = await openAuditEntry(page, { action: /room\.display_name_changed/, contains: "101 E2E 호실" });
    await expect(auditAfterValue(auditPanel, "displayName")).toHaveText("101 E2E 호실");
    await expect(auditAfterValue(auditPanel, "id")).toHaveText(before.id);
  });

  test("administrator는 정렬 순서를 수정하고 중복 정렬값 오류를 볼 수 있다", async ({ page }) => {
    await login(page, "story15_administrator", "Story15!administrator");
    await page.goto("/masters/rooms");

    const room = await getRoomByMigrationReferenceName("2번방");
    const panel = await openMasterPanel(page, "102 호실");
    await panel.getByLabel("정렬 순서").fill("25");
    await panel.getByRole("button", { name: "적용" }).click();
    // 패널의 입력값은 내가 채운 값이라 server action 반영을 보장하지 못한다.
    // DB가 갱신되기를 폴링해 이후 단언이 stale row를 읽지 않게 한다.
    await expect.poll(async () => (await getRoomByMigrationReferenceName("2번방")).sortOrder).toBe(25);

    const updated = await getRoomByMigrationReferenceName("2번방");
    expect(updated.id).toBe(room.id);
    expect(updated.sortOrder).toBe(25);

    await expect(masterRow(page, "102 호실").getByRole("cell", { name: "25", exact: true })).toBeVisible();
    // 첫 적용(25)의 revalidate로 패널 input이 리렌더되면 이어지는 fill이 stale 요소에 적용될 수 있다.
    // goto로 RSC를 안전하게 재조회한 뒤 중복(30) 입력을 진행한다.
    await page.goto("/masters/rooms");
    const updatedPanel = await openMasterPanel(page, "102 호실");
    await updatedPanel.getByLabel("정렬 순서").fill("30");
    await updatedPanel.getByRole("button", { name: "적용" }).click();
    await expect(page.getByText("정렬 순서가 이미 사용 중입니다.")).toBeVisible();

    await page.goto("/audit?targetType=room");
    const auditPanel = await openAuditEntry(page, { action: /room\.sort_order_changed/, contains: room.id });
    await expect(auditAfterValue(auditPanel, "sortOrder")).toHaveText("25");
  });

  test("administrator는 객실을 물리 삭제 대신 비활성 처리하고 감사 로그를 확인할 수 있다", async ({ page }) => {
    await login(page, "story15_administrator", "Story15!administrator");
    await page.goto("/masters/rooms");

    const room = await getRoomByMigrationReferenceName("11번방");
    const panel = await openMasterPanel(page, "402 호실");
    await panel.getByRole("button", { name: "비활성 처리" }).click();
    // toContainText("비활성")은 "비활성 처리" 버튼 라벨에도 매칭되는 거짓 양성이라 server action을
    // 동기화하지 못한다. 비활성 반영을 DB 폴링으로 확정한다.
    await expect.poll(async () => (await getRoomByMigrationReferenceName("11번방")).isActive).toBe(false);

    const after = await getRoomByMigrationReferenceName("11번방");
    expect(after.id).toBe(room.id);
    expect(after.isActive).toBe(false);

    await page.goto("/audit?targetType=room");
    const auditPanel = await openAuditEntry(page, { action: /room\.deactivated/, contains: room.id });
    await expect(auditAfterValue(auditPanel, "isActive")).toHaveText("false");
  });

  for (const user of users.filter((candidate) => candidate.role !== "administrator")) {
    test(`${user.accountId} direct /masters/rooms 접근은 차단되고 객실 마스터 링크도 숨겨진다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/rooms");

      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      // 도크와 구역 탭 어디에도 객실 마스터로 가는 링크가 없다.
      await expect(page.locator('a[href^="/masters/rooms"]')).toHaveCount(0);
    });
  }

  test.afterAll(async () => {
    await restoreDefaultRooms();
    await prisma.$disconnect();
  });
});
