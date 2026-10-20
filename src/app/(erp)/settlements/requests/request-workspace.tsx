"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateCapsule } from "@/components/ui/date-capsule";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { therapistRequestKindLabel, therapistRequestStatusLabel } from "@/lib/i18n/codes";
import { useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import {
  approveTherapistDayOffRequestAction,
  rejectTherapistRequestAction,
  type TherapistRequestActionState
} from "@/app/(erp)/settlements/requests/actions";
import type { TherapistRequestAdminListItemDto } from "@/modules/therapists/therapist-request-service";

// 06의 근태 달력(formatFullDate)과 같은 이유로 "날짜만"은 UTC로 고정해 영업 시간대 보정이 날짜를
// 밀지 않게 한다. 처리 시각 같은 타임스탬프는 formatDateTime(영업 시간대)을 그대로 쓴다.
function formatRequestDate(locale: Locale, isoDate: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(
    new Date(`${isoDate}T00:00:00.000Z`)
  );
}

function formatResolvedAt(locale: Locale, value: string) {
  return `${formatDateTime(locale, value, { dateStyle: "short" })} · ${formatDateTime(locale, value, { timeStyle: "short" })}`;
}

const STATUS_TONE: Record<TherapistRequestAdminListItemDto["status"], StatusTone> = {
  pending: "info",
  approved: "success",
  rejected: "danger",
  canceled: "neutral",
  expired: "neutral"
};

/**
 * 신청 한 건(승인함, 티켓 08). 종류·대상·상태를 머리에, 사유·신청 시각(정정만)·처리 내역을 아래
 * dl에 둔다. 대기 중(기한 지남 제외)일 때만 승인·거절 버튼을 보인다. 09가 정정 요청을 더할 때는
 * 이 카드 모양 그대로에 신청한 출근·퇴근 줄만 채워지면 된다(requestedCheckInTime/Out이 이미 자리를 둠).
 */
function RequestCard({ locale, request }: { locale: Locale; request: TherapistRequestAdminListItemDto }) {
  const t = useT();
  const [approveState, approveAction, approvePending] = useActionState<TherapistRequestActionState, FormData>(approveTherapistDayOffRequestAction, null);
  const [rejectState, rejectAction, rejectPending] = useActionState<TherapistRequestActionState, FormData>(rejectTherapistRequestAction, null);
  const [rejecting, setRejecting] = useState(false);
  const reasonId = useId();
  const reasonErrorId = useId();

  const current = rejectState?.ok ? rejectState.data : approveState?.ok ? approveState.data : request;
  const approveError = approveState && !approveState.ok ? approveState.formError : undefined;
  const rejectFieldError = rejectState && !rejectState.ok ? rejectState.fieldErrors?.reason?.[0] : undefined;
  const rejectFormError = rejectState && !rejectState.ok && !rejectFieldError ? rejectState.formError : undefined;
  const isActionable = current.status === "pending";

  return (
    <li className="grid gap-2 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <DateCapsule>{formatRequestDate(locale, current.targetDate)}</DateCapsule>
        <StatusIndicator label={therapistRequestKindLabel(locale, current.kind)} size="sm" tone={current.kind === "special_day_off" ? "danger" : "neutral"} />
        <span className="text-sm font-semibold text-foreground">
          {current.staffCode} · {current.displayName}
        </span>
        <StatusIndicator label={therapistRequestStatusLabel(locale, current.status)} size="sm" tone={STATUS_TONE[current.status]} />
      </div>

      <dl className="grid gap-0">
        <DetailRow label={t("settlements.requests.row.reasonLabel")} value={current.reason ?? t("settlements.requests.row.noReason")} />
        {/* 정정 요청(09)만 채운다. 휴무 신청은 항상 비어 있어 이 두 줄이 보이지 않는다. */}
        {current.requestedCheckInTime ? (
          <DetailRow label={t("settlements.requests.row.requestedCheckInLabel")} value={current.requestedCheckInTime} />
        ) : null}
        {current.requestedCheckOutTime ? (
          <DetailRow label={t("settlements.requests.row.requestedCheckOutLabel")} value={current.requestedCheckOutTime} />
        ) : null}
        {current.resolutionReason ? <DetailRow label={t("settlements.requests.action.rejectReasonLabel")} value={current.resolutionReason} /> : null}
        {current.resolvedByName && current.resolvedAt ? (
          <DetailRow
            label={therapistRequestStatusLabel(locale, current.status)}
            value={t("settlements.requests.row.resolvedBy", { name: current.resolvedByName, time: formatResolvedAt(locale, current.resolvedAt) })}
          />
        ) : null}
      </dl>

      {current.assignedCallCount !== null && current.assignedCallCount > 0 ? (
        <StatusIndicator label={t("settlements.requests.row.assignedCalls", { count: current.assignedCallCount })} tone="warning" />
      ) : null}

      {isActionable ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <form action={approveAction}>
              <input name="requestId" type="hidden" value={current.id} />
              <Button disabled={approvePending || rejecting} type="submit">
                {approvePending ? t("settlements.requests.action.approving") : t("settlements.requests.action.approve")}
              </Button>
            </form>
            {!rejecting ? (
              <Button disabled={approvePending} onClick={() => setRejecting(true)} type="button" variant="secondary">
                {t("settlements.requests.action.reject")}
              </Button>
            ) : null}
          </div>
          {approveError ? (
            <span className="text-sm text-danger" role="alert">
              {approveError}
            </span>
          ) : null}
          {rejecting ? (
            <form action={rejectAction} className="grid gap-2 rounded-md border border-border bg-surface-float p-3">
              <input name="requestId" type="hidden" value={current.id} />
              <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={reasonId}>
                {t("settlements.requests.action.rejectReasonLabel")}
                <textarea
                  aria-describedby={rejectFieldError ? reasonErrorId : undefined}
                  aria-invalid={rejectFieldError ? "true" : undefined}
                  className={inputFieldClassName({ className: "h-auto min-h-20 py-2", invalid: Boolean(rejectFieldError) })}
                  disabled={rejectPending}
                  id={reasonId}
                  name="reason"
                  placeholder={t("settlements.requests.action.rejectReasonPlaceholder")}
                />
                {rejectFieldError ? (
                  <span className="text-sm text-danger" id={reasonErrorId} role="alert">
                    {rejectFieldError}
                  </span>
                ) : null}
              </label>
              {rejectFormError ? (
                <span className="text-sm text-danger" role="alert">
                  {rejectFormError}
                </span>
              ) : null}
              <div className="flex items-center gap-2">
                <Button disabled={rejectPending} type="submit" variant="secondary">
                  {rejectPending ? t("settlements.requests.action.rejecting") : t("settlements.requests.action.rejectSubmit")}
                </Button>
                <Button disabled={rejectPending} onClick={() => setRejecting(false)} type="button" variant="ghost">
                  {t("settlements.requests.action.rejectCancel")}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function RequestWorkspace({ locale, requests }: { locale: Locale; requests: TherapistRequestAdminListItemDto[] }) {
  const t = useT();

  if (requests.length === 0) {
    return (
      <ScreenState
        description={t("settlements.requests.list.empty.description")}
        kind="empty"
        label={t("common.screenState.empty")}
        title={t("settlements.requests.list.empty.title")}
      />
    );
  }

  return (
    <>
      <h2 className="mb-3 text-base font-semibold text-foreground">{t("settlements.requests.list.title")}</h2>
      <ul className="grid gap-3">
        {requests.map((request) => (
          <RequestCard key={request.id} locale={locale} request={request} />
        ))}
      </ul>
    </>
  );
}
