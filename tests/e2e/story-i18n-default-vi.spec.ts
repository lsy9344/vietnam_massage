import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions } from "./support/auth";

/**
 * i18n: 쿠키가 없으면 기본 화면 언어가 베트남어(vi)임을 검증한다.
 * 로그인 화면과 로그인 후 사이드바가 베트남어로 보여야 한다.
 * (다른 스펙들은 ko 쿠키를 강제하므로, 이 스펙이 vi 기본 동작의 유일한 증명이다.)
 */
const ACCOUNT_ID = "i18n_vi_admin";
const PASSWORD = "I18nVi!admin";

async function seedAdmin() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E-I18N-VI" },
    update: { displayName: "i18n vi admin", isActive: true },
    create: {
      staffCode: "E2E-I18N-VI",
      displayName: "i18n vi admin",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 7999,
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

test.describe("i18n 기본 베트남어(vi)", () => {
  test.beforeAll(async () => {
    await seedAdmin();
  });

  test("쿠키 없이 접속하면 로그인 화면이 베트남어로 보인다", async ({ page }) => {
    await page.goto("/sign-in");
    // <html lang>이 vi다.
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    // 베트남어 라벨/버튼.
    await expect(page.getByLabel("Email hoặc ID tài khoản")).toBeVisible();
    await expect(page.getByLabel("Mật khẩu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
    // 한국어 라벨은 보이지 않는다.
    await expect(page.getByText("이메일 또는 계정 ID")).toHaveCount(0);
  });

  test("베트남어로 로그인하면 사이드바가 베트남어로 보인다", async ({ page }) => {
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

    // 사이드바 메뉴(aria-label)와 그룹 헤딩이 베트남어다.
    const menu = page.getByRole("navigation", { name: "Menu nghiệp vụ ERP" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("heading", { name: "Tình hình vận hành", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Tình trạng phòng" })).toBeVisible();
    // 한국어 그룹명은 없다.
    await expect(menu.getByRole("heading", { name: "운영 현황", exact: true })).toHaveCount(0);
  });
});
