"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import {
  CodeDomainError,
  createCodeItem,
  createTimeSlot,
  deactivateCodeItem,
  deactivateTimeSlot,
  updateCodeItemDisplayName,
  updateCodeItemSortOrder,
  updateTimeSlotSortOrder,
  updateTimeSlotValue,
  type CodeItemDto,
  type TimeSlotDto
} from "@/modules/masters/code-service";
import {
  createCodeItemSchema,
  createTimeSlotSchema,
  deactivateCodeItemSchema,
  deactivateTimeSlotSchema,
  updateCodeItemDisplayNameSchema,
  updateCodeItemSortOrderSchema,
  updateTimeSlotSortOrderSchema,
  updateTimeSlotValueSchema
} from "@/modules/masters/code-schema";

export type CodeActionState = ActionResult<CodeItemDto> | null;
export type TimeSlotActionState = ActionResult<TimeSlotDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapCodeActionError(error: unknown): ActionResult<CodeItemDto> {
  if (error instanceof CodeDomainError) {
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
    formError: "코드 저장 중 오류가 발생했습니다."
  };
}

function mapTimeSlotActionError(error: unknown): ActionResult<TimeSlotDto> {
  if (error instanceof CodeDomainError) {
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
    formError: "시간 슬롯 저장 중 오류가 발생했습니다."
  };
}

export async function createCodeItemAction(_previousState: CodeActionState, formData: FormData): Promise<CodeActionState> {
  const parsed = createCodeItemSchema.safeParse({
    codeType: formData.get("codeType"),
    code: formData.get("code"),
    displayName: formData.get("displayName"),
    sortOrder: formData.get("sortOrder")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "코드 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await createCodeItem({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error);
  }
}

export async function updateCodeItemDisplayNameAction(
  _previousState: CodeActionState,
  formData: FormData
): Promise<CodeActionState> {
  const parsed = updateCodeItemDisplayNameSchema.safeParse({
    codeItemId: formData.get("codeItemId"),
    displayName: formData.get("displayName")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "표시명 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateCodeItemDisplayName({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error);
  }
}

export async function updateCodeItemSortOrderAction(
  _previousState: CodeActionState,
  formData: FormData
): Promise<CodeActionState> {
  const parsed = updateCodeItemSortOrderSchema.safeParse({
    codeItemId: formData.get("codeItemId"),
    sortOrder: formData.get("sortOrder")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "정렬 순서 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateCodeItemSortOrder({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error);
  }
}

export async function deactivateCodeItemAction(_previousState: CodeActionState, formData: FormData): Promise<CodeActionState> {
  const parsed = deactivateCodeItemSchema.safeParse({
    codeItemId: formData.get("codeItemId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "비활성 처리 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await deactivateCodeItem({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error);
  }
}

export async function createTimeSlotAction(_previousState: TimeSlotActionState, formData: FormData): Promise<TimeSlotActionState> {
  const parsed = createTimeSlotSchema.safeParse({
    value: formData.get("value"),
    sortOrder: formData.get("sortOrder")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "시간 슬롯 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await createTimeSlot({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error);
  }
}

export async function updateTimeSlotValueAction(
  _previousState: TimeSlotActionState,
  formData: FormData
): Promise<TimeSlotActionState> {
  const parsed = updateTimeSlotValueSchema.safeParse({
    timeSlotId: formData.get("timeSlotId"),
    value: formData.get("value")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "시간 슬롯 값 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateTimeSlotValue({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error);
  }
}

export async function updateTimeSlotSortOrderAction(
  _previousState: TimeSlotActionState,
  formData: FormData
): Promise<TimeSlotActionState> {
  const parsed = updateTimeSlotSortOrderSchema.safeParse({
    timeSlotId: formData.get("timeSlotId"),
    sortOrder: formData.get("sortOrder")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "시간 슬롯 정렬 순서 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateTimeSlotSortOrder({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error);
  }
}

export async function deactivateTimeSlotAction(
  _previousState: TimeSlotActionState,
  formData: FormData
): Promise<TimeSlotActionState> {
  const parsed = deactivateTimeSlotSchema.safeParse({
    timeSlotId: formData.get("timeSlotId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "비활성 처리 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await deactivateTimeSlot({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error);
  }
}
