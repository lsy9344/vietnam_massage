"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import {
  autosaveServiceCallRow,
  saveBasicServiceCallRow,
  ServiceCallDomainError,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import { serviceCallAutosaveInputSchema, serviceCallInputSchema, type ServiceCallAutosaveInput } from "@/modules/calls/service-call-schema";

export type ServiceCallActionState = ActionResult<ServiceCallRowDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function mapActionError(error: unknown): ActionResult<ServiceCallRowDto> {
  if (error instanceof ServiceCallDomainError) {
    if (error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED") {
      return {
        ok: false,
        fieldErrors: { therapist2Id: [error.message] },
        formError: error.message,
        domainErrorCode: error.code
      };
    }

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

  if (error instanceof AuditDomainError) {
    return {
      ok: false,
      formError: "감사 로그 기록 중 오류가 발생했습니다.",
      domainErrorCode: error.code
    };
  }

  return {
    ok: false,
    formError: "콜 원장 저장 중 오류가 발생했습니다."
  };
}

export async function saveBasicServiceCallRowAction(
  _previousState: ServiceCallActionState,
  formData: FormData
): Promise<ServiceCallActionState> {
  const parsed = serviceCallInputSchema.safeParse({
    serviceCallId: formValue(formData, "serviceCallId"),
    operatingMonthId: formValue(formData, "operatingMonthId"),
    serviceDate: formValue(formData, "serviceDate"),
    startTime: formValue(formData, "startTime"),
    roomId: formValue(formData, "roomId"),
    courseId: formValue(formData, "courseId"),
    customerMemo: formValue(formData, "customerMemo"),
    therapist1Id: formValue(formData, "therapist1Id"),
    therapist2Id: formValue(formData, "therapist2Id"),
    earcareEmployeeId: formValue(formData, "earcareEmployeeId"),
    status: formValue(formData, "status"),
    discountTypeCode: formValue(formData, "discountTypeCode"),
    paymentMethodCode: formValue(formData, "paymentMethodCode"),
    note: formValue(formData, "note"),
    confirmationCode: formValue(formData, "confirmationCode")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "입력값을 확인하세요."
    };
  }

  try {
    await requirePermission("call:write");
    const data = await saveBasicServiceCallRow(parsed.data);
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function autosaveServiceCallRowAction(input: ServiceCallAutosaveInput): Promise<ActionResult<ServiceCallRowDto>> {
  const parsed = serviceCallAutosaveInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await autosaveServiceCallRow({
      ...parsed.data,
      actorId: account.id
    });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}
