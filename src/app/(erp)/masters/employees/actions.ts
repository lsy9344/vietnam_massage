"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AccountDomainError, linkUserAccountToEmployee } from "@/modules/masters/account-service";
import {
  EmployeeDomainError,
  createEmployee,
  deactivateEmployee,
  updateEmployeeProfile,
  updateEmployeeSortOrder,
  type EmployeeDto
} from "@/modules/masters/employee-service";
import {
  createEmployeeSchema,
  deactivateEmployeeSchema,
  linkUserAccountToEmployeeSchema,
  updateEmployeeProfileSchema,
  updateEmployeeSortOrderSchema
} from "@/modules/masters/employee-schema";

export type EmployeeActionState = ActionResult<EmployeeDto> | null;
export type AccountLinkActionState = ActionResult<{ id: string; accountId: string; email: string; role: string; employeeId: string | null }> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function employeePayload(formData: FormData) {
  return {
    employeeId: formData.get("employeeId"),
    displayName: formData.get("displayName"),
    staffCode: formData.get("staffCode"),
    employeeGroup: formData.get("employeeGroup"),
    position: formData.get("position"),
    shiftType: formData.get("shiftType"),
    baseSalary: formData.get("baseSalary"),
    phone: formData.get("phone"),
    birthday: formData.get("birthday"),
    hireDate: formData.get("hireDate"),
    employmentStatus: formData.get("employmentStatus"),
    sortOrder: formData.get("sortOrder")
  };
}

function mapEmployeeActionError(error: unknown): ActionResult<EmployeeDto> {
  if (error instanceof EmployeeDomainError) {
    return { ok: false, formError: error.message, domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: "권한이 없습니다." };
  }
  return { ok: false, formError: "직원 저장 중 오류가 발생했습니다." };
}

function mapAccountActionError(
  error: unknown
): ActionResult<{ id: string; accountId: string; email: string; role: string; employeeId: string | null }> {
  if (error instanceof AccountDomainError) {
    return { ok: false, formError: error.message, domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: "권한이 없습니다." };
  }
  return { ok: false, formError: "계정 연결 중 오류가 발생했습니다." };
}

export async function createEmployeeAction(_previousState: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const parsed = createEmployeeSchema.safeParse(employeePayload(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "직원 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await createEmployee({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error);
  }
}

export async function updateEmployeeProfileAction(
  _previousState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const parsed = updateEmployeeProfileSchema.safeParse(employeePayload(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "직원 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateEmployeeProfile({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error);
  }
}

export async function updateEmployeeSortOrderAction(
  _previousState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const parsed = updateEmployeeSortOrderSchema.safeParse({
    employeeId: formData.get("employeeId"),
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
    const data = await updateEmployeeSortOrder({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error);
  }
}

export async function deactivateEmployeeAction(_previousState: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const parsed = deactivateEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId")
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
    const data = await deactivateEmployee({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error);
  }
}

export async function linkUserAccountToEmployeeAction(
  _previousState: AccountLinkActionState,
  formData: FormData
): Promise<AccountLinkActionState> {
  const parsed = linkUserAccountToEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    email: formData.get("email"),
    accountId: formData.get("accountId"),
    role: formData.get("role"),
    initialSecret: formData.get("initialSecret")
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "계정 연결 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await linkUserAccountToEmployee({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapAccountActionError(error);
  }
}
