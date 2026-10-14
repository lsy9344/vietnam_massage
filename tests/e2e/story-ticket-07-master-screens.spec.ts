import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import { masterPanel, masterRow } from "./support/masters";

/**
 * 티켓 07: 기준정보 화면을 목록 + 비모달 편집 패널로 다시 구성했다. 기존 기준정보 스펙(1-4~1-8, 7-1, 7-3)이
 * 저장·거절·권한을 확인하고, 여기서는 이 티켓의 화면 조건(주소로 패널 복원, 비활성 설명, 키보드 이동,
 * 44px 조작 영역, 두 언어와 폭)을 확인한다.
 */

const admin = { accountId: "ticket07_admin", password: "Ticket07!admin", staffCode: "E2E-T07-ADM", sortOrder: 94700 };
// 다른 스펙의 객실 판과 객실 수에 끼어들지 않게 비활성 객실 하나를 따로 둔다(객실·TV 판은 활성 객실만 그린다).
const inactiveRoom = { displayName: "T07 비활성 객실", migrationReferenceName: "T07-비활성", sortOrder: 9707 };

const screens = [
  "/masters/operating-months",
  "/masters/rooms",
  "/masters/codes",
  "/masters/employees",
  "/masters/courses",
  "/masters/sheet-mapping"
] as const;

let inactiveRoomId = "";

// 직원은 (직군, 정렬 순서)가 겹치면 안 되고 다른 스펙도 같은 DB에 직원을 넣으므로, 비어 있는 정렬 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 07 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAdmin() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: admin.staffCode },
    update: { isActive: true },
    create: {
      staffCode: admin.staffCode,
      displayName: "E2E T07 administrator",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder("OPERATIONS", admin.staffCode, admin.sortOrder),
      isActive: true
    }
  });
  const passwordHash = await hash(admin.password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: admin.accountId },
    update: { passwordHash, role: "administrator", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${admin.accountId}@example.local`,
      accountId: admin.accountId,
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function seedInactiveRoom() {
  const existing = await (prisma as any).room.findFirst({ where: { migrationReferenceName: inactiveRoom.migrationReferenceName } });
  const room = existing
    ? await (prisma as any).room.update({ where: { id: existing.id }, data: { displayName: inactiveRoom.displayName, isActive: false } })
    : await (prisma as any).room.create({ data: { ...inactiveRoom, isActive: false } });
  inactiveRoomId = room.id;
}

function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** 본문(도크 밖)에서 보이는 버튼·입력칸·선택칸·펼침 중 높이가 44px보다 낮은 것. 체크박스는 라벨 줄이 44px이다. */
function smallTargets(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("main button, main input:not([type=hidden]):not([type=checkbox]), main select, main summary"))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height < 43.5;
      })
      .map((element) => `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 30)}" ${Math.round(element.getBoundingClientRect().height)}px`)
  );
}

/** 목록에 행이 있으면 첫 행을 골라 패널을 연다(시트 매핑은 패널이 없다). */
async function openFirstPanel(page: Page) {
  const firstRowButton = page.locator("main tbody th button").first();
  if ((await firstRowButton.count()) === 0) return;
  await firstRowButton.click();
  await expect(masterPanel(page)).toBeVisible();
}

test.describe("티켓 07 기준정보 화면", () => {
  test.beforeAll(async () => {
    await seedAdmin();
    await seedInactiveRoom();
  });

  test.afterAll(async () => {
    await (prisma as any).room.deleteMany({ where: { migrationReferenceName: inactiveRoom.migrationReferenceName } });
    await prisma.$disconnect();
  });

  test("주소의 item으로 들어오면 그 항목의 패널이 변경 영향과 함께 열리고, 닫으면 주소에서 빠진다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.goto(`/masters/rooms?item=${inactiveRoomId}`);

    const panel = masterPanel(page);
    await expect(panel.getByRole("heading", { name: inactiveRoom.displayName })).toBeVisible();
    await expect(panel.getByRole("region", { name: "변경 영향" })).toBeVisible();
    await expect(panel.getByText("이미 비활성")).toBeVisible();
    await expect(panel.getByRole("button", { name: "비활성 처리" })).toHaveCount(0);

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
  });

  test("비활성 항목은 행 안에서 지우지 않고 남겨 둔 것이라고 설명한다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.goto("/masters/rooms");

    const row = masterRow(page, inactiveRoom.displayName);
    await expect(row).toContainText("비활성");
    await expect(row).toContainText("지우지 않고 남겨 둔 객실입니다.");
  });

  test("키보드로 행을 고르면 포커스가 패널로 가고, 패널을 닫으면 그 행으로 돌아온다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.goto("/masters/rooms");

    const rowButton = page.getByRole("button", { name: inactiveRoom.displayName, exact: true });
    await rowButton.focus();
    await page.keyboard.press("Enter");
    const panel = masterPanel(page);
    await expect(panel).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.querySelector("aside") !== null)).toBe(true);
    await expect(page).toHaveURL(new RegExp(`item=${inactiveRoomId}`));

    // 패널 안 첫 조작은 닫기다.
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("button", { name: "닫기" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel).toHaveCount(0);
    await expect(rowButton).toBeFocused();
  });

  test("본문의 누르는 것과 입력칸은 44px 이상이다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of screens) {
      await page.goto(path);
      await openFirstPanel(page);
      expect(await smallTargets(page), path).toEqual([]);
    }
  });

  for (const locale of ["ko", "vi"] as const) {
    test(`${locale}: 1440·1024·390px에서 기준정보 화면 문서가 옆으로 넘치지 않는다`, async ({ page }) => {
      test.setTimeout(120_000);
      await login(page, admin.accountId, admin.password);
      await setLocaleCookie(page, locale);
      for (const width of [1440, 1024, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of screens) {
          await page.goto(path);
          await openFirstPanel(page);
          expect(await horizontalOverflow(page), `${path} @${width}px`).toBeLessThanOrEqual(0);
        }
      }
    });
  }
});
