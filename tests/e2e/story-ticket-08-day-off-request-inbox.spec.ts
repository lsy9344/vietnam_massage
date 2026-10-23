import { expect, test } from "@playwright/test";
import { testEmployees } from "./support/test-employees";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { pickListboxOption, pickListboxOptionByValue } from "./support/listbox-select";

/**
 * 티켓 08: 휴무와 승인함(스펙 D22, D24, M5, M18, M24). 2026-10-23 고객 요청으로 Therapist가 직접
 * 휴무를 신청하지 않고, 카운터가 휴무 등록 화면(/day-offs)에서 기간으로 등록한다. 승인함은 정정 요청과
 * 그 전에 들어와 있던 휴무 신청을 그대로 처리한다.
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

const WAITER_ACCOUNT_ID = "waiter";
const WAITER_PASSWORD = "Story12!waiter";

const MONTH_KEY = "2042-08";
/** 카운터가 등록하는 소중한날 휴가 5일(2042-08-11 ~ 08-15). */
const SPECIAL_START = "2042-08-11";
const SPECIAL_END = "2042-08-15";
const SPECIAL_DATES = ["2042-08-11", "2042-08-12", "2042-08-13", "2042-08-14", "2042-08-15"];
/** 승인함 테스트용(그 전에 들어와 있던 Therapist 휴무 신청을 DB로 넣는다). */
const APPROVE_DATE = "2042-08-20";
const REJECT_DATE = "2042-08-21";

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

async function seedPendingDayOffRequest(targetDate: string, reason: string | null = null) {
  await (prisma as any).therapistRequest.create({
    data: { employeeId, kind: "휴무", targetDate: new Date(`${targetDate}T00:00:00.000Z`), status: "대기", reason }
  });
}

async function cellStatuses(dates: string[]) {
  const rows = await (prisma as any).plannedWorkingDay.findMany({
    where: { employeeId, workDate: { in: dates.map((date) => new Date(`${date}T00:00:00.000Z`)) } }
  });
  return dates.map((date) => rows.find((row: any) => row.workDate.toISOString().slice(0, 10) === date)?.planStatus ?? "미입력");
}

test.describe("티켓 08 휴무 등록과 승인함", () => {
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

  test("카운터가 소중한날 휴가 5일을 한 번에 등록하면 근무표·근태 달력에 보이고, 취소하면 되돌아간다", async ({ browser }, testInfo) => {
    const counterContext = await browser.newContext();
    const counter = await counterContext.newPage();
    await login(counter, COUNTER_ACCOUNT_ID, COUNTER_PASSWORD);
    await counter.goto("/day-offs");
    await expect(counter.getByRole("heading", { name: "휴무 등록", level: 1 })).toBeVisible();

    await pickListboxOption(counter.getByRole("combobox", { name: "Therapist", exact: true }), new RegExp(DISPLAY_NAME));
    await pickListboxOptionByValue(counter.getByLabel("휴가 종류"), "special_day_off");
    await counter.getByLabel("시작일").fill(SPECIAL_START);
    // 시작일에서 5일을 고르면 종료일이 따라온다(소중한날 휴가는 보통 3–5일).
    await counter.getByRole("group", { name: "기간 빠르게 고르기" }).getByRole("button", { name: "5일" }).click();
    await expect(counter.getByLabel("종료일")).toHaveValue(SPECIAL_END);
    await expect(counter.getByText("총 5일")).toBeVisible();
    await counter.getByLabel("사유(선택)").fill("텔레그램으로 확인함");
    await counter.getByRole("button", { name: "휴무 등록", exact: true }).click();
    await expect(counter.getByText(/08\.11~08\.15 휴무를 등록했습니다/)).toBeVisible();

    await expect.poll(() => cellStatuses(SPECIAL_DATES)).toEqual(["휴무", "휴무", "휴무", "휴무", "휴무"]);
    const rows = await (prisma as any).therapistRequest.findMany({ where: { employeeId, status: "승인", kind: "소중한날 휴가" } });
    expect(rows).toHaveLength(5);

    // 목록에 한 등록(5일)으로 보인다.
    const card = counter.locator("li").filter({ hasText: "08.11 ~ 08.15 · 5일" });
    await expect(card).toBeVisible();
    await expect(card.getByText("텔레그램으로 확인함")).toBeVisible();
    expect(await counter.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await counter.screenshot({ path: testInfo.outputPath("day-off-registration.png"), fullPage: true });

    // Therapist 근태 달력: 붉은 표시가 보이고, 신청 버튼 대신 카운터에 알리라는 안내가 있다.
    const therapistContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const therapist = await therapistContext.newPage();
    await login(therapist, ACCOUNT_ID, PASSWORD);
    await therapist.goto(`/therapist/attendance?month=${MONTH_KEY}`);
    const cell = therapist.getByRole("grid").getByRole("button", { name: dayCellName("2042-08-13") });
    await expect(cell).toHaveAccessibleName(/소중한날 휴가/);
    await expect(cell).toHaveClass(/border-danger/);
    await therapist.getByRole("grid").getByRole("button", { name: dayCellName("2042-08-20") }).click();
    const dialog = therapist.getByRole("dialog");
    await expect(dialog.getByText("카운터에 텔레그램으로 알려 주세요", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "휴무 신청" })).toHaveCount(0);
    expect(await therapist.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await therapist.screenshot({ path: testInfo.outputPath("therapist-day-detail-mobile.png") });

    // 카운터가 등록을 취소하면 근무표가 미입력으로 돌아가고 붉은 표시가 사라진다.
    await card.getByRole("button", { name: "등록 취소" }).click();
    await counter.getByRole("alertdialog").getByRole("button", { name: "취소 확정" }).click();
    await expect.poll(() => cellStatuses(SPECIAL_DATES)).toEqual(["미입력", "미입력", "미입력", "미입력", "미입력"]);
    await therapist.goto(`/therapist/attendance?month=${MONTH_KEY}`);
    await expect(therapist.getByRole("grid").getByRole("button", { name: dayCellName("2042-08-13") })).not.toHaveAccessibleName(/소중한날 휴가/);

    await therapistContext.close();
    await counterContext.close();
  });

  test("이미 등록된 휴무와 겹치는 기간은 등록되지 않는다", async ({ page }) => {
    await login(page, COUNTER_ACCOUNT_ID, COUNTER_PASSWORD);
    await page.goto("/day-offs");
    const register = async (kind: string, start: string, end: string) => {
      await pickListboxOption(page.getByRole("combobox", { name: "Therapist", exact: true }), new RegExp(DISPLAY_NAME));
      await pickListboxOptionByValue(page.getByLabel("휴가 종류"), kind);
      await page.getByLabel("시작일").fill(start);
      await page.getByLabel("종료일").fill(end);
      await page.getByRole("button", { name: "휴무 등록", exact: true }).click();
    };
    await register("day_off", "2042-08-25", "2042-08-26");
    await expect(page.getByText(/08\.25~08\.26 휴무를 등록했습니다/)).toBeVisible();
    await register("special_day_off", "2042-08-26", "2042-08-28");
    await expect(page.getByText("이미 휴무가 등록된 날이 있습니다: 08-26")).toBeVisible();
    expect(await cellStatuses(["2042-08-27", "2042-08-28"])).toEqual(["미입력", "미입력"]);
  });

  test("390px 폭에서도 휴무 등록 화면은 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, COUNTER_ACCOUNT_ID, COUNTER_PASSWORD);
    await page.goto("/day-offs");
    await expect(page.getByRole("heading", { name: "휴무 등록", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test("웨이터·Therapist·정산 담당은 휴무 등록 화면에 들어가지 못하고, 등록 액션을 직접 불러도 저장되지 않는다", async ({ browser }) => {
    const counterContext = await browser.newContext();
    const counter = await counterContext.newPage();
    try {
      await login(counter, COUNTER_ACCOUNT_ID, COUNTER_PASSWORD);
      await counter.goto("/day-offs");
      await pickListboxOption(counter.getByRole("combobox", { name: "Therapist", exact: true }), new RegExp(DISPLAY_NAME));
      await counter.getByLabel("시작일").fill("2042-08-29");
      await counter.getByLabel("종료일").fill("2042-08-29");
      const actionRequest = counter.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]));
      await counter.getByRole("button", { name: "휴무 등록", exact: true }).click();
      const captured = await actionRequest;
      const capturedUrl = captured.url();
      const capturedHeaders = captured.headers();
      const capturedBody = captured.postData();
      await expect.poll(() => cellStatuses(["2042-08-29"])).toEqual(["휴무"]);

      // 카운터 자신의 등록을 지우고, 다른 역할로 같은 요청을 다시 보낸다.
      await (prisma as any).therapistRequest.deleteMany({ where: { employeeId, targetDate: new Date("2042-08-29T00:00:00.000Z") } });
      await (prisma as any).plannedWorkingDay.deleteMany({ where: { employeeId, workDate: new Date("2042-08-29T00:00:00.000Z") } });

      for (const session of [
        { accountId: WAITER_ACCOUNT_ID, password: WAITER_PASSWORD },
        { accountId: SETTLEMENT_ACCOUNT_ID, password: SETTLEMENT_PASSWORD },
        { accountId: ACCOUNT_ID, password: PASSWORD }
      ]) {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await login(page, session.accountId, session.password);
          await page.goto("/day-offs");
          await expect(page.getByRole("heading", { name: "휴무 등록", level: 1 })).toHaveCount(0);
          await page.close();
          const headers = { ...capturedHeaders };
          delete headers["cookie"];
          delete headers["content-length"];
          delete headers["host"];
          await context.request.post(capturedUrl, { headers, data: capturedBody as string });
        } finally {
          await context.close();
        }
      }
      expect(await cellStatuses(["2042-08-29"])).toEqual(["미입력"]);
      expect(await (prisma as any).therapistRequest.count({ where: { employeeId, targetDate: new Date("2042-08-29T00:00:00.000Z") } })).toBe(0);
    } finally {
      await counterContext.close();
    }
  });

  test("그 전에 들어와 있던 휴무 신청은 승인함에서 승인(settlement_manager)되고 근무표가 휴무가 된다", async ({ page }) => {
    await seedPendingDayOffRequest(APPROVE_DATE, "개인 사정으로 쉬고 싶습니다.");
    await login(page, SETTLEMENT_ACCOUNT_ID, SETTLEMENT_PASSWORD);
    await page.goto("/settlements/requests");
    await expect(page.getByRole("heading", { name: "승인함", level: 1 })).toBeVisible();
    const requestCard = page.locator("li").filter({ hasText: requestCardDateLabel(APPROVE_DATE) });
    await expect(requestCard.getByText("개인 사정으로 쉬고 싶습니다.")).toBeVisible();
    await requestCard.getByRole("button", { name: "승인" }).click();
    await expect(requestCard.getByRole("button", { name: "승인" })).toHaveCount(0);
    await expect.poll(() => cellStatuses([APPROVE_DATE])).toEqual(["휴무"]);
  });

  test("승인함의 거절에는 사유가 필수이고, 거절 사유는 근태 탭에 보인다", async ({ browser }) => {
    await seedPendingDayOffRequest(REJECT_DATE);
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await adminPage.goto("/settlements/requests");
    const requestCard = adminPage.locator("li").filter({ hasText: requestCardDateLabel(REJECT_DATE) });
    await requestCard.getByRole("button", { name: "거절" }).click();
    await requestCard.getByRole("button", { name: "거절 확정" }).click();
    await expect(requestCard.getByRole("button", { name: "거절 확정" })).toBeVisible();
    await requestCard.getByLabel("거절 사유").fill("그날은 예약이 많습니다.");
    await requestCard.getByRole("button", { name: "거절 확정" }).click();
    await expect(requestCard.getByText("거절", { exact: true }).first()).toBeVisible();
    await adminContext.close();

    const therapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    await login(therapistPage, ACCOUNT_ID, PASSWORD);
    const dialog = await openDay(therapistPage, REJECT_DATE);
    await expect(dialog.getByText("거절 사유: 그날은 예약이 많습니다.")).toBeVisible();
    await therapistContext.close();
  });
});
