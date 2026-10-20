import { expect, test, type Page } from "@playwright/test";
import { testEmployees } from "./support/test-employees";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 01: therapist 역할과 빈 Therapist 화면.
 *
 * E2E 시드 계정: accountId "therapist" / 비밀번호 "Story12!therapist"(scripts/seed-dev-accounts.ts와 같은
 * 계정). support/auth.ts의 login()이 역할과 무관하게 그대로 동작하므로 뒤 티켓(02–12)도 이 계정을
 * 그대로 쓰거나, 같은 방식으로 자기 전용 Therapist 계정을 시드하면 된다.
 */
const THERAPIST_ACCOUNT_ID = "therapist";
const THERAPIST_PASSWORD = "Story12!therapist";
const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";

// 98NN0대(스펙 README): 티켓 01이라 980xx.
const THERAPIST_STAFF_CODE = "E2E-T01-THR-1";
const SORT_TARGET_STAFF_CODE = "E2E-T01-OPS-1";
const SORT_TARGET_DISPLAY_NAME = "T01 임시직원";

// R26: 공용 계정 "therapist"의 원래 연결(scripts/seed-dev-accounts.ts). 이 스펙이 테스트 동안
// THERAPIST_STAFF_CODE로 다시 연결하므로, afterAll에서 이 직원으로 되돌려야 01 뒤에 도는 스펙(05 등)이
// "활성 Therapist 없음"으로 실패하지 않는다 — deactivateAll()이 THERAPIST_STAFF_CODE 직원을 비활성화
// 하는데, 계정이 그 직원에 그대로 묶여 있으면 그 계정 전체가 비활성 Therapist로 막힌다.
const SEED_THERAPIST_STAFF_CODE = "THR-E2E-001";

async function restoreTherapistAccountLink() {
  const seedEmployee = await (prisma as any).employee.findUnique({ where: { staffCode: SEED_THERAPIST_STAFF_CODE } });
  if (!seedEmployee) return;
  await (prisma as any).userAccount.update({
    where: { accountId: THERAPIST_ACCOUNT_ID },
    data: { employeeId: seedEmployee.id, role: "therapist", isActive: true, lockedUntil: null, failedLoginCount: 0 }
  });
}

let therapistAccountDbId = "";
let sortTargetEmployeeId = "";

async function seedTherapistAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: THERAPIST_STAFF_CODE },
    update: { displayName: "T01 Therapist", employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
    create: {
      staffCode: THERAPIST_STAFF_CODE,
      displayName: "T01 Therapist",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      phone: "0901112222",
      employmentStatus: "재직",
      sortOrder: 98010,
      isActive: true
    }
  });
  const passwordHash = await hash(THERAPIST_PASSWORD, argon2idOptions);
  const account = await (prisma as any).userAccount.upsert({
    where: { accountId: THERAPIST_ACCOUNT_ID },
    update: { passwordHash, role: "therapist", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${THERAPIST_ACCOUNT_ID}@example.local`,
      accountId: THERAPIST_ACCOUNT_ID,
      passwordHash,
      role: "therapist",
      employeeId: employee.id,
      isActive: true
    }
  });
  therapistAccountDbId = account.id;
}

async function seedAdminAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: "E2E-T01-ADMIN" },
    update: { displayName: "T01 관리자", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: "E2E-T01-ADMIN",
      displayName: "T01 관리자",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 98011,
      isActive: true
    }
  });
  const passwordHash = await hash(ADMIN_PASSWORD, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: ADMIN_ACCOUNT_ID },
    update: { passwordHash, role: "administrator", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${ADMIN_ACCOUNT_ID}@example.local`,
      accountId: ADMIN_ACCOUNT_ID,
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true
    }
  });
}

/** 서버 액션 요청 잡기(3번 확인)에서 값을 바꿔 보낼 대상 직원. 관리자만 고칠 수 있는 정렬 순서를 쓴다. */
async function seedSortTargetEmployee() {
  const employee = await testEmployees.upsert({
    where: { staffCode: SORT_TARGET_STAFF_CODE },
    update: { displayName: SORT_TARGET_DISPLAY_NAME, employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: SORT_TARGET_STAFF_CODE,
      displayName: SORT_TARGET_DISPLAY_NAME,
      employeeGroup: "OPERATIONS",
      position: "웨이터",
      shiftType: "주간",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 98012,
      isActive: true
    }
  });
  sortTargetEmployeeId = employee.id;
}

/**
 * 기본 locale(vi)으로 로그인한다. support/auth.ts의 login()은 한국어 라벨을 locator로 쓰는 기존
 * 스펙을 위해 ko 쿠키를 강제하므로, 베트남어 기본 동작을 확인하는 이 티켓의 1번 검증에는 쓰지 않는다
 * (story-i18n-default-vi.spec.ts와 같은 수동 절차).
 */
async function loginVi(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email hoặc ID tài khoản").fill(accountId);
  await page.getByLabel("Mật khẩu").fill(password);
  const credentialsResponse = page
    .waitForResponse((response) => response.url().includes("/api/auth/callback/credentials") && response.request().method() === "POST", {
      timeout: 15_000
    })
    .catch(() => undefined);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await credentialsResponse;
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 }).catch(() => undefined);
}

/**
 * multipart/form-data 본문에서 한 필드의 값만 바꾼다. 나머지 파트(Next.js 내부 상태 포함)는 그대로 둔다.
 * useActionState로 묶인 서버 액션은 필드 이름 앞에 "_1_" 같은 접두사를 붙이므로 끝만 맞춰 찾는다.
 */
function replaceMultipartField(body: string, fieldName: string, nextValue: string) {
  const pattern = new RegExp(`(Content-Disposition: form-data; name="[^"]*${fieldName}"\\r\\n\\r\\n)([^\\r\\n]*)(\\r\\n)`);
  const replaced = body.replace(pattern, (_match, head: string, _value: string, tail: string) => `${head}${nextValue}${tail}`);
  if (replaced === body) {
    throw new Error(`필드 ${fieldName}을 캡처한 본문에서 찾지 못했다`);
  }
  return replaced;
}

test.describe("티켓 01 therapist 역할과 빈 Therapist 화면", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedTherapistAccount();
    await seedAdminAccount();
    await seedSortTargetEmployee();
  });

  test.afterAll(async () => {
    // R26: 공용 계정을 원래 직원(THR-E2E-001)으로 되돌린 다음에 이 스펙이 만든 직원을 비활성화한다 —
    // 순서를 바꾸면 그 사이 짧게라도 계정이 비활성 직원에 묶인다.
    await restoreTherapistAccountLink();
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("시드 계정으로 로그인하면 베트남어 빈 Therapist 오늘 화면이 뜬다", async ({ page }) => {
    await loginVi(page, THERAPIST_ACCOUNT_ID, THERAPIST_PASSWORD);
    await expect(page).toHaveURL(/\/therapist$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByRole("heading", { name: "Hôm nay", level: 1 })).toBeVisible();
    // 아래 탭 네 개가 베트남어로 보인다. 공지 탭에는 지금 읽지 않은 수가 없어 자리만 비어 있다.
    const tabBar = page.getByRole("navigation", { name: "Di chuyển màn hình KTV" });
    await expect(tabBar.locator("[data-therapist-tab]")).toHaveText(["Hôm nay", "Chấm công", "Thu nhập", "Thông báo"]);
    // "나" 메뉴에 이름·직원 코드·전화번호가 보인다(D9).
    await page.getByRole("button", { name: "Tôi" }).click();
    await expect(page.getByText("Mã nhân viên E2E-T01-THR-1")).toBeVisible();
    await expect(page.getByText("Số điện thoại 0901112222")).toBeVisible();
    // 오늘 탭 내용은 티켓 03이 채웠다 — 오늘 현황 카드가 보인다("준비 중" 빈 자리는 근태·수당·공지만 남았다).
    await expect(page.getByText("Đã làm hôm nay")).toBeVisible();
  });

  const opsUrls = ["/live", "/calls", "/tv", "/masters/employees"];
  for (const opsUrl of opsUrls) {
    test(`운영팀 화면 주소 ${opsUrl}을 열면 되돌이 없이 Therapist 첫 화면으로 보내진다`, async ({ page }) => {
      await login(page, THERAPIST_ACCOUNT_ID, THERAPIST_PASSWORD);
      await page.goto(opsUrl);
      await expect(page).toHaveURL(/\/therapist$/);
      await expect(page.getByRole("heading", { name: "오늘", level: 1 })).toBeVisible();
      // 되돌이가 없다: 같은 화면에 그대로 머문다(다시 어딘가로 튕기지 않음).
      await page.waitForTimeout(300);
      await expect(page).toHaveURL(/\/therapist$/);
    });
  }

  test("390px 폭에서 Therapist 오늘 화면은 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, THERAPIST_ACCOUNT_ID, THERAPIST_PASSWORD);
    await page.goto("/therapist");
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });

  test("운영팀 서버 액션(직원 정렬 순서 변경)을 therapist 세션 쿠키로 다시 보내면 거절된다", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
      await adminPage.goto("/masters/employees");
      await adminPage.getByRole("button", { name: new RegExp(SORT_TARGET_DISPLAY_NAME) }).click();
      const sortOrderField = adminPage.getByLabel("정렬 순서", { exact: true });
      await sortOrderField.fill("98013");

      const actionRequest = adminPage.waitForRequest(
        (request) => request.method() === "POST" && Boolean(request.headers()["next-action"])
      );
      await adminPage.getByRole("button", { name: "순서 저장" }).click();
      const captured = await actionRequest;
      const capturedUrl = captured.url();
      const capturedHeaders = captured.headers();
      const capturedBody = captured.postData();
      expect(capturedBody).not.toBeNull();

      // 관리자 자신의 요청은 그대로 성공해 정렬 순서가 바뀐다.
      await expect
        .poll(async () => (await prisma.employee.findUnique({ where: { id: sortTargetEmployeeId } }))?.sortOrder)
        .toBe(98013);
      const auditCountBeforeReplay = await (prisma as any).auditLog.count({
        where: { targetType: "employee", targetId: sortTargetEmployeeId, action: "employee.sort_order_changed" }
      });

      // 같은 요청을 therapist 세션 쿠키로, 다른 값(98014)을 넣어 다시 보낸다. 받아들여지면 98014로
      // 바뀌고 새 감사 기록(actorId=therapist)이 남지만, 거절되면 둘 다 그대로다.
      const therapistContext = await browser.newContext();
      try {
        const therapistPage = await therapistContext.newPage();
        await login(therapistPage, THERAPIST_ACCOUNT_ID, THERAPIST_PASSWORD);
        await therapistPage.close();

        const replayHeaders = { ...capturedHeaders };
        delete replayHeaders["cookie"];
        delete replayHeaders["content-length"];
        delete replayHeaders["host"];
        const replayBody = replaceMultipartField(capturedBody as string, "sortOrder", "98014");

        const response = await therapistContext.request.post(capturedUrl, { headers: replayHeaders, data: replayBody });
        // 리다이렉트를 성공으로 보지 않는다. /sign-in으로 보내졌어도(세션 쿠키 모양이 달라도) 실제로
        // 값이 바뀌지 않았는지가 기준이다.
        void response;
      } finally {
        await therapistContext.close();
      }

      const afterReplay = await prisma.employee.findUnique({ where: { id: sortTargetEmployeeId } });
      expect(afterReplay?.sortOrder).toBe(98013);
      const auditCountAfterReplay = await (prisma as any).auditLog.count({
        where: { targetType: "employee", targetId: sortTargetEmployeeId, action: "employee.sort_order_changed" }
      });
      expect(auditCountAfterReplay).toBe(auditCountBeforeReplay);
      const therapistAuthoredAudit = await (prisma as any).auditLog.findFirst({
        where: { targetType: "employee", targetId: sortTargetEmployeeId, actorId: therapistAccountDbId }
      });
      expect(therapistAuthoredAudit).toBeNull();
    } finally {
      await adminContext.close();
    }
  });
});
