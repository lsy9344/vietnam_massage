"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import {
  EarcareAttendanceDomainError,
  upsertEarcareAttendance,
  type EarcareAttendanceDto
} from "@/modules/settlements/earcare-attendance-service";

export type EarcareAttendanceActionState = ActionResult<EarcareAttendanceDto> | null;

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function mapActionError(error: unknown): ActionResult<EarcareAttendanceDto> {
  if (error instanceof EarcareAttendanceDomainError) {
    if (error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE") {
      return {
        ok: false,
        fieldErrors: { attendanceDate: [error.message] },
        formError: error.message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "ATTENDANCE_STATUS_NOT_FOUND") {
      return {
        ok: false,
        fieldErrors: { statusCode: [error.message] },
        formError: error.message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "EARCARE_EMPLOYEE_NOT_FOUND") {
      return {
        ok: false,
        fieldErrors: { employeeId: [error.message] },
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
    formError: "귀케어 근무상태 저장 중 오류가 발생했습니다."
  };
}

export async function saveEarcareAttendanceAction(
  _previousState: EarcareAttendanceActionState,
  formData: FormData
): Promise<EarcareAttendanceActionState> {
  try {
    const account = await requirePermission("payout:write");
    const data = await upsertEarcareAttendance({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      attendanceDate: String(formValue(formData, "attendanceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      statusCode: String(formValue(formData, "statusCode") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/earcare");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}
