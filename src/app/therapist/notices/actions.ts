"use server";

import { revalidatePath } from "next/cache";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { markTherapistNoticeRead, type TherapistNoticeListItemDto } from "@/modules/therapists/therapist-notice-service";

/**
 * 공지 열기(M4, D25). Therapist 본인 공지만 읽음으로 기록한다(employeeId는 세션에서만 온다, M3).
 * 공지 탭 숫자 자리(TherapistTabBar의 noticeUnreadCount)는 레이아웃이 읽으므로, 이 화면만이 아니라
 * Therapist 레이아웃 전체를 다시 읽게 한다(revalidatePath layout).
 */
export async function markTherapistNoticeReadAction(noticeId: string): Promise<TherapistNoticeListItemDto> {
  const { employeeId } = await requireTherapistAccess();
  const result = await markTherapistNoticeRead({ employeeId, noticeId });
  revalidatePath("/therapist", "layout");
  return result;
}
