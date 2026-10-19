import { expect, type Locator, type Page } from "@playwright/test";
import { prisma } from "./db";

/**
 * 2단계 빠른 예약(1018 스펙 D19–D23)을 E2E에서 다루는 헬퍼. 패널은 원장 옆의 비모달 패널(`aside`, 이름 "빠른 예약")이다.
 * ① 조건: 날짜·시간·인원을 고르고, "미지명" 줄이나 Therapist 줄의 코스 칩을 눌러 손님을 담는다.
 * ② 고객: 예약 경로 버튼, 예약자명, 기존 고객 검색, 메모, 한 줄 요약과 "예약 저장".
 *
 * Therapist 줄은 그날 출근 기록이 있는 사람만 기본으로 보인다. 근무표가 "근무 예정"인 출근 전 사람은 "출근 전 보기"를
 * 켜야 보인다. 그래서 Therapist를 고르는 스펙은 `checkInTherapist`로 출근 기록을 먼저 넣는다.
 */
export function quickBookingPanel(page: Page) {
  return page.getByRole("complementary", { name: "빠른 예약" });
}

/** 원장 탭 머리의 "빠른 예약" 버튼으로 패널을 연다. */
export async function openQuickBooking(page: Page) {
  await page.locator("[data-quick-booking-trigger]").click();
  const panel = quickBookingPanel(page);
  await expect(panel).toBeVisible();
  return panel;
}

/** ①의 시간(과 인원). 시간을 바꾸면 Therapist 줄을 다시 불러온다. */
export async function chooseConditions(panel: Locator, input: { time?: string; partySize?: number }) {
  // select를 감싼 label의 이름에는 option 글자도 섞여 exact 비교가 맞지 않는다.
  if (input.time) await panel.locator("#quick-booking-time").selectOption(input.time);
  if (input.partySize) await panel.getByLabel("인원").selectOption(String(input.partySize));
}

/** ①의 한 줄. therapistId가 null이면 맨 위 "미지명" 줄이다. */
export function quickBookingLine(panel: Locator, therapistId: string | null) {
  return panel.locator(`[data-quick-booking-line="${therapistId ?? "unassigned"}"]`);
}

/**
 * 코스 칩을 눌러 손님 한 명을 담는다. 불가 칩이면 경고 확인 창의 "경고 확인 후 배정"까지 누른다(confirmWarning).
 * 그 시각에 안 되는 사람은 접어 둔 "이 시각에 안 되는 N명" 안에 있어 먼저 펼친다.
 */
export async function pickGuest(
  page: Page,
  panel: Locator,
  input: { therapistId: string | null; courseId: string; confirmWarning?: boolean }
) {
  const line = quickBookingLine(panel, input.therapistId);
  if (input.therapistId && !(await line.isVisible())) {
    const fold = panel.locator("[data-quick-booking-unavailable] > summary");
    if (await fold.isVisible()) await fold.click();
  }
  await line.locator(`[data-course-id="${input.courseId}"]`).click();
  if (input.confirmWarning) {
    await page.getByRole("alertdialog").getByRole("button", { name: "경고 확인 후 배정" }).click();
  }
}

/** D코스 손님(1부터)의 두 번째 Therapist. */
export async function chooseSecondTherapist(panel: Locator, guestPosition: number, therapistId: string) {
  await panel.locator(`[data-quick-booking-guest="${guestPosition}"]`).getByLabel("두 번째 Therapist").selectOption(therapistId);
}

/** ①에서 인원만큼 담은 뒤 ② 고객으로 넘어간다. */
export async function goToCustomerStep(panel: Locator) {
  await panel.getByRole("button", { name: "다음", exact: true }).click();
  await expect(panel.getByRole("group", { name: "예약 경로" })).toBeVisible();
}

/** ②의 예약 경로·예약자명·메모. */
export async function fillBooking(panel: Locator, input: { channel?: string; bookerName?: string; memo?: string }) {
  if (input.channel) await panel.getByRole("group", { name: "예약 경로" }).getByRole("button", { name: input.channel, exact: true }).click();
  if (input.bookerName !== undefined) await panel.getByLabel("예약자명", { exact: true }).fill(input.bookerName);
  if (input.memo !== undefined) await panel.getByLabel("메모", { exact: true }).fill(input.memo);
}

/**
 * "예약 저장"을 누르고 패널이 닫히기를 기다린다. 저장한 뒤에는 새 행이 골라져 편집 패널이 열린다(1018 스펙 D19).
 */
export async function saveQuickBooking(page: Page, panel: Locator) {
  await panel.getByRole("button", { name: "예약 저장" }).click();
  await expect(quickBookingPanel(page)).toBeHidden();
}

/** 그날 출근 기록(출근 10:00, 퇴근 없음)을 넣는다. ①의 Therapist 줄은 출근 기록이 있는 사람만 기본으로 보인다. */
export async function checkInTherapist(input: { operatingMonthId: string; serviceDate: string; employeeId: string; checkInMinute?: number }) {
  const attendanceDate = new Date(`${input.serviceDate}T00:00:00.000Z`);
  const existing = await (prisma as any).therapistAttendance.findFirst({ where: { attendanceDate, employeeId: input.employeeId } });
  if (existing) {
    await (prisma as any).therapistAttendance.update({
      where: { id: existing.id },
      data: { checkInMinute: existing.checkInMinute ?? input.checkInMinute ?? 600, checkOutMinute: null }
    });
    return;
  }
  await (prisma as any).therapistAttendance.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      attendanceDate,
      employeeId: input.employeeId,
      checkInMinute: input.checkInMinute ?? 600,
      checkOutMinute: null,
      isFullAttendanceRecognized: false
    }
  });
}
