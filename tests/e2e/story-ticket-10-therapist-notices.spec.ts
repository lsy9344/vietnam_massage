import { expect, test } from "@playwright/test";
import { testEmployees } from "./support/test-employees";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { expectTherapistCenterPopup } from "./support/therapist-popup";

/**
 * 티켓 10: Therapist 공지 — 대상, 읽음, 내리기(스펙 D25, M4, M5, M18).
 *
 * 관리자 전용 베이스라인 계정("administrator", "settlement_manager")은 scripts/seed-dev-accounts.ts가
 * 이미 만든다. Therapist 계정 둘(A·B)은 이 스펙이 직접 시드한다 — "특정 Therapist 공지가 다른
 * Therapist에게 보이지 않음" 확인에 둘이 필요하기 때문이다(README 공통 규칙).
 */
const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";
const SETTLEMENT_ACCOUNT_ID = "settlement_manager";
const SETTLEMENT_PASSWORD = "Story12!settlement_manager";

const THERAPIST_A = { accountId: "t10_therapist_a", password: "Story12!t10TherapistA", staffCode: "E2E-T10-THR-A", displayName: "T10 Therapist A" };
const THERAPIST_B = { accountId: "t10_therapist_b", password: "Story12!t10TherapistB", staffCode: "E2E-T10-THR-B", displayName: "T10 Therapist B" };

let therapistAEmployeeId = "";
let therapistBEmployeeId = "";

async function seedTherapistAccount(spec: { accountId: string; password: string; staffCode: string; displayName: string }, sortOrder: number) {
  const employee = await testEmployees.upsert({
    where: { staffCode: spec.staffCode },
    update: { displayName: spec.displayName, employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
    create: {
      staffCode: spec.staffCode,
      displayName: spec.displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(spec.password, argon2idOptions);
  await prisma.userAccount.upsert({
    where: { accountId: spec.accountId },
    update: { passwordHash, role: "therapist", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${spec.accountId}@example.local`,
      accountId: spec.accountId,
      passwordHash,
      role: "therapist",
      employeeId: employee.id,
      isActive: true
    }
  });
  return employee.id;
}

test.describe("티켓 10 Therapist 공지", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // 98100대(README 공통 규칙: 98NN0, 티켓 10): 다른 스펙의 정렬 순서와 겹치지 않는다.
    therapistAEmployeeId = await seedTherapistAccount(THERAPIST_A, 98100);
    therapistBEmployeeId = await seedTherapistAccount(THERAPIST_B, 98101);
  });

  test.afterAll(async () => {
    await prisma.therapistNoticeRecipient.deleteMany({ where: { employeeId: { in: [therapistAEmployeeId, therapistBEmployeeId] } } });
    await prisma.therapistNotice.deleteMany({ where: { targetEmployeeId: { in: [therapistAEmployeeId, therapistBEmployeeId] } } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("특정 Therapist 공지는 그 한 명에게만 가고, 열면 읽음으로 기록되며, 내리면 더 보이지 않는다", async ({ browser }) => {
    const noticeBody = "티켓10 공지 테스트: 내일 휴무 신청 마감입니다.";

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await adminPage.goto("/settlements/notices");

    await adminPage.getByLabel("본문").fill(noticeBody);
    await adminPage.getByLabel("특정 Therapist 한 명").check();
    await adminPage.getByLabel("대상 Therapist").selectOption({ label: `${THERAPIST_A.staffCode} · ${THERAPIST_A.displayName}` });
    await adminPage.getByRole("button", { name: "보내기" }).click();
    await expect(adminPage.getByText("보냈습니다.")).toBeVisible();

    const noticeCard = adminPage.locator("li").filter({ hasText: noticeBody });
    await expect(noticeCard).toBeVisible();
    await expect(noticeCard.getByText(THERAPIST_A.displayName)).toBeVisible();
    await expect(noticeCard.getByText("대상 1명 · 읽음 0 · 안읽음 1")).toBeVisible();

    // Therapist A: 받은 공지가 보이고, 탭 숫자가 1이다.
    const therapistAContext = await browser.newContext();
    const therapistAPage = await therapistAContext.newPage();
    await login(therapistAPage, THERAPIST_A.accountId, THERAPIST_A.password);
    await therapistAPage.goto("/therapist/notices");
    const noticesTab = therapistAPage.locator('[data-therapist-tab="/therapist/notices"]');
    await expect(noticesTab.locator(".therapist-tab-badge")).toHaveText("1");
    const noticeButton = therapistAPage.getByRole("button", { name: new RegExp(noticeBody) });
    await expect(noticeButton).toBeVisible();
    await expect(noticeButton.getByText("안읽음")).toBeVisible();

    // 열면 읽음으로 기록되고(D25), 탭 숫자가 사라진다.
    await noticeButton.click();
    const noticeDialog = therapistAPage.getByRole("dialog");
    await expect(noticeDialog.getByRole("heading", { name: "공지" })).toBeVisible();
    await expectTherapistCenterPopup(therapistAPage, noticeDialog);
    await expect(noticeDialog.getByText(noticeBody)).toBeVisible();
    await therapistAPage.keyboard.press("Escape");
    await expect(noticesTab.locator(".therapist-tab-badge")).toHaveCount(0);
    await expect(noticeButton.getByText("안읽음")).toHaveCount(0);
    await therapistAContext.close();

    // Therapist B: 특정 Therapist에게 보낸 공지는 보이지 않는다(D25, M6).
    const therapistBContext = await browser.newContext();
    const therapistBPage = await therapistBContext.newPage();
    await login(therapistBPage, THERAPIST_B.accountId, THERAPIST_B.password);
    await therapistBPage.goto("/therapist/notices");
    await expect(therapistBPage.getByText(noticeBody)).toHaveCount(0);
    await expect(therapistBPage.getByText("받은 공지가 없습니다")).toBeVisible();
    await expect(therapistBPage.locator('[data-therapist-tab="/therapist/notices"] .therapist-tab-badge')).toHaveCount(0);
    await therapistBContext.close();

    // 관리자: 읽은 사람·읽지 않은 사람이 보이고, 받는 사람은 A 한 명뿐이다(B는 없음).
    await adminPage.reload();
    const refreshedCard = adminPage.locator("li").filter({ hasText: noticeBody });
    await expect(refreshedCard.getByText("대상 1명 · 읽음 1 · 안읽음 0")).toBeVisible();
    await refreshedCard.getByRole("button", { name: "읽음 현황 보기" }).click();
    const recipientList = refreshedCard.locator("ul");
    await expect(recipientList.getByText(THERAPIST_A.displayName)).toBeVisible();
    await expect(recipientList.getByText(THERAPIST_B.displayName)).toHaveCount(0);

    // 내리기: Therapist에게는 더 보이지 않지만 관리자 목록에는 "내림"으로 남는다(D25, 111).
    await refreshedCard.getByRole("button", { name: "내리기" }).click();
    await expect(refreshedCard.getByText("내림").first()).toBeVisible();
    await expect(refreshedCard.getByRole("button", { name: "내리기" })).toHaveCount(0);

    const therapistARecheckContext = await browser.newContext();
    const therapistARecheckPage = await therapistARecheckContext.newPage();
    await login(therapistARecheckPage, THERAPIST_A.accountId, THERAPIST_A.password);
    await therapistARecheckPage.goto("/therapist/notices");
    await expect(therapistARecheckPage.getByText(noticeBody)).toHaveCount(0);
    await therapistARecheckContext.close();

    await adminContext.close();
  });

  test("390px 폭에서 Therapist 공지 탭은 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, THERAPIST_A.accountId, THERAPIST_A.password);
    await page.goto("/therapist/notices");
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });

  test("정산 담당과 therapist 역할이 공지 보내기 액션을 직접 부르면 거절된다", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
      await adminPage.goto("/settlements/notices");

      await adminPage.getByLabel("본문").fill("거절 확인용 공지(저장되면 안 됨)");
      await adminPage.getByLabel("특정 Therapist 한 명").check();
      await adminPage.getByLabel("대상 Therapist").selectOption({ label: `${THERAPIST_B.staffCode} · ${THERAPIST_B.displayName}` });

      const actionRequest = adminPage.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]));
      await adminPage.getByRole("button", { name: "보내기" }).click();
      const captured = await actionRequest;
      const capturedUrl = captured.url();
      const capturedHeaders = captured.headers();
      const capturedBody = captured.postData();
      expect(capturedBody).not.toBeNull();

      // 관리자 자신의 요청은 성공해 공지 1건이 생긴다.
      await expect.poll(async () => prisma.therapistNotice.count({ where: { targetEmployeeId: therapistBEmployeeId } })).toBe(1);
      const countAfterAdminSend = await prisma.therapistNotice.count({ where: { targetEmployeeId: therapistBEmployeeId } });

      for (const replaySession of [
        { accountId: SETTLEMENT_ACCOUNT_ID, password: SETTLEMENT_PASSWORD },
        { accountId: THERAPIST_A.accountId, password: THERAPIST_A.password }
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

      // 두 번의 재전송 뒤에도 그 대상 공지는 관리자가 보낸 1건 그대로다.
      const countAfterReplays = await prisma.therapistNotice.count({ where: { targetEmployeeId: therapistBEmployeeId } });
      expect(countAfterReplays).toBe(countAfterAdminSend);
    } finally {
      await adminContext.close();
    }
  });
});
