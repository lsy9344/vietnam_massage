"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import {
  sendTherapistNotice,
  withdrawTherapistNotice,
  type TherapistNoticeAdminDetailDto
} from "@/modules/therapists/therapist-notice-service";
import { mapTherapistNoticeActionError } from "@/app/(erp)/settlements/notices/notice-action-error";

export type TherapistNoticeActionState = ActionResult<TherapistNoticeAdminDetailDto> | null;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

/**
 * 공지 보내기(M5, M18 `therapist:manage`). 대상은 전체 또는 특정 Therapist 한 명이다(D25).
 * R8(M1 얇은 어댑터): targetType은 받은 값을 그대로 서비스로 넘긴다 — 여기서 "전체"로 미리
 * 바꿔 버리면 잘못된 값이 조용히 전원 발송이 될 수 있다. 둘 다 아닌 값은 sendTherapistNotice의
 * zod(INVALID_NOTICE_INPUT)가 거절한다.
 */
export async function sendTherapistNoticeAction(_previousState: TherapistNoticeActionState, formData: FormData): Promise<TherapistNoticeActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("therapist:manage");
    const data = await sendTherapistNotice({
      actorId: account.id,
      body: formValue(formData, "body"),
      targetType: formValue(formData, "targetType") as never,
      targetEmployeeId: formValue(formData, "targetEmployeeId") || null
    });
    revalidatePath("/settlements/notices");
    return { ok: true, data };
  } catch (error) {
    return mapTherapistNoticeActionError(error, locale);
  }
}

/** 공지 내리기(M5, D25). 고칠 수 없고 내리기만 한다. */
export async function withdrawTherapistNoticeAction(_previousState: TherapistNoticeActionState, formData: FormData): Promise<TherapistNoticeActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("therapist:manage");
    const data = await withdrawTherapistNotice({ actorId: account.id, noticeId: formValue(formData, "noticeId") });
    revalidatePath("/settlements/notices");
    return { ok: true, data };
  } catch (error) {
    return mapTherapistNoticeActionError(error, locale);
  }
}
