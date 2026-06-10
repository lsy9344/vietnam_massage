"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import {
  MonthlyClosingDomainError,
  confirmMonthlyClose,
  lockMonthlyClose,
  reopenMonthlyClose,
  startMonthlyCloseReview,
  type MonthlyCloseReviewDto,
  type MonthlyClosingDto
} from "@/modules/closing/monthly-closing-service";

export type MonthlyClosingActionState = ActionResult<MonthlyCloseReviewDto | MonthlyClosingDto> | null;

const monthlyClosingActionSchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const reopenMonthlyClosingActionSchema = monthlyClosingActionSchema.extend({
  reason: z.string().trim().min(5, "재오픈 사유를 5자 이상 입력하세요.")
});

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapActionError(error: unknown): MonthlyClosingActionState {
  if (error instanceof MonthlyClosingDomainError || error instanceof AuditDomainError) {
    return {
      ok: false,
      formError: error.message,
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: "권한이 없습니다."
    };
  }

  return {
    ok: false,
    formError: "월마감 처리 중 오류가 발생했습니다."
  };
}

export async function startMonthlyCloseReviewAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const parsed = monthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "상태 변경 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("closing:write");
    const data = await startMonthlyCloseReview({
      actorId: account.id,
      operatingMonthId: parsed.data.operatingMonthId
    });
    revalidatePath("/closing");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function confirmMonthlyCloseAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const parsed = monthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "마감 확정 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("closing:write");
    const data = await confirmMonthlyClose({
      actorId: account.id,
      operatingMonthId: parsed.data.operatingMonthId
    });
    revalidatePath("/closing");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function lockMonthlyCloseAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const parsed = monthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "잠금 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("closing:write");
    const data = await lockMonthlyClose({
      actorId: account.id,
      operatingMonthId: parsed.data.operatingMonthId
    });
    revalidatePath("/closing");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function reopenMonthlyCloseAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const parsed = reopenMonthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "재오픈 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("closing:reopen");
    const data = await reopenMonthlyClose({
      actorId: account.id,
      operatingMonthId: parsed.data.operatingMonthId,
      reason: parsed.data.reason
    });
    revalidatePath("/closing");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}
