import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { testEmployees } from "./support/test-employees";
import { argon2idOptions, login } from "./support/auth";
import { openMasterPanelByRowText } from "./support/masters";
import { pickListboxOptionByValue } from "./support/listbox-select";

/**
 * 티켓 02: Therapist 계정 발급·초기화·정지와 첫 비밀번호 변경.
 *
 * 시드: "administrator"(scripts/seed-dev-accounts.ts)를 그대로 쓴다. 겹치지 않는 staffCode·정렬 순서는
 * README의 "티켓 번호를 월에 쓰는 식"을 따라 2042-02월, 98020대를 쓴다.
 */
const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";

const ISSUED_STAFF_CODE = "E2E-T02-THR-1";
const ISSUED_DISPLAY_NAME = "T02 발급 Therapist";
const ISSUED_ACCOUNT_ID = ISSUED_STAFF_CODE.toLowerCase();

const RETIRE_STAFF_CODE = "E2E-T02-THR-2";
const RETIRE_DISPLAY_NAME = "T02 퇴사 Therapist";
const RETIRE_ACCOUNT_ID = "e2e_t02_retire";
const RETIRE_PASSWORD = "Story12!t02retire";

test.describe("티켓 02 Therapist 계정 발급·초기화·정지", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await testEmployees.upsert({
      where: { staffCode: ISSUED_STAFF_CODE },
      update: { displayName: ISSUED_DISPLAY_NAME, employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
      create: {
        staffCode: ISSUED_STAFF_CODE,
        displayName: ISSUED_DISPLAY_NAME,
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: null,
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 98020,
        isActive: true
      }
    });

    const retireEmployee = await testEmployees.upsert({
      where: { staffCode: RETIRE_STAFF_CODE },
      update: { displayName: RETIRE_DISPLAY_NAME, employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
      create: {
        staffCode: RETIRE_STAFF_CODE,
        displayName: RETIRE_DISPLAY_NAME,
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: null,
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 98021,
        isActive: true
      }
    });

    // 퇴사 테스트는 "이미 로그인해 있던 세션"이 목적이라, 발급 화면을 또 거치지 않고 계정을 바로 둔다.
    const passwordHash = await hash(RETIRE_PASSWORD, argon2idOptions);
    await (prisma as any).userAccount.upsert({
      where: { accountId: RETIRE_ACCOUNT_ID },
      update: { passwordHash, role: "therapist", employeeId: retireEmployee.id, isActive: true, lockedUntil: null, failedLoginCount: 0, passwordChangeRequired: false },
      create: {
        email: `${RETIRE_ACCOUNT_ID}@therapist.internal`,
        accountId: RETIRE_ACCOUNT_ID,
        passwordHash,
        role: "therapist",
        employeeId: retireEmployee.id,
        isActive: true,
        passwordChangeRequired: false
      }
    });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("관리자 발급 → 쪽지의 ID·임시 비밀번호로 첫 로그인 → 변경 전 다른 탭 막힘 → 비밀번호 변경 → Therapist 오늘 화면", async ({ page, browser }) => {
    await login(page, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await page.goto("/masters/employees");
    const panel = await openMasterPanelByRowText(page, ISSUED_STAFF_CODE);
    await expect(panel.getByRole("heading", { name: "Therapist 계정" })).toBeVisible();

    await panel.getByRole("button", { name: "계정 발급" }).click();
    // 쪽지는 관리자 화면 언어와 무관하게 항상 베트남어다(D5, R10) — 관리자는 한국어로 로그인했지만
    // 쪽지의 aria-label은 vi 문구("Giấy hướng dẫn cho KTV")로 그려진다.
    const notice = panel.getByRole("region", { name: "Giấy hướng dẫn cho KTV" });
    await expect(notice).toBeVisible();
    // 발급 직후에만 보이는 임시 비밀번호(D5) — 화면에서 그대로 읽어 그 값으로 로그인한다.
    const temporaryPassword = await notice.locator("p.text-2xl.font-bold.tabular-nums").innerText();
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(8);
    await expect(notice.getByText(ISSUED_ACCOUNT_ID, { exact: true })).toBeVisible();

    const therapistContext = await browser.newContext();
    try {
      const therapistPage = await therapistContext.newPage();
      await login(therapistPage, ISSUED_ACCOUNT_ID, temporaryPassword);
      // 비밀번호 변경 필요 표시 때문에 Therapist 첫 화면이 아니라 비밀번호 변경 화면으로 보내진다(M17).
      await expect(therapistPage).toHaveURL(/\/therapist\/password$/);

      // 변경 전에는 다른 Therapist 탭 주소(근태)를 직접 열어도 같은 자리로 막힌다.
      await therapistPage.goto("/therapist/attendance");
      await expect(therapistPage).toHaveURL(/\/therapist\/password$/);

      await therapistPage.getByLabel("지금 비밀번호").fill(temporaryPassword);
      await therapistPage.getByLabel("새 비밀번호").fill("NewTherapist12345!");
      await therapistPage.getByRole("button", { name: "비밀번호 바꾸기" }).click();

      await expect(therapistPage).toHaveURL(/\/therapist$/);
      await expect(therapistPage.getByRole("heading", { name: "오늘", level: 1 })).toBeVisible();

      // 바뀐 비밀번호로 다시 로그인하면(표시가 꺼졌으니) 바로 오늘 화면으로 간다.
      const relogPage = await therapistContext.newPage();
      await login(relogPage, ISSUED_ACCOUNT_ID, "NewTherapist12345!");
      await expect(relogPage).toHaveURL(/\/therapist$/);
    } finally {
      await therapistContext.close();
    }
  });

  test("퇴사로 바꾸면 이미 로그인해 있던 세션이 다음 요청에서 로그인 화면으로 간다", async ({ page, browser }) => {
    const therapistContext = await browser.newContext();
    try {
      const therapistPage = await therapistContext.newPage();
      await login(therapistPage, RETIRE_ACCOUNT_ID, RETIRE_PASSWORD);
      await expect(therapistPage).toHaveURL(/\/therapist$/);

      await login(page, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
      await page.goto("/masters/employees");
      const panel = await openMasterPanelByRowText(page, RETIRE_STAFF_CODE);
      await pickListboxOptionByValue(panel.getByLabel("재직상태"), "퇴사");
      await panel.getByRole("button", { name: "프로필 저장" }).click();
      await expect(panel.getByText("저장되었습니다.")).toBeVisible();

      // 이미 로그인해 있던 세션도 다음 요청(화면 다시 열기)에서 로그인 화면으로 간다(D4, M20).
      await therapistPage.goto("/therapist");
      await expect(therapistPage).toHaveURL(/\/sign-in/);
    } finally {
      await therapistContext.close();
    }
  });
});
