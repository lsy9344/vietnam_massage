import { expect, test } from "@playwright/test";
import { testEmployees } from "./support/test-employees";
import { prisma } from "./support/db";
import { login } from "./support/auth";
import { openMasterPanelByRowText } from "./support/masters";

/**
 * 티켓 12: Therapist 내부 메모(스펙 D27, D28, M18, M24).
 *
 * 직원 화면의 Therapist 패널 안에 관리자만 읽고 쓰는 추가 전용 메모를 둔다. 정산 담당과
 * therapist 역할은 화면에서도, 서버 액션을 직접 불러도 읽거나 쓸 수 없다.
 */

// 98NN0대(스펙 README): 티켓 12라 98120.
const THERAPIST_STAFF_CODE = "E2E-T12-THR-1";
const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";
const SETTLEMENT_ACCOUNT_ID = "settlement_manager";
const SETTLEMENT_PASSWORD = "Story12!settlement_manager";
const THERAPIST_ACCOUNT_ID = "therapist";
const THERAPIST_PASSWORD = "Story12!therapist";

let therapistEmployeeId = "";

test.describe("티켓 12 Therapist 내부 메모", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const employee = await testEmployees.upsert({
      where: { staffCode: THERAPIST_STAFF_CODE },
      update: { displayName: "T12 Therapist", employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
      create: {
        staffCode: THERAPIST_STAFF_CODE,
        displayName: "T12 Therapist",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: null,
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 98120,
        isActive: true
      }
    });
    therapistEmployeeId = employee.id;
    // 재실행 대비: 이전 실행이 남긴 메모·감사 기록을 지워 빈 상태에서 시작한다(추가 전용 UI에는 이런 삭제
    // 길이 없다. 이 DB는 이 스펙 전용이라 therapist_memo.added를 모두 지워도 다른 스펙과 섞이지 않는다).
    await (prisma as any).therapistInternalMemo.deleteMany({ where: { employeeId: therapistEmployeeId } });
    await (prisma as any).auditLog.deleteMany({ where: { action: "therapist_memo.added", targetType: "therapist_internal_memo" } });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("관리자가 Therapist 패널에서 메모를 추가하면 작성자·시각과 함께 최신순으로 쌓이고 감사에 남는다", async ({ page }) => {
    await login(page, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await page.goto("/masters/employees");
    const panel = await openMasterPanelByRowText(page, THERAPIST_STAFF_CODE);
    // aria-label 있는 <section>은 "region" role로 접근된다(PanelSection). 변경 영향 안내 등 패널의
    // 다른 <li> 목록과 섞이지 않게 메모 구역으로 좁힌다.
    const memoSection = panel.getByRole("region", { name: "Therapist 내부 메모" });

    await expect(memoSection).toBeVisible();
    await expect(memoSection.getByText("아직 메모가 없습니다.")).toBeVisible();

    // 첫 메모.
    await memoSection.getByLabel("메모 내용").fill("지각이 잦다. 다음 달 지켜볼 것(티켓 12 E2E)");
    await memoSection.getByRole("button", { name: "메모 추가" }).click();
    const firstMemoRow = memoSection.getByRole("listitem").filter({ hasText: "지각이 잦다. 다음 달 지켜볼 것(티켓 12 E2E)" });
    await expect(firstMemoRow).toBeVisible();
    await expect(firstMemoRow).toContainText("관리자");

    // 둘째 메모: 최신순이라 먼저 보여야 한다.
    await memoSection.getByLabel("메모 내용").fill("둘째 메모: 개선됨(티켓 12 E2E)");
    await memoSection.getByRole("button", { name: "메모 추가" }).click();
    await expect(memoSection.getByText("둘째 메모: 개선됨(티켓 12 E2E)")).toBeVisible();

    const memoRows = memoSection.getByRole("listitem");
    await expect(memoRows.first()).toContainText("둘째 메모: 개선됨(티켓 12 E2E)");
    await expect(memoRows.nth(1)).toContainText("지각이 잦다. 다음 달 지켜볼 것(티켓 12 E2E)");

    // 추가만 가능하다: 고치거나 지우는 UI가 없다.
    await expect(memoSection.getByRole("button", { name: /^(수정|삭제)/ })).toHaveCount(0);

    // 감사(D28): 추가마다 therapist_memo.added가 그 직원을 대상으로 남는다.
    const adminAccount = await (prisma as any).userAccount.findUnique({ where: { accountId: ADMIN_ACCOUNT_ID } });
    const auditEntries = await (prisma as any).auditLog.findMany({
      where: { action: "therapist_memo.added", targetType: "therapist_internal_memo" },
      orderBy: { createdAt: "desc" }
    });
    const forThisEmployee = auditEntries.filter((entry: any) => entry.afterValue?.employeeId === therapistEmployeeId);
    expect(forThisEmployee.length).toBe(2);
    expect(forThisEmployee.every((entry: any) => entry.actorId === adminAccount.id)).toBe(true);
  });

  test("정산 담당은 직원 화면을 열 수 없다(메모를 읽을 수 없다)", async ({ page }) => {
    await login(page, SETTLEMENT_ACCOUNT_ID, SETTLEMENT_PASSWORD);
    await page.goto("/masters/employees");
    await expect(page).not.toHaveURL(/\/masters\/employees/);
  });

  test("메모 추가 서버 액션을 정산 담당·therapist 세션 쿠키로 다시 보내면 거절된다", async ({ browser }) => {
    const adminContext = await browser.newContext();
    try {
      const adminPage = await adminContext.newPage();
      await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
      await adminPage.goto("/masters/employees");
      const panel = await openMasterPanelByRowText(adminPage, THERAPIST_STAFF_CODE);
      await panel.getByLabel("메모 내용").fill("replay 확인용 메모(티켓 12 E2E)");

      const actionRequest = adminPage.waitForRequest(
        (request) => request.method() === "POST" && Boolean(request.headers()["next-action"])
      );
      await panel.getByRole("button", { name: "메모 추가" }).click();
      const captured = await actionRequest;
      const capturedUrl = captured.url();
      const capturedHeaders = captured.headers();
      const capturedBody = captured.postData();
      expect(capturedBody).not.toBeNull();

      await expect(panel.getByText("replay 확인용 메모(티켓 12 E2E)")).toBeVisible();
      const countAfterAdminWrite = await (prisma as any).auditLog.count({
        where: { action: "therapist_memo.added", targetType: "therapist_internal_memo" }
      });

      const replayHeaders = { ...capturedHeaders };
      delete replayHeaders["cookie"];
      delete replayHeaders["content-length"];
      delete replayHeaders["host"];

      for (const replay of [
        { accountId: SETTLEMENT_ACCOUNT_ID, password: SETTLEMENT_PASSWORD },
        { accountId: THERAPIST_ACCOUNT_ID, password: THERAPIST_PASSWORD }
      ]) {
        const replayContext = await browser.newContext();
        try {
          const replayPage = await replayContext.newPage();
          await login(replayPage, replay.accountId, replay.password);
          await replayPage.close();

          const response = await replayContext.request.post(capturedUrl, { headers: replayHeaders, data: capturedBody as string });
          void response;
        } finally {
          await replayContext.close();
        }

        const replayAccount = await (prisma as any).userAccount.findUnique({ where: { accountId: replay.accountId } });
        const authoredByReplay = await (prisma as any).auditLog.findFirst({
          where: { action: "therapist_memo.added", targetType: "therapist_internal_memo", actorId: replayAccount.id }
        });
        expect(authoredByReplay).toBeNull();
      }

      const countAfterReplays = await (prisma as any).auditLog.count({
        where: { action: "therapist_memo.added", targetType: "therapist_internal_memo" }
      });
      expect(countAfterReplays).toBe(countAfterAdminWrite);
    } finally {
      await adminContext.close();
    }
  });
});
