"use client";

import { useActionState, useState } from "react";
import { inputFieldClassName } from "@/components/ui/input-field";
import { addTherapistMemoAction, type TherapistMemoActionState } from "@/app/(erp)/masters/employees/therapist-memo-actions";
import { PanelSection, masterDateTime } from "@/app/(erp)/masters/master-parts";
import { SaveRow } from "@/app/(erp)/masters/master-fields";
import { useLocale, useT } from "@/lib/i18n/client";
import type { TherapistMemoDto } from "@/modules/therapists/therapist-memo-service";

/** 추가만 되는 폼(수정·삭제 없음). 성공하면 key를 바꿔 다시 마운트해 입력칸을 비운다(생성 서랍과 같은 방식). */
function MemoForm({ employeeId }: { employeeId: string }) {
  const t = useT();
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState<TherapistMemoActionState, FormData>(async (previous, formData) => {
    const result = await addTherapistMemoAction(previous, formData);
    if (result?.ok) {
      setFormKey((key) => key + 1);
    }
    return result;
  }, null);

  return (
    <form action={formAction} className="grid gap-3" key={formKey}>
      <input name="employeeId" type="hidden" value={employeeId} />
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-foreground">{t("masters.employees.memo.fieldLabel")}</span>
        <textarea className={inputFieldClassName({ className: "h-24 w-full py-2" })} maxLength={2000} name="body" required />
      </label>
      <SaveRow label={t("masters.employees.memo.add")} pending={pending} state={state} />
    </form>
  );
}

function MemoRow({ memo }: { memo: TherapistMemoDto }) {
  const locale = useLocale();
  return (
    <li className="grid gap-1 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
        <span className="font-semibold text-foreground">{memo.authorName}</span>
        <span>{masterDateTime(locale, memo.createdAt)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{memo.body}</p>
    </li>
  );
}

/**
 * D27/M24: Therapist 내부 메모. 추가만 가능하고 관리자만 본다(therapist:manage). employee-forms.tsx는
 * 이 컴포넌트 하나만 끼워 넣는다 — 목록·입력 로직은 모두 여기에 있다.
 */
export function TherapistMemoPanel({ employeeId, memos }: { employeeId: string; memos: TherapistMemoDto[] }) {
  const t = useT();
  return (
    <PanelSection title={t("masters.employees.memo.title")}>
      <p className="text-xs text-muted">{t("masters.employees.memo.hint")}</p>
      {memos.length > 0 ? (
        <ul className="grid gap-2">
          {memos.map((memo) => (
            <MemoRow key={memo.id} memo={memo} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("masters.employees.memo.empty")}</p>
      )}
      <MemoForm employeeId={employeeId} />
    </PanelSection>
  );
}
