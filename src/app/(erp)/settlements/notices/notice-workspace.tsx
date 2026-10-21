"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateCapsule } from "@/components/ui/date-capsule";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { sendTherapistNoticeAction, withdrawTherapistNoticeAction, type TherapistNoticeActionState } from "@/app/(erp)/settlements/notices/actions";
import type {
  TherapistNoticeAdminDetailDto,
  TherapistNoticeTargetOptionDto,
  TherapistNoticeTargetType
} from "@/modules/therapists/therapist-notice-service";

function noticeDateTime(locale: Locale, value: string) {
  return `${formatDateTime(locale, value, { dateStyle: "short" })} · ${formatDateTime(locale, value, { timeStyle: "short" })}`;
}

/** 공지 보내기 폼(M5). 보내면 서버가 받는 사람을 고정하고(D25), revalidatePath로 아래 목록이 다시 받아진다. */
function SendNoticeForm({ targetOptions }: { targetOptions: TherapistNoticeTargetOptionDto[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistNoticeActionState, FormData>(sendTherapistNoticeAction, null);
  const [targetType, setTargetType] = useState<TherapistNoticeTargetType>("전체");
  // 보낸 뒤 폼을 다시 마운트해 본문·대상 선택을 비운다(제어하지 않는 textarea·select라 key로 비운다).
  const [formKey, setFormKey] = useState(0);
  const bodyId = useId();
  const targetEmployeeFieldId = useId();
  const bodyErrorId = useId();
  const targetErrorId = useId();

  useEffect(() => {
    if (state?.ok) {
      setFormKey((key) => key + 1);
      setTargetType("전체");
    }
  }, [state]);

  const bodyError = state && !state.ok ? state.fieldErrors?.body?.[0] : undefined;
  const targetFieldError = state && !state.ok ? state.fieldErrors?.targetEmployeeId?.[0] : undefined;
  const formError = state && !state.ok && !bodyError && !targetFieldError ? state.formError : undefined;

  return (
    <form action={formAction} className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4" key={formKey}>
      {state?.ok ? (
        <p className="text-sm font-semibold text-success" role="status">
          {t("settlements.notices.form.sentNotice")}
        </p>
      ) : null}
      <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={bodyId}>
        {t("settlements.notices.form.bodyLabel")}
        <textarea
          aria-describedby={bodyError ? bodyErrorId : undefined}
          aria-invalid={bodyError ? "true" : undefined}
          className={inputFieldClassName({ className: "h-auto min-h-24 py-2", invalid: Boolean(bodyError) })}
          disabled={pending}
          id={bodyId}
          name="body"
          placeholder={t("settlements.notices.form.bodyPlaceholder")}
        />
        {bodyError ? (
          <span className="text-sm text-danger" id={bodyErrorId} role="alert">
            {bodyError}
          </span>
        ) : null}
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-foreground">{t("settlements.notices.form.targetLabel")}</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input checked={targetType === "전체"} disabled={pending} name="targetType" onChange={() => setTargetType("전체")} type="radio" value="전체" />
            {t("settlements.notices.form.targetAll")}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input checked={targetType === "특정"} disabled={pending} name="targetType" onChange={() => setTargetType("특정")} type="radio" value="특정" />
            {t("settlements.notices.form.targetOne")}
          </label>
        </div>
      </fieldset>
      {targetType === "특정" ? (
        <label className="grid max-w-sm gap-1.5 text-sm font-semibold text-foreground" htmlFor={targetEmployeeFieldId}>
          {t("settlements.notices.form.targetEmployeeLabel")}
          <ListboxSelect
            ariaDescribedBy={targetFieldError ? targetErrorId : undefined}
            defaultValue=""
            disabled={pending}
            id={targetEmployeeFieldId}
            invalid={Boolean(targetFieldError)}
            name="targetEmployeeId"
            options={[
              { disabled: true, label: t("settlements.notices.form.targetEmployeePlaceholder"), value: "" },
              ...targetOptions.map((option) => ({
                label: `${option.staffCode} · ${option.displayName}`,
                value: option.employeeId
              }))
            ]}
          />
          {targetFieldError ? (
            <span className="text-sm text-danger" id={targetErrorId} role="alert">
              {targetFieldError}
            </span>
          ) : null}
        </label>
      ) : null}
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      <div>
        <Button disabled={pending} type="submit">
          {pending ? t("settlements.notices.form.submitting") : t("settlements.notices.form.submit")}
        </Button>
      </div>
    </form>
  );
}

/** 공지 한 건: 대상·본문·읽음 현황, 고칠 수 없고 내리기만 한다(D25). */
function NoticeCard({ locale, notice }: { locale: Locale; notice: TherapistNoticeAdminDetailDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistNoticeActionState, FormData>(withdrawTherapistNoticeAction, null);
  const [expanded, setExpanded] = useState(false);
  const current = state?.ok ? state.data : notice;
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <li className="grid gap-2 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <DateCapsule>{noticeDateTime(locale, current.sentAt)}</DateCapsule>
        <span className="text-xs font-semibold text-muted">
          {current.targetType === "전체" ? t("settlements.notices.list.target.all") : current.targetEmployeeName ?? "-"}
        </span>
        {current.withdrawnAt ? <StatusIndicator label={t("settlements.notices.list.withdrawn")} size="sm" tone="neutral" /> : null}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{current.body}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          {t("settlements.notices.list.recipients", { total: current.recipientCount, read: current.readCount, unread: current.unreadCount })}
        </span>
        <button
          className="inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? t("settlements.notices.list.hideRecipients") : t("settlements.notices.list.showRecipients")}
        </button>
      </div>
      {expanded ? (
        <ul className="grid gap-1">
          {current.recipients.map((recipient) => (
            <li className="flex min-h-11 items-center justify-between gap-2 rounded-sm bg-surface-float px-3 text-sm" key={recipient.employeeId}>
              <span className="text-foreground">
                {recipient.staffCode} · {recipient.displayName}
              </span>
              <StatusIndicator
                label={recipient.readAt ? t("settlements.notices.recipient.read") : t("settlements.notices.recipient.unread")}
                size="sm"
                tone={recipient.readAt ? "success" : "neutral"}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {current.withdrawnAt ? (
        <p className="text-xs text-muted">{t("settlements.notices.list.withdrawnAt", { time: noticeDateTime(locale, current.withdrawnAt) })}</p>
      ) : (
        <form action={formAction} className="flex items-center gap-2">
          <input name="noticeId" type="hidden" value={notice.id} />
          <Button disabled={pending} type="submit" variant="secondary">
            {pending ? t("settlements.notices.action.withdrawing") : t("settlements.notices.action.withdraw")}
          </Button>
          {formError ? (
            <span className="text-sm text-danger" role="alert">
              {formError}
            </span>
          ) : null}
        </form>
      )}
    </li>
  );
}

export function NoticeWorkspace({
  locale,
  notices,
  targetOptions
}: {
  locale: Locale;
  notices: TherapistNoticeAdminDetailDto[];
  targetOptions: TherapistNoticeTargetOptionDto[];
}) {
  const t = useT();

  return (
    <>
      <SendNoticeForm targetOptions={targetOptions} />
      <h2 className="mb-3 text-base font-semibold text-foreground">{t("settlements.notices.list.title")}</h2>
      {notices.length === 0 ? (
        <ScreenState description={t("settlements.notices.list.empty.description")} kind="empty" label={t("common.screenState.empty")} title={t("settlements.notices.list.empty.title")} />
      ) : (
        <ul className="grid gap-3">
          {notices.map((notice) => (
            <NoticeCard key={notice.id} locale={locale} notice={notice} />
          ))}
        </ul>
      )}
    </>
  );
}
