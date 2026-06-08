"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import {
  changeOperatingMonthStatus,
  createOperatingMonth,
  OperatingMonthDomainError,
  type OperatingMonthDto
} from "@/modules/masters/operating-month-service";
import {
  changeOperatingMonthStatusSchema,
  createOperatingMonthSchema
} from "@/modules/masters/operating-month-schema";

export type OperatingMonthActionState = ActionResult<OperatingMonthDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapActionError(error: unknown): ActionResult<OperatingMonthDto> {
  if (error instanceof OperatingMonthDomainError) {
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
    formError: "운영월 저장 중 오류가 발생했습니다."
  };
}

export async function createOperatingMonthAction(
  _previousState: OperatingMonthActionState,
  formData: FormData
): Promise<OperatingMonthActionState> {
  const parsed = createOperatingMonthSchema.safeParse({
    monthKey: formData.get("monthKey")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await createOperatingMonth({
      actorId: account.id,
      monthKey: parsed.data.monthKey
    });
    revalidatePath("/masters/operating-months");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function changeOperatingMonthStatusAction(
  _previousState: OperatingMonthActionState,
  formData: FormData
): Promise<OperatingMonthActionState> {
  const parsed = changeOperatingMonthStatusSchema.safeParse({
    monthKey: formData.get("monthKey"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "상태 변경 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await changeOperatingMonthStatus({
      actorId: account.id,
      monthKey: parsed.data.monthKey,
      status: parsed.data.status
    });
    revalidatePath("/masters/operating-months");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}
