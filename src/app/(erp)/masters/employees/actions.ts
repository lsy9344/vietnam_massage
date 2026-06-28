"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
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

function mapEmployeeActionError(error: unknown, locale: Locale): ActionResult<EmployeeDto> {
  if (error instanceof EmployeeDomainError) {
    return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: t(locale, "action.error.noPermission") };
  }
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}

function mapAccountActionError(
  error: unknown,
  locale: Locale
): ActionResult<{ id: string; accountId: string; email: string; role: string; employeeId: string | null }> {
  if (error instanceof AccountDomainError) {
    return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: t(locale, "action.error.noPermission") };
  }
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}

export async function createEmployeeAction(_previousState: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const locale = await getLocale();
  const parsed = createEmployeeSchema.safeParse(employeePayload(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await createEmployee({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error, locale);
  }
}

export async function updateEmployeeProfileAction(
  _previousState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const locale = await getLocale();
  const parsed = updateEmployeeProfileSchema.safeParse(employeePayload(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateEmployeeProfile({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error, locale);
  }
}

export async function updateEmployeeSortOrderAction(
  _previousState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const locale = await getLocale();
  const parsed = updateEmployeeSortOrderSchema.safeParse({
    employeeId: formData.get("employeeId"),
    sortOrder: formData.get("sortOrder")
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateEmployeeSortOrder({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error, locale);
  }
}

export async function deactivateEmployeeAction(_previousState: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const locale = await getLocale();
  const parsed = deactivateEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId")
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await deactivateEmployee({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapEmployeeActionError(error, locale);
  }
}

export async function linkUserAccountToEmployeeAction(
  _previousState: AccountLinkActionState,
  formData: FormData
): Promise<AccountLinkActionState> {
  const locale = await getLocale();
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
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await linkUserAccountToEmployee({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapAccountActionError(error, locale);
  }
}
