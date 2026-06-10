"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
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

function mapActionError(error: unknown): MigrationVerificationIssueActionState {
  if (error instanceof MigrationVerificationDomainError) {
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
    formError: "이관 검증 상태 저장 중 오류가 발생했습니다."
  };
}

export async function updateMigrationVerificationIssueStatusAction(
  _previousState: MigrationVerificationIssueActionState,
  formData: FormData
): Promise<MigrationVerificationIssueActionState> {
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
      formError: "이관 검증 상태 입력값을 확인하세요."
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
    return mapActionError(error);
  }
}
