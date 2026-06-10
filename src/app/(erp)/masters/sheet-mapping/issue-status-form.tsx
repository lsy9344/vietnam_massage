"use client";

import { useActionState } from "react";
import {
  updateMigrationVerificationIssueStatusAction,
  type MigrationVerificationIssueActionState
} from "@/app/(erp)/masters/sheet-mapping/actions";
import type { MigrationVerificationOpenIssueRow } from "@/modules/migration/migration-verification-report";

const statusOptions = ["미확인", "수정중", "재검증 필요", "통과"] as const;

function InlineResult({ state }: { state: MigrationVerificationIssueActionState }) {
  if (!state) return null;

  if (state.ok) {
    return (
      <p className="text-xs font-medium text-success" role="status">
        상태가 저장되었습니다.
      </p>
    );
  }

  return (
    <p className="text-xs font-medium text-danger" role="alert">
      {state.formError ?? "상태 저장에 실패했습니다."}
    </p>
  );
}

export function MigrationIssueStatusForm({ issue }: { issue: MigrationVerificationOpenIssueRow }) {
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
        추적 상태
      </label>
      <select
        className="border border-border bg-background px-2 py-1 text-sm text-foreground"
        defaultValue={issue.status}
        disabled={pending}
        id={`${issue.itemKey}-status`}
        name="status"
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${issue.itemKey}-note`}>
        담당자 메모
      </label>
      <input
        className="border border-border bg-background px-2 py-1 text-sm text-foreground"
        defaultValue={issue.lastNote ?? ""}
        disabled={pending}
        id={`${issue.itemKey}-note`}
        maxLength={500}
        name="note"
        placeholder="담당자 메모"
      />
      <button className="border border-border bg-foreground px-3 py-1 text-sm font-semibold text-background disabled:opacity-60" disabled={pending}>
        {pending ? "저장중" : "저장"}
      </button>
      <div className="col-span-3">
        <InlineResult state={state} />
      </div>
    </form>
  );
}
