import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions } from "./support/auth";

/**
 * i18n: 실제 누락 위험 지점(콜 원장/객실/정산/대시보드)을 베트남어(vi)로 검증한다.
 * 기존 스펙은 ko 쿠키를 강제하므로 이 스펙이 vi 화면 검증의 핵심이다.
 * 쿠키를 설정하지 않으면 기본 locale vi로 동작한다.
 */
const ACCOUNT_ID = "i18n_screens_admin";
const PASSWORD = "I18nScreens!admin";
const MONTH_KEY = "2071-03";

async function seed() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E-I18N-SCREENS" },
    update: { displayName: "i18n screens admin", isActive: true },
    create: {
      staffCode: "E2E-I18N-SCREENS",
      displayName: "i18n screens admin",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 7997,
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
  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: MONTH_KEY },
    update: { startDate: new Date(`${MONTH_KEY}-01T00:00:00.000Z`), endDate: new Date(`${MONTH_KEY}-28T00:00:00.000Z`), status: "작성중" },
    create: {
      monthKey: MONTH_KEY,
      startDate: new Date(`${MONTH_KEY}-01T00:00:00.000Z`),
      endDate: new Date(`${MONTH_KEY}-28T00:00:00.000Z`),
      status: "작성중"
    }
  });
  return { monthId: month.id, serviceDate: `${MONTH_KEY}-10` };
}

let seeded: { monthId: string; serviceDate: string };

/** vi 기본(쿠키 없음)으로 로그인한다. 라벨이 베트남어이므로 vi locator를 쓴다. */
async function loginVi(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email hoặc ID tài khoản").fill(ACCOUNT_ID);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  const credentials = page
    .waitForResponse((r) => r.url().includes("/api/auth/callback/credentials") && r.request().method() === "POST", { timeout: 15_000 })
    .catch(() => undefined);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await credentials;
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 }).catch(() => undefined);
}

test.describe("i18n 업무 화면 베트남어(vi)", () => {
  test.beforeAll(async () => {
    seeded = await seed();
  });

  test("객실 현황 화면이 베트남어로 보인다", async ({ page }) => {
    await loginVi(page);
    await page.goto(`/rooms?operatingMonthId=${seeded.monthId}&serviceDate=${seeded.serviceDate}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    // 조회 컨트롤 + 객실 상태 영역 라벨이 vi.
    await expect(page.getByLabel("Tháng vận hành")).toBeVisible();
    await expect(page.getByLabel("Ngày tra cứu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tra cứu" })).toBeVisible();
    // 한국어 조회 라벨이 남아 있지 않다.
    await expect(page.getByText("운영월 상태")).toHaveCount(0);
  });

  test("콜 원장 그리드 컬럼 헤더가 베트남어로 보인다", async ({ page }) => {
    await loginVi(page);
    await page.goto(`/calls?operatingMonthId=${seeded.monthId}&serviceDate=${seeded.serviceDate}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    // 그리드 컬럼 헤더(객실/코스/결제수단 등)가 vi.
    await expect(page.getByRole("columnheader", { name: "Phòng" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Gói dịch vụ" }).first()).toBeVisible();
    // 새 콜 행 추가 버튼 vi.
    await expect(page.getByRole("button", { name: "Thêm dòng cuộc gọi mới" })).toBeVisible();
  });

  test("오늘 대시보드 KPI 라벨이 베트남어로 보인다", async ({ page }) => {
    await loginVi(page);
    await page.goto(`/dashboard/today?operatingMonthId=${seeded.monthId}&serviceDate=${seeded.serviceDate}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    // 콜이 없으면 빈 상태(번역됨)와 0값 KPI가 함께 보인다 — 둘 다 vi 문구.
    await expect(page.getByText("Không có cuộc gọi nào trong ngày này").first()).toBeVisible();
    await expect(page.getByText("Tổng thanh toán").first()).toBeVisible();
    // 한국어 KPI 제목이 남아 있지 않다.
    await expect(page.getByText("오늘 상태 건수")).toHaveCount(0);
  });

  test("정산 화면이 베트남어로 보인다", async ({ page }) => {
    await loginVi(page);
    await page.goto(`/settlements?operatingMonthId=${seeded.monthId}&serviceDate=${seeded.serviceDate}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    // 조회 컨트롤 vi.
    await expect(page.getByLabel("Tháng vận hành")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tra cứu" })).toBeVisible();
  });
});
