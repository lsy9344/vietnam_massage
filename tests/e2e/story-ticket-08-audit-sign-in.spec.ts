import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import { recordAuditEvent } from "../../src/modules/audit/audit-service";

// 티켓 08: 감사 화면(목록 + 변경 상세 패널, 원본 화면 링크)과 로그인 화면(필드 오류, 언어 전환).

const ADMIN = { accountId: "t08_audit_admin", password: "Ticket08!admin", staffCode: "E2E-T08-ADM", displayName: "T08 감사 관리자" };
// 감사 기록은 지우지 않으므로 실행마다 다른 대상 id를 쓴다.
const RUN = Date.now().toString(36);
const CALL_TARGET_ID = `E2E-T08-CALL-${RUN}`;
const CLOSE_TARGET_ID = `E2E-T08-CLOSE-${RUN}`;
const UNKNOWN_TARGET_ID = `E2E-T08-UNKNOWN-${RUN}`;

async function freeSortOrder(employeeGroup: string, staffCode: string, preferred: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferred; sortOrder < preferred + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({
      where: { employeeGroup, sortOrder, NOT: { staffCode } },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No ticket 08 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAdmin() {
  const employeeFields = {
    displayName: ADMIN.displayName,
    employeeGroup: "OPERATIONS",
    position: "팀장",
    shiftType: "전체",
    baseSalary: 0,
    employmentStatus: "재직",
    sortOrder: await freeSortOrder("OPERATIONS", ADMIN.staffCode, 98080),
    isActive: true
  };
  const employee = await testEmployees.upsert({
    where: { staffCode: ADMIN.staffCode },
    update: employeeFields,
    create: { staffCode: ADMIN.staffCode, ...employeeFields }
  });
  const accountFields = {
    email: `${ADMIN.accountId}@example.local`,
    passwordHash: await hash(ADMIN.password, argon2idOptions),
    role: "administrator",
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  return (prisma as any).userAccount.upsert({
    where: { accountId: ADMIN.accountId },
    update: accountFields,
    create: { accountId: ADMIN.accountId, ...accountFields }
  });
}

/** 대상 id로 그 기록의 목록 행을 찾는다. */
function auditRow(page: Page, targetId: string) {
  return page.getByRole("row").filter({ hasText: targetId });
}

async function openSignIn(page: Page, locale: "ko" | "vi") {
  await page.goto("/sign-in");
  await setLocaleCookie(page, locale);
  await page.reload();
}

test.describe("티켓 08 감사 화면", () => {
  let callLogId = "";

  test.beforeAll(async () => {
    const account = await seedAdmin();
    // 화면 동작은 처리자로 계정의 내부 id를 남긴다.
    const call = await recordAuditEvent(
      {
        actorId: account.id,
        action: "service_call.row_changed",
        targetType: "service_call",
        targetId: CALL_TARGET_ID,
        beforeValue: { operatingMonthId: "t08-month", serviceDate: "2026-10-14", startTime: "15:30", status: "예약" },
        afterValue: { operatingMonthId: "t08-month", serviceDate: "2026-10-14", startTime: "16:00", status: "사용중" },
        reason: "티켓 08 손님 요청"
      },
      { prismaClient: prisma as any }
    );
    callLogId = call.id;

    // 마감 재오픈은 사유를 변경 후 값 안에 담는다.
    await recordAuditEvent(
      {
        actorId: account.id,
        action: "monthly_close.reopened",
        targetType: "monthly_close",
        targetId: CLOSE_TARGET_ID,
        beforeValue: { operatingMonthId: "t08-month", status: "잠금" },
        afterValue: { operatingMonthId: "t08-month", status: "검토중", reason: "티켓 08 누락 확인" }
      },
      { prismaClient: prisma as any }
    );

    await recordAuditEvent(
      {
        actorId: account.id,
        action: "ticket_unknown.changed",
        targetType: "ticket08_unknown_target",
        targetId: UNKNOWN_TARGET_ID,
        beforeValue: null,
        afterValue: { value: 1 }
      },
      { prismaClient: prisma as any }
    );
  });

  test("목록 행이 처리자, 시각, 대상, 변경 전·후, 사유를 먼저 보인다", async ({ page }) => {
    await login(page, ADMIN.accountId, ADMIN.password);
    await page.goto("/audit?targetType=service_call");

    const table = page.getByRole("table", { name: "감사 이벤트" });
    await expect(table.getByRole("columnheader")).toHaveText(["시각", "처리자", "대상", "변경 전·후", "사유"]);

    const row = auditRow(page, CALL_TARGET_ID);
    await expect(row).toContainText(ADMIN.displayName);
    await expect(row).toContainText(ADMIN.accountId);
    await expect(row).toContainText("콜");
    await expect(row).toContainText("startTime: 15:30 → 16:00");
    await expect(row).toContainText("status: 예약 → 사용중");
    await expect(row).toContainText("티켓 08 손님 요청");

    await page.goto("/audit?targetType=monthly_close");
    await expect(auditRow(page, CLOSE_TARGET_ID)).toContainText("티켓 08 누락 확인");
  });

  test("기록을 고르면 변경 상세 패널이 열리고 주소로 다시 열 수 있으며 원본 화면으로 이동한다", async ({ page }) => {
    await login(page, ADMIN.accountId, ADMIN.password);
    await page.goto("/audit?targetType=service_call");

    await auditRow(page, CALL_TARGET_ID).getByRole("button").click();
    const panel = page.getByRole("complementary", { name: "변경 상세" });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`[?&]log=${callLogId}`));

    const compare = panel.getByRole("region", { name: "변경 전·후" });
    const startTime = compare.getByRole("row").filter({ hasText: "startTime" });
    await expect(startTime.getByRole("cell")).toHaveText(["15:30", "16:00"]);
    await expect(startTime.getByRole("rowheader")).toContainText("바뀜");
    await expect(compare.getByRole("row").filter({ hasText: "serviceDate" }).getByRole("rowheader")).not.toContainText("바뀜");

    // 주소로 직접 들어와도 같은 패널이 열린다.
    await page.goto(`/audit?targetType=service_call&log=${callLogId}`);
    await expect(panel).toBeVisible();

    const source = panel.getByRole("link", { name: "원본 화면 열기" });
    await expect(source).toHaveAttribute("href", "/calls?operatingMonthId=t08-month&serviceDate=2026-10-14");
    await source.click();
    await expect(page).toHaveURL(/\/calls\?/);

    // 원본 화면이 없는 대상은 링크 대신 안내를 보인다.
    await page.goto("/audit?targetType=ticket08_unknown_target");
    await auditRow(page, UNKNOWN_TARGET_ID).getByRole("button").click();
    await expect(panel.getByText("이 기록에는 열 수 있는 원본 화면이 없습니다.")).toBeVisible();
    await expect(panel.getByRole("link")).toHaveCount(0);
  });

  test("키보드로 기록을 고르면 포커스가 패널로 가고 닫으면 그 행으로 돌아온다", async ({ page }) => {
    await login(page, ADMIN.accountId, ADMIN.password);
    await page.goto("/audit?targetType=service_call");

    const rowButton = auditRow(page, CALL_TARGET_ID).getByRole("button");
    await rowButton.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("complementary", { name: "변경 상세" });
    await expect(panel).toBeVisible();
    await expect(page.locator(":focus")).toContainText("변경 상세");

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(panel).toHaveCount(0);
    await expect(rowButton).toBeFocused();
    await expect(page).not.toHaveURL(/[?&]log=/);
  });

  test("다른 기록으로 옮긴 뒤 닫으면 마지막 기록의 행으로 돌아오고, 초기화하면 패널이 닫힌다", async ({ page }) => {
    await login(page, ADMIN.accountId, ADMIN.password);
    await page.goto("/audit");

    const callButton = auditRow(page, CALL_TARGET_ID).getByRole("button");
    const closeButton = auditRow(page, CLOSE_TARGET_ID).getByRole("button");
    const panel = page.getByRole("complementary", { name: "변경 상세" });
    await callButton.click();
    await closeButton.click();
    await expect(panel).toContainText(CLOSE_TARGET_ID);
    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(panel).toHaveCount(0);
    await expect(closeButton).toBeFocused();

    await callButton.click();
    await expect(panel).toBeVisible();
    await page.getByRole("link", { name: "초기화" }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(panel).toHaveCount(0);
  });

  test("잘못된 날짜 오류는 해당 칸에 연결된다", async ({ page }) => {
    await login(page, ADMIN.accountId, ADMIN.password);
    await page.goto("/audit?from=2026-02-31&to=2026-01-01");

    const from = page.getByLabel("시작일");
    await expect(from).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(`#${await from.getAttribute("aria-describedby")}`)).toHaveText("시작일 날짜가 올바르지 않습니다.");
    await expect(page.getByLabel("종료일")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("베트남어로도 목록과 패널이 보인다", async ({ page }) => {
    await login(page, ADMIN.accountId, ADMIN.password);
    await setLocaleCookie(page, "vi");
    await page.goto(`/audit?targetType=service_call&log=${callLogId}`);

    await expect(page.getByRole("heading", { name: "Tra cứu lịch sử thay đổi", level: 1 })).toBeVisible();
    await expect(page.getByRole("table", { name: "Sự kiện kiểm tra" }).getByRole("columnheader")).toHaveText([
      "Thời điểm",
      "Người thực hiện",
      "Đối tượng",
      "Trước · sau thay đổi",
      "Lý do"
    ]);
    await expect(auditRow(page, CALL_TARGET_ID)).toContainText("Cuộc gọi");
    const panel = page.getByRole("complementary", { name: "Chi tiết thay đổi" });
    await expect(panel.getByRole("link", { name: "Mở màn hình gốc" })).toBeVisible();
  });
});

test.describe("티켓 08 로그인 화면", () => {
  test("카드 위에 가게 로고가 보이고 탭 제목이 GANGNAM SPA다", async ({ page }) => {
    await openSignIn(page, "vi");
    await expect(page).toHaveTitle("GANGNAM SPA");
    await expect(page.getByRole("img", { name: "GANGNAM SPA" })).toBeVisible();
    // 심볼과 글자 그림 파일이 모두 실제로 불러와졌다.
    await expect
      .poll(() =>
        page
          .locator('main img[src^="/brand/"]')
          .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))
      )
      .toEqual([true, true]);
  });

  test("권한은 계정으로만 정해지고 역할을 고르는 칸이 없다", async ({ page }) => {
    await openSignIn(page, "ko");
    const form = page.locator("form");
    await expect(form.locator("input:not([type=hidden])")).toHaveCount(2);
    await expect(page.locator("select, input[type=radio], [role=radiogroup], [role=combobox], [role=listbox]")).toHaveCount(0);
  });

  test("빈 칸 오류는 그 칸에 연결되고 언어를 바꾸면 새 언어로 다시 보인다", async ({ page }) => {
    await openSignIn(page, "ko");
    await page.getByRole("button", { name: "로그인" }).click();

    const identity = page.getByLabel("이메일 또는 계정 ID");
    await expect(identity).toBeFocused();
    await expect(identity).toHaveAttribute("aria-invalid", "true");
    await expect(identity).toHaveAccessibleDescription("이메일 또는 계정 ID를 입력하세요.");
    await expect(page.getByLabel("비밀번호")).toHaveAccessibleDescription("비밀번호를 입력하세요.");

    await page.getByRole("button", { name: "Tiếng Việt" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByLabel("Email hoặc ID tài khoản")).toHaveAccessibleDescription("Hãy nhập email hoặc ID tài khoản.");
    await expect(page.getByLabel("Mật khẩu")).toHaveAccessibleDescription("Hãy nhập mật khẩu.");
  });

  test("계정 정보 거절은 두 칸에 연결되고 언어를 바꿔도 남는다", async ({ page }) => {
    await openSignIn(page, "vi");
    await page.getByLabel("Email hoặc ID tài khoản").fill("unknown_ticket08");
    await page.getByLabel("Mật khẩu").fill("wrong-password");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    const viMessage = /^Thông tin tài khoản không đúng hoặc không thể sử dụng\./;
    await expect(page.getByRole("alert").filter({ hasText: viMessage })).toBeVisible();
    await expect(page.getByLabel("Email hoặc ID tài khoản")).toHaveAccessibleDescription(viMessage);
    await expect(page.getByLabel("Mật khẩu")).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("button", { name: "한국어" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.getByLabel("비밀번호")).toHaveAccessibleDescription(/^계정 정보가 올바르지 않거나 사용할 수 없습니다\./);
  });
});

test.afterAll(async () => {
    await testEmployees.deactivateAll();
  await prisma.$disconnect();
});
