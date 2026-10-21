"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ListboxSelect } from "@/components/ui/listbox-select";
import {
  updateMigrationVerificationIssueStatusAction,
  type MigrationVerificationIssueActionState
} from "@/app/(erp)/masters/sheet-mapping/actions";
import type { MigrationVerificationOpenIssueRow } from "@/modules/migration/migration-verification-report";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/types";

// value는 한국어 stable status key(저장/비교 로직용), label만 번역한다.
const statusOptions: { value: string; labelKey: MessageKey }[] = [
  { value: "미확인", labelKey: "masters.issueStatus.option.unconfirmed" },
  { value: "수정중", labelKey: "masters.issueStatus.option.inProgress" },
  { value: "재검증 필요", labelKey: "masters.issueStatus.option.reverify" },
  { value: "통과", labelKey: "masters.issueStatus.option.pass" }
];

function InlineResult({ state }: { state: MigrationVerificationIssueActionState }) {
  const t = useT();
  if (!state) return null;

  if (state.ok) {
    return (
      <p className="text-sm font-semibold text-success" role="status">
        {t("masters.issueStatus.saved")}
      </p>
    );
  }

  return (
    <p className="text-sm text-danger" role="alert">
      {state.formError ?? t("masters.issueStatus.saveFailed")}
    </p>
  );
}

/** 이슈 상세 패널 안의 추적 상태·담당자 메모 저장. */
export function MigrationIssueStatusForm({ issue }: { issue: MigrationVerificationOpenIssueRow }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<MigrationVerificationIssueActionState, FormData>(
    updateMigrationVerificationIssueStatusAction,
    null
  );

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input name="itemKey" type="hidden" value={issue.itemKey} />
      <input name="kind" type="hidden" value={issue.kind} />
      <input name="sourceSheet" type="hidden" value={issue.sourceSheet ?? ""} />
      <input name="relatedRequirement" type="hidden" value={issue.relatedRequirement ?? ""} />
      <input name="relatedStory" type="hidden" value={issue.relatedStory ?? ""} />
      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-foreground" htmlFor={`${issue.itemKey}-status`}>
          {t("masters.issueStatus.status")}
        </label>
        <ListboxSelect
          className="w-full"
          defaultValue={issue.status}
          disabled={pending}
          id={`${issue.itemKey}-status`}
          name="status"
          options={statusOptions.map((status) => ({ label: t(status.labelKey), value: status.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-foreground" htmlFor={`${issue.itemKey}-note`}>
          {t("masters.issueStatus.note")}
        </label>
        <input
          className={inputFieldClassName({ className: "w-full" })}
          defaultValue={issue.lastNote ?? ""}
          disabled={pending}
          id={`${issue.itemKey}-note`}
          maxLength={500}
          name="note"
          placeholder={t("masters.issueStatus.notePlaceholder")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit" variant="secondary">
          {pending ? t("masters.issueStatus.saving") : t("masters.issueStatus.save")}
        </Button>
        <InlineResult state={state} />
      </div>
    </form>
  );
}
