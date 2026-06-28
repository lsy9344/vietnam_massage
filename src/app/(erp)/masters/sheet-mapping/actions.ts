"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import {
  MigrationVerificationDomainError,
  migrationVerificationIssueKinds,
  migrationVerificationIssueStatuses,
  updateMigrationVerificationIssueStatus,
  type MigrationVerificationIssueKind,
  type MigrationVerificationIssueRecord,
  type MigrationVerificationIssueStatus
} from "@/modules/migration/migration-verification-report";

export type MigrationVerificationIssueActionState = ActionResult<MigrationVerificationIssueRecord> | null;

function toStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isStatus(value: string): value is MigrationVerificationIssueStatus {
  return migrationVerificationIssueStatuses.includes(value as MigrationVerificationIssueStatus);
}

function isKind(value: string): value is MigrationVerificationIssueKind {
  return migrationVerificationIssueKinds.includes(value as MigrationVerificationIssueKind);
}

function nullableString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapActionError(error: unknown, locale: Locale): MigrationVerificationIssueActionState {
  if (error instanceof MigrationVerificationDomainError) {
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

export async function updateMigrationVerificationIssueStatusAction(
  _previousState: MigrationVerificationIssueActionState,
  formData: FormData
): Promise<MigrationVerificationIssueActionState> {
  const locale = await getLocale();
  const itemKey = toStringValue(formData.get("itemKey")).trim();
  const kind = toStringValue(formData.get("kind")).trim();
  const status = toStringValue(formData.get("status")).trim();

  const fieldErrors: Record<string, string[]> = {};
  if (!itemKey) fieldErrors.itemKey = ["항목 키가 필요합니다."];
  if (!isKind(kind)) fieldErrors.kind = ["추적 항목 종류를 확인하세요."];
  if (!isStatus(status)) fieldErrors.status = ["상태는 미확인, 수정중, 재검증 필요, 통과 중 하나여야 합니다."];

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      formError: t(locale, "action.error.invalidInput")
    };
  }

  const parsedKind = kind as MigrationVerificationIssueKind;
  const parsedStatus = status as MigrationVerificationIssueStatus;

  try {
    const account = await requirePermission("migration:write");
    const data = await updateMigrationVerificationIssueStatus({
      actorId: account.id,
      actorRole: account.role,
      itemKey,
      kind: parsedKind,
      sourceSheet: nullableString(toStringValue(formData.get("sourceSheet"))),
      relatedRequirement: nullableString(toStringValue(formData.get("relatedRequirement"))),
      relatedStory: nullableString(toStringValue(formData.get("relatedStory"))),
      assigneeName: nullableString(toStringValue(formData.get("assigneeName"))),
      note: toStringValue(formData.get("note")),
      status: parsedStatus
    });
    revalidatePath("/masters/sheet-mapping");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}
