"use client";

import { useActionState } from "react";
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
      <p className="text-xs font-medium text-success" role="status">
        {t("masters.issueStatus.saved")}
      </p>
    );
  }

  return (
    <p className="text-xs font-medium text-danger" role="alert">
      {state.formError ?? t("masters.issueStatus.saveFailed")}
    </p>
  );
}

export function MigrationIssueStatusForm({ issue }: { issue: MigrationVerificationOpenIssueRow }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<MigrationVerificationIssueActionState, FormData>(
    updateMigrationVerificationIssueStatusAction,
    null
  );

  return (
    <form action={formAction} className="grid min-w-[420px] grid-cols-[120px_1fr_96px] gap-2" noValidate>
      <input name="itemKey" type="hidden" value={issue.itemKey} />
      <input name="kind" type="hidden" value={issue.kind} />
      <input name="sourceSheet" type="hidden" value={issue.sourceSheet ?? ""} />
      <input name="relatedRequirement" type="hidden" value={issue.relatedRequirement ?? ""} />
      <input name="relatedStory" type="hidden" value={issue.relatedStory ?? ""} />
      <label className="sr-only" htmlFor={`${issue.itemKey}-status`}>
        {t("masters.issueStatus.status")}
      </label>
      <select
        className="border border-border bg-background px-2 py-1 text-sm text-foreground"
        defaultValue={issue.status}
        disabled={pending}
        id={`${issue.itemKey}-status`}
        name="status"
      >
        {statusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {t(status.labelKey)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${issue.itemKey}-note`}>
        {t("masters.issueStatus.note")}
      </label>
      <input
        className="border border-border bg-background px-2 py-1 text-sm text-foreground"
        defaultValue={issue.lastNote ?? ""}
        disabled={pending}
        id={`${issue.itemKey}-note`}
        maxLength={500}
        name="note"
        placeholder={t("masters.issueStatus.notePlaceholder")}
      />
      <button className="border border-border bg-foreground px-3 py-1 text-sm font-semibold text-background disabled:opacity-60" disabled={pending}>
        {pending ? t("masters.issueStatus.saving") : t("masters.issueStatus.save")}
      </button>
      <div className="col-span-3">
        <InlineResult state={state} />
      </div>
    </form>
  );
}
