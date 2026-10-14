import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions } from "./support/auth";

/**
 * i18n: 로그인 화면과 "나" 메뉴의 언어 전환 버튼으로 vi ↔ ko 전환이 동작하고, 새로고침해도 선택이 유지됨을 검증한다.
 */
const ACCOUNT_ID = "i18n_switch_admin";
const PASSWORD = "I18nSwitch!admin";

async function seedAdmin() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E-I18N-SWITCH" },
    update: { displayName: "i18n switch admin", isActive: true },
    create: {
      staffCode: "E2E-I18N-SWITCH",
      displayName: "i18n switch admin",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 7998,
      isActive: true
    }
  });
  const passwordHash = await hash(PASSWORD, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: ACCOUNT_ID },
    update: { passwordHash, role: "administrator", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${ACCOUNT_ID}@example.local`,
      accountId: ACCOUNT_ID,
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

test.describe("i18n 언어 전환", () => {
  test.beforeAll(async () => {
    await seedAdmin();
  });

  test("로그인 화면에서 한국어로 전환하면 한국어 라벨이 보이고 다시 vi로 돌아온다", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByLabel("Email hoặc ID tài khoản")).toBeVisible();

    // 한국어로 전환.
    await page.getByRole("button", { name: "한국어" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.getByLabel("이메일 또는 계정 ID")).toBeVisible();

    // 새로고침해도 ko 유지(쿠키 저장).
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.getByLabel("이메일 또는 계정 ID")).toBeVisible();

    // 다시 베트남어로 전환.
    await page.getByRole("button", { name: "Tiếng Việt" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByLabel("Email hoặc ID tài khoản")).toBeVisible();
  });

  test("로그인 후 나 메뉴에서 한국어로 전환하면 도크가 한국어로 바뀐다", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email hoặc ID tài khoản").fill(ACCOUNT_ID);
    await page.getByLabel("Mật khẩu").fill(PASSWORD);
    const credentialsResponse = page
      .waitForResponse(
        (response) => response.url().includes("/api/auth/callback/credentials") && response.request().method() === "POST",
        { timeout: 15_000 }
      )
      .catch(() => undefined);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await credentialsResponse;
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 }).catch(() => undefined);

    // 로그인 후 베트남어 도크.
    await expect(page.getByRole("navigation", { name: "Chuyển khu vực nghiệp vụ" })).toBeVisible();

    // "나" 메뉴의 언어 전환으로 한국어 전환.
    await page.getByRole("button", { name: "Tôi", exact: true }).click();
    await page.getByRole("button", { name: "한국어" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    const dock = page.getByRole("navigation", { name: "업무 이동" });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("link", { name: "현장", exact: true })).toBeVisible();
  });
});
