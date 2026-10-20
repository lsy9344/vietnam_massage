import { expect, test } from "@playwright/test";
import { testEmployees } from "./support/test-employees";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 08: 휴무 신청과 승인함(스펙 D22, D24, M5, M18, M24).
 *
 * 관리자·정산 담당·카운터 베이스라인 계정은 scripts/seed-dev-accounts.ts가 이미 만든다. Therapist
 * 계정 하나는 이 스펙이 직접 시드한다. 날짜는 다른 스펙과 겹치지 않는 먼 날짜(README 공통 규칙,
 * "2042-08"처럼 티켓 번호를 월에 쓴다)를 써서 "앞으로의 날짜" 조건을 실행 시점과 무관하게 만든다.
 */
const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";
const SETTLEMENT_ACCOUNT_ID = "settlement_manager";
const SETTLEMENT_PASSWORD = "Story12!settlement_manager";
const COUNTER_ACCOUNT_ID = "counter";
const COUNTER_PASSWORD = "Story12!counter";

const STAFF_CODE = "E2E08-THR-001";
const ACCOUNT_ID = "story08_mine";
const PASSWORD = "Story08!mine";
const DISPLAY_NAME = "E2E08 근태 Therapist";

const MONTH_KEY = "2042-08";
const APPROVE_DATE = "2042-08-15";
const REJECT_DATE = "2042-08-16";
const CANCEL_DATE = "2042-08-17";
const SPECIAL_DATE = "2042-08-18";

let employeeId = "";

// src/components/therapist/therapist-attendance-calendar.tsx의 formatFullDate와 같은 모양(로그인은
// ko 쿠키를 강제한다). aria-label이 이 문자열로 시작하므로 ^로 앵커해 "1일"이 "15일"과 섞이지 않게 한다.
function formatFullDateKo(isoDate: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(
    new Date(`${isoDate}T00:00:00.000Z`)
  );
}

function dayCellName(isoDate: string): RegExp {
  return new RegExp(`^${formatFullDateKo(isoDate)}`);
}

// 승인함 카드의 날짜 캡슐(request-workspace.tsx의 formatRequestDate)과 같은 모양(weekday 없음).
// 상태 글자("대기" 등)로 카드를 찾으면 그 카드를 거절·승인한 뒤 상태 글자가 바뀌어 다시 못 찾는다
// — 날짜는 바뀌지 않으므로 이 문자열로 카드를 고정해 찾는다.
function requestCardDateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

async function openDay(page: import("@playwright/test").Page, isoDate: string) {
  await page.goto(`/therapist/attendance?month=${MONTH_KEY}`);
  await page
    .getByRole("grid")
    .getByRole("button", { name: dayCellName(isoDate) })
    .click();
  return page.getByRole("dialog");
}

async function seedTherapistAccount() {
  // R27: testEmployees.upsert()(01·02·10·12와 같은 헬퍼)가 공유 DB에서 sortOrder가 이미 쓰였으면
  // 빈 자리를 찾는다(P2002 방지).
  const employee = await testEmployees.upsert({
    where: { staffCode: STAFF_CODE },
    update: { displayName: DISPLAY_NAME, employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
    create: {
      staffCode: STAFF_CODE,
      displayName: DISPLAY_NAME,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      // 98080대(README 공통 규칙: 98NN0, 티켓 08).
      sortOrder: 98080,
      isActive: true
    }
  });
  const passwordHash = await hash(PASSWORD, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: ACCOUNT_ID },
    update: { passwordHash, role: "therapist", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: { email: `${ACCOUNT_ID}@example.local`, accountId: ACCOUNT_ID, passwordHash, role: "therapist", employeeId: employee.id, isActive: true }
  });
  return employee.id;
}

test.describe("티켓 08 휴무 신청과 승인함", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    employeeId = await seedTherapistAccount();
  });

  test.afterAll(async () => {
    await (prisma as any).therapistRequest.deleteMany({ where: { employeeId } });
    await (prisma as any).plannedWorkingDay.deleteMany({ where: { employeeId } });
    await (prisma as any).userAccount.updateMany({ where: { accountId: ACCOUNT_ID }, data: { isActive: false, lockedUntil: null, failedLoginCount: 0 } });
    await (prisma as any).employee.updateMany({ where: { staffCode: STAFF_CODE }, data: { isActive: false } });
    await prisma.$disconnect();
  });

  test("신청 → 승인(settlement_manager) → 근무표 휴무 → 근태 탭에 반영된다", async ({ browser }) => {
    const therapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    await login(therapistPage, ACCOUNT_ID, PASSWORD);

    const dialog = await openDay(therapistPage, APPROVE_DATE);
    await expect(dialog.getByText("신청", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "휴무 신청" }).click();
    await dialog.getByLabel("사유(선택)").fill("개인 사정으로 쉬고 싶습니다.");
    await dialog.getByRole("button", { name: "신청 보내기" }).click();
    await expect(dialog.getByRole("button", { name: "신청 취소" })).toBeVisible();
    await dialog.getByRole("button", { name: "닫기" }).click();
    await therapistContext.close();

    // 승인함: payout:write라 settlement_manager도 연다(M18, 공지와 다른 점).
    const settlementContext = await browser.newContext();
    const settlementPage = await settlementContext.newPage();
    await login(settlementPage, SETTLEMENT_ACCOUNT_ID, SETTLEMENT_PASSWORD);
    await settlementPage.goto("/settlements/requests");
    await expect(settlementPage.getByRole("heading", { name: "승인함", level: 1 })).toBeVisible();

    const requestCard = settlementPage.locator("li").filter({ hasText: requestCardDateLabel(APPROVE_DATE) });
    await expect(requestCard).toBeVisible();
    await expect(requestCard.getByText("개인 사정으로 쉬고 싶습니다.")).toBeVisible();
    await requestCard.getByRole("button", { name: "승인" }).click();
    await expect(requestCard.getByText("승인", { exact: true }).first()).toBeVisible();
    await expect(requestCard.getByRole("button", { name: "승인" })).toHaveCount(0);
    await settlementContext.close();

    // 근무표: 그날이 휴무가 됐다(근무표 화면, 관리자).
    const cell = await (prisma as any).plannedWorkingDay.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: new Date(`${APPROVE_DATE}T00:00:00.000Z`) } }
    });
    expect(cell?.planStatus).toBe("휴무");

    // Therapist 근태 탭: 그 날짜가 휴무·승인으로 보이고, 더는 취소 버튼이 없다(승인 뒤라 건드릴 수 없다).
    const recheckContext = await browser.newContext();
    const recheckPage = await recheckContext.newPage();
    await login(recheckPage, ACCOUNT_ID, PASSWORD);
    const recheckDialog = await openDay(recheckPage, APPROVE_DATE);
    await expect(recheckDialog.getByText("휴무", { exact: true }).first()).toBeVisible();
    await expect(recheckDialog.getByRole("button", { name: "신청 취소" })).toHaveCount(0);
    await expect(recheckDialog.getByRole("button", { name: "휴무 신청" })).toHaveCount(0);
    await recheckContext.close();
  });

  test("거절에는 사유가 필수이고, 거절 사유는 근태 탭에 보인다", async ({ browser }) => {
    const therapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    await login(therapistPage, ACCOUNT_ID, PASSWORD);
    const dialog = await openDay(therapistPage, REJECT_DATE);
    await dialog.getByRole("button", { name: "휴무 신청" }).click();
    await dialog.getByRole("button", { name: "신청 보내기" }).click();
    await expect(dialog.getByRole("button", { name: "신청 취소" })).toBeVisible();
    await therapistContext.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await adminPage.goto("/settlements/requests");
    const requestCard = adminPage.locator("li").filter({ hasText: requestCardDateLabel(REJECT_DATE) });
    await requestCard.getByRole("button", { name: "거절" }).click();
    // 사유 없이 거절하면 거절되지 않는다(D22·D23 필수).
    await requestCard.getByRole("button", { name: "거절 확정" }).click();
    await expect(requestCard.getByRole("button", { name: "거절 확정" })).toBeVisible();

    await requestCard.getByLabel("거절 사유").fill("그날은 예약이 많습니다.");
    await requestCard.getByRole("button", { name: "거절 확정" }).click();
    await expect(requestCard.getByText("거절", { exact: true }).first()).toBeVisible();
    await adminContext.close();

    const recheckContext = await browser.newContext();
    const recheckPage = await recheckContext.newPage();
    await login(recheckPage, ACCOUNT_ID, PASSWORD);
    const recheckDialog = await openDay(recheckPage, REJECT_DATE);
    await expect(recheckDialog.getByText("거절 사유: 그날은 예약이 많습니다.")).toBeVisible();
    // 거절된 날은 근무표가 바뀌지 않아 다시 신청할 수 있다.
    await expect(recheckDialog.getByRole("button", { name: "휴무 신청" })).toBeVisible();
    await recheckContext.close();
  });

  test("승인 전에는 Therapist가 신청을 취소할 수 있다", async ({ page }) => {
    await login(page, ACCOUNT_ID, PASSWORD);
    const dialog = await openDay(page, CANCEL_DATE);
    await dialog.getByRole("button", { name: "휴무 신청" }).click();
    await dialog.getByRole("button", { name: "신청 보내기" }).click();
    await expect(dialog.getByRole("button", { name: "신청 취소" })).toBeVisible();
    await dialog.getByRole("button", { name: "신청 취소" }).click();
    await dialog.getByRole("button", { name: "닫기" }).click();

    const request = await (prisma as any).therapistRequest.findFirst({
      where: { employeeId, targetDate: new Date(`${CANCEL_DATE}T00:00:00.000Z`) }
    });
    expect(request?.status).toBe("취소");
  });

  test("390px 폭에서 신청 폼이 열려도 근태 탭은 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNT_ID, PASSWORD);
    const dialog = await openDay(page, CANCEL_DATE);
    await dialog.getByRole("button", { name: "휴무 신청" }).click();
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });

  test("카운터와 therapist 역할이 승인 액션을 직접 부르면 거절된다", async ({ browser }) => {
    // 승인 대상: 관리자 승인 전 새 신청을 하나 만든다(앞 테스트들과 겹치지 않는 자리).
    await (prisma as any).therapistRequest.create({
      data: { employeeId, kind: "휴무", targetDate: new Date("2042-08-20T00:00:00.000Z"), status: "대기" }
    });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
      await adminPage.goto("/settlements/requests");

      const requestCard = adminPage.locator("li").filter({ hasText: requestCardDateLabel("2042-08-20") });
      const actionRequest = adminPage.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]));
      await requestCard.getByRole("button", { name: "승인" }).click();
      const captured = await actionRequest;
      const capturedUrl = captured.url();
      const capturedHeaders = captured.headers();
      const capturedBody = captured.postData();
      expect(capturedBody).not.toBeNull();

      // 관리자 자신의 승인은 성공한다.
      await expect.poll(async () => {
        const row = await (prisma as any).therapistRequest.findFirst({ where: { employeeId, targetDate: new Date("2042-08-20T00:00:00.000Z") } });
        return row?.status;
      }).toBe("승인");

      for (const replaySession of [
        { accountId: COUNTER_ACCOUNT_ID, password: COUNTER_PASSWORD },
        { accountId: ACCOUNT_ID, password: PASSWORD }
      ]) {
        const replayContext = await browser.newContext();
        try {
          const replayPage = await replayContext.newPage();
          await login(replayPage, replaySession.accountId, replaySession.password);
          await replayPage.close();

          const replayHeaders = { ...capturedHeaders };
          delete replayHeaders["cookie"];
          delete replayHeaders["content-length"];
          delete replayHeaders["host"];

          const response = await replayContext.request.post(capturedUrl, { headers: replayHeaders, data: capturedBody as string });
          void response;
        } finally {
          await replayContext.close();
        }
      }

      // 거절된 신청(이미 승인됨)을 다시 승인하려 해도 상태가 그대로다 — 거절 확인.
      const row = await (prisma as any).therapistRequest.findFirst({ where: { employeeId, targetDate: new Date("2042-08-20T00:00:00.000Z") } });
      expect(row?.status).toBe("승인");
    } finally {
      await adminContext.close();
    }
  });

  test("소중한날 휴가 신청·승인 후 달력에 이름과 붉은 표시가 보인다", async ({ browser }, testInfo) => {
    const therapistContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await therapistContext.newPage();
    await login(page, ACCOUNT_ID, PASSWORD);
    const dialog = await openDay(page, SPECIAL_DATE);
    await dialog.getByRole("button", { name: "휴무 신청" }).click();
    await dialog.getByLabel("휴가 종류").selectOption("special_day_off");
    await dialog.getByRole("button", { name: "신청 보내기" }).click();
    await expect(dialog.getByRole("button", { name: "신청 취소" })).toBeVisible();

    const managerContext = await browser.newContext();
    const manager = await managerContext.newPage();
    await login(manager, SETTLEMENT_ACCOUNT_ID, SETTLEMENT_PASSWORD);
    await manager.goto("/settlements/requests");
    const card = manager.locator("li").filter({ hasText: requestCardDateLabel(SPECIAL_DATE) });
    await expect(card.getByText("소중한날 휴가")).toBeVisible();
    await card.getByRole("button", { name: "승인", exact: true }).click();
    await expect.poll(async () => {
      const request = await prisma.therapistRequest.findFirst({ where: { employeeId, targetDate: new Date(`${SPECIAL_DATE}T00:00:00.000Z`) } });
      return request?.status;
    }).toBe("승인");
    await expect(card.getByRole("button", { name: "승인", exact: true })).toHaveCount(0);

    await page.goto(`/therapist/attendance?month=${MONTH_KEY}`);
    const cell = page.getByRole("grid").getByRole("button", { name: dayCellName(SPECIAL_DATE) });
    await expect(cell).toHaveAccessibleName(/소중한날 휴가/);
    await expect(cell).toHaveClass(/border-danger/);
    // 기호는 U+FE0E로 이모지 대신 글자 모양을 강제한다(R18, statusGlyphChar) — "■" 바로 뒤에 보이지
    // 않는 그 글자가 끼어 있다.
    await expect(page.getByText("■︎ 소중한날 휴가")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("special-day-off-mobile.png") });
    await cell.click();
    await expect(page.getByRole("dialog").getByText("소중한날 휴가", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "휴무 신청" })).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();
    await therapistContext.addCookies([{ name: "locale", value: "vi", url: new URL(page.url()).origin }]);
    await page.reload();
    // R18: 기호는 U+FE0E로 이모지 대신 글자 모양을 강제한다(statusGlyphChar) — "■" 바로 뒤에
    // 보이지 않는 그 글자가 끼어 있다.
    await expect(page.getByText("■︎ Nghỉ ngày đặc biệt")).toBeVisible();
    await managerContext.close();
    await therapistContext.close();
  });

});
