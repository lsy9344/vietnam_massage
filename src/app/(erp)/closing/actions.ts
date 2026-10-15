"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage, resolveKoreanMessage } from "@/lib/i18n/errors";
import {
  MonthlyClosePendingCallsChangedError,
  MonthlyClosingDomainError,
  confirmMonthlyClose,
  lockMonthlyClose,
  reopenMonthlyClose,
  startMonthlyCloseReview,
  type MonthlyCloseReviewDto,
  type MonthlyClosingDto
} from "@/modules/closing/monthly-closing-service";
import type { MonthlyClosingChecklistCallDto } from "@/modules/closing/monthly-closing-checklist-service";

export type MonthlyClosingActionState = ActionResult<MonthlyCloseReviewDto | MonthlyClosingDto> | null;
/**
 * F07/ADR 0005(티켓 34): 확인한 목록 이후 새 마감 확인 대상 콜이 생겨 거절되면, 다시 체크하도록
 * 지금의 목록을 함께 돌려준다(StaleServiceCallError + currentRow와 같은 모양, calls/actions.ts 참고).
 */
export type ConfirmMonthlyCloseActionState =
  | MonthlyClosingActionState
  | {
      ok: false;
      formError: string;
      domainErrorCode: "MONTHLY_CLOSE_PENDING_CALLS_CHANGED";
      currentPendingCloseCalls: MonthlyClosingChecklistCallDto[];
    };

const monthlyClosingActionSchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const confirmMonthlyClosingActionSchema = monthlyClosingActionSchema.extend({
  confirmedPendingCloseCallIds: z.array(z.string().trim().min(1)).default([]),
  exceptionReason: z.string().trim().max(500, "사유는 500자 이하로 입력하세요.").default("")
});

const reopenMonthlyClosingActionSchema = monthlyClosingActionSchema.extend({
  reason: z.string().trim().min(5, "재오픈 사유를 5자 이상 입력하세요.")
});

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>, locale: Locale) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      // Zod 한국어 메시지를 inline field error 표시 직전에 locale로 번역한다.
      .map(([field, messages]) => [field, messages.map((message) => resolveKoreanMessage(locale, message))])
  );
}

function mapActionError(error: unknown, locale: Locale): MonthlyClosingActionState {
  if (error instanceof MonthlyClosingDomainError || error instanceof AuditDomainError) {
    return {
      ok: false,
      formError: resolveDomainErrorMessage(locale, error.code, error.message),
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: t(locale, "action.error.noPermission")
    };
  }

  return {
    ok: false,
    formError: t(locale, "action.error.saveFailed")
  };
}

export async function startMonthlyCloseReviewAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const locale = await getLocale();
  const parsed = monthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
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
    return mapActionError(error, locale);
  }
}

export async function confirmMonthlyCloseAction(
  _previousState: ConfirmMonthlyCloseActionState,
  formData: FormData
): Promise<ConfirmMonthlyCloseActionState> {
  const locale = await getLocale();
  const parsed = confirmMonthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId"),
    confirmedPendingCloseCallIds: formData.getAll("confirmedPendingCloseCallIds"),
    // 마감 확인 대상 콜이 없으면 그 입력칸 자체를 그리지 않으므로, formData.get()은 null을 돌려준다.
    // zod .default("")는 undefined에만 적용되어 null은 그대로 통과시켜 거절하므로 여기서 미리 바꾼다.
    exceptionReason: formData.get("exceptionReason") ?? ""
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("closing:write");
    const data = await confirmMonthlyClose({
      actorId: account.id,
      operatingMonthId: parsed.data.operatingMonthId,
      confirmedPendingCloseCallIds: parsed.data.confirmedPendingCloseCallIds,
      exceptionReason: parsed.data.exceptionReason
    });
    revalidatePath("/closing");
    return { ok: true, data };
  } catch (error) {
    // F07/ADR 0005(티켓 34): 목록이 바뀌어 거절되면 지금의 목록을 함께 돌려줘 다시 확인할 수 있게 한다.
    if (error instanceof MonthlyClosePendingCallsChangedError) {
      return {
        ok: false,
        formError: resolveDomainErrorMessage(locale, error.code, error.message),
        domainErrorCode: "MONTHLY_CLOSE_PENDING_CALLS_CHANGED",
        currentPendingCloseCalls: error.currentPendingCloseCalls
      };
    }
    return mapActionError(error, locale);
  }
}

export async function lockMonthlyCloseAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const locale = await getLocale();
  const parsed = monthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
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
    return mapActionError(error, locale);
  }
}

export async function reopenMonthlyCloseAction(
  _previousState: MonthlyClosingActionState,
  formData: FormData
): Promise<MonthlyClosingActionState> {
  const locale = await getLocale();
  const parsed = reopenMonthlyClosingActionSchema.safeParse({
    operatingMonthId: formData.get("operatingMonthId"),
    reason: formData.get("reason")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
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
    return mapActionError(error, locale);
  }
}
