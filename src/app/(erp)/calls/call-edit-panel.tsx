"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { WarningList } from "@/components/ui/warning-summary";
import { PanelSection } from "@/app/(erp)/settlements/settlement-parts";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { calculationErrorMessageKey } from "@/app/(erp)/calls/calculation-status-message";
import { CallConflictCompare, type CallConflictCompareData } from "@/app/(erp)/calls/call-conflict-compare";
import { CallCustomerLinkCorrection } from "@/app/(erp)/calls/call-customer-link-correction";
import { ActualEntryField, firstFieldError, nullableValue, optionLabel, SelectField, TextField } from "@/app/(erp)/calls/call-ledger-fields";
import { isSaveHeld, type CallRowDraft, type CallRowSave } from "@/app/(erp)/calls/call-row-save";
import { CallRowSaveStatus } from "@/app/(erp)/calls/call-row-save-status";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";
import { statusCodeFor } from "@/app/(erp)/calls/ledger-flow";

/** 패널을 열며 옮길 자리. 줄의 "결제"는 결제 묶음, 목록의 Enter는 첫 칸이다. token이 바뀔 때마다 다시 옮긴다. */
export type CallPanelFocusRequest = { target: "first" | "payment"; token: number };

function relatedCallIds(row: ServiceCallRowDto) {
  const ids: string[] = [];
  for (const warning of row.warnings) {
    for (const id of warning.relatedCallIds) {
      if (id !== row.id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

const pillClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly has-checked:border-brand has-checked:bg-brand has-checked:text-brand-foreground has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-secondary";

/**
 * 원장 편집 패널(스펙 D19·D20, 티켓 03). 예전 콜 상세 패널(경고 전체, 관련 콜, 고객 연결 정정)을 합쳤다.
 * 칸은 원장 줄의 저장 상태(callRowSaveReducer)를 그대로 쓴다 — 고치면 초안이 바뀌고, 고르거나 칸을 떠나면 저장한다.
 * 저장 상태 다섯 가지, 낡은 저장 거절, 충돌 비교·다시 반영, 떠나기 안내는 그 줄의 저장 계약 그대로다.
 * `readOnly`(휴대폰 폭, 티켓 26)이면 입력칸 없이 읽기만 한다.
 */
export function CallEditPanel({
  conflict,
  customers,
  focusRequest,
  isLocked,
  onCancel,
  onCommit,
  onEdit,
  onReload,
  onRetry,
  onSelectCall,
  options,
  readOnly,
  row,
  rows,
  save,
  showSettlementAmounts,
  warningsRow
}: {
  conflict: CallConflictCompareData | null;
  customers: CustomerDto[];
  focusRequest: CallPanelFocusRequest | null;
  isLocked: boolean;
  /** Esc: 저장하지 않은 입력을 보내고 있거나 마지막으로 저장된 값으로 되돌린다(Story 2.6). */
  onCancel: () => void;
  /** 고른 값(changes)을 초안에 얹어 저장한다. 값 없이 부르면 지금 초안을 저장한다. */
  onCommit: (changes?: Partial<CallRowDraft>) => void;
  onEdit: (changes: Partial<CallRowDraft>) => void;
  onReload: () => void;
  onRetry: () => void;
  onSelectCall: (callId: string) => void;
  options: ServiceCallFormOptions;
  readOnly: boolean;
  /** 이 화면이 마지막으로 받은 저장 결과(계산값, 표시 종료). */
  row: ServiceCallRowDto;
  rows: ServiceCallRowDto[];
  save: CallRowSave;
  showSettlementAmounts: boolean;
  /** 경고는 다른 콜을 저장해도 바뀐다. 원장이 다시 받은 행과 이 줄의 저장 결과 중 새 쪽이다. */
  warningsRow: ServiceCallRowDto;
}) {
  const t = useT();
  const locale = useLocale();
  const { draft, fieldErrors, status } = save;
  const panelRef = useRef<HTMLDivElement>(null);
  // 고객 연결 정정은 원장 저장과 별개의 작업이라 성공한 행을 이 구역에만 바로 반영한다(원장은 새로고침으로 받는다).
  const [linkRow, setLinkRow] = useState<ServiceCallRowDto | null>(null);
  const disabled = isLocked;
  const visitComplete = statusCodeFor(options.statuses, "visitComplete");

  useEffect(() => {
    if (!focusRequest) return;
    const frame = window.requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      // 결제는 결제 묶음 자체로 간다. 결제수단 알약(라디오)에 바로 두면 화살표 한 번에 고르지 않은 결제수단이 저장된다.
      const target =
        focusRequest.target === "payment"
          ? root.querySelector<HTMLElement>('[data-panel-section="payment"]')
          : root.querySelector<HTMLElement>("[data-call-field]:not(:disabled)");
      target?.scrollIntoView({ block: "nearest" });
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest]);

  const statusLabel = (value: string) => optionLabel(options.statuses, value) || value;
  const related = relatedCallIds(warningsRow)
    .map((id) => rows.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ServiceCallRowDto => Boolean(candidate));

  const warningsSection = (
    <PanelSection title={t("calls.detail.warnings")}>
      {warningsRow.warnings.length === 0 ? (
        <p className="text-sm text-muted">{t("calls.detail.noWarnings")}</p>
      ) : (
        <WarningList label={t("calls.detail.warnings")} warnings={warningsRow.warnings.map((warning) => callWarningLabel(t, warning))} />
      )}
    </PanelSection>
  );

  const relatedSection = (
    <PanelSection title={t("calls.detail.related")}>
      {related.length === 0 ? (
        <p className="text-sm text-muted">{t("calls.detail.noRelated")}</p>
      ) : (
        <ul className="grid gap-2">
          {related.map((call) => (
            <li key={call.id}>
              {/* 목록 행 카드(design.md 6.10). 패널과 같은 --surface 바탕이라 1px 테두리로 나눈다. */}
              <button
                className="grid min-h-14 w-full gap-0.5 rounded-md border border-border bg-surface px-4 py-2.5 text-left text-sm transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                data-related-call={call.id}
                onClick={() => onSelectCall(call.id)}
                type="button"
              >
                <span className="font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                  {call.startTime} · {call.courseLabel} · {call.therapist1?.displayName ?? "-"} · {statusLabel(call.status)}
                </span>
                <span className="text-xs text-muted">
                  {t("calls.actualEntry.displayEnd", { time: call.displayEnd })} · {t("calls.detail.goToCall")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );

  const customerLinkSection = (
    <PanelSection title={t("calls.detail.customerLink.title")}>
      <CallCustomerLinkCorrection
        customers={customers}
        isLocked={isLocked}
        key={row.id}
        onCorrected={setLinkRow}
        row={linkRow ?? warningsRow}
      />
    </PanelSection>
  );

  if (readOnly) {
    return (
      <div className="grid gap-6" data-call-panel={row.id} ref={panelRef}>
        {warningsSection}
        <dl>
          <DetailRow label={t("calls.column.time")} value={row.startTime} />
          <DetailRow label={t("calls.column.actualEntry")} value={row.actualEntryTime ?? "-"} />
          <DetailRow label={t("calls.detail.displayEnd")} value={row.displayEnd} />
          <DetailRow label={t("calls.column.room")} value={row.roomLabel} />
          <DetailRow label={t("calls.column.course")} value={row.courseLabel} />
          <DetailRow label={t("calls.column.therapist1")} value={row.therapist1?.displayName ?? "-"} />
          <DetailRow label={t("calls.column.therapist2")} value={row.therapist2?.displayName ?? "-"} />
          <DetailRow label={t("calls.column.reservationStatus")} value={statusLabel(row.status)} />
          <DetailRow label={t("calls.column.visitRequest")} value={row.visitRequest ?? "-"} />
        </dl>
        {customerLinkSection}
        {relatedSection}
      </div>
    );
  }

  // 자동 저장: 목록에서 고르면 그 값으로 바로, 글자 칸은 칸을 떠날 때 저장한다(예전 원장 칸과 같다).
  const selectProps = (field: keyof CallRowDraft, nullable = true) => ({
    disabled,
    field,
    onBlur: () => onCommit(),
    onChange: (value: string) => onEdit({ [field]: nullable ? nullableValue(value) : value }),
    onCommitValue: (value: string) => onCommit({ [field]: nullable ? nullableValue(value) : value }),
    value: (draft[field] as string | null | undefined) ?? ""
  });
  const textProps = (field: keyof CallRowDraft) => ({
    disabled,
    field,
    onBlur: () => onCommit(),
    onChange: (value: string) => onEdit({ [field]: nullableValue(value) }),
    value: (draft[field] as string | null | undefined) ?? ""
  });

  return (
    // 칸 안의 Esc는 그 입력을 되돌린 뒤 원장 키보드가 그 줄로 포커스를 옮긴다(스펙 D21). 칸을 떠나며 저장해도
    // 되돌린 초안은 저장된 값과 같아 아무것도 보내지 않는다. 열린 선택 목록의 Esc는 목록만 닫는다(preventDefault).
    <div
      className="grid gap-6"
      data-call-panel={row.id}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && (event.target as HTMLElement).closest("[data-call-field]")) onCancel();
      }}
      ref={panelRef}
    >
      <CallRowSaveStatus message={save.message} onReload={onReload} onRetry={onRetry} savedAt={row.savedAt} state={status} />

      {conflict ? (
        <CallConflictCompare compare={conflict} customers={customers} key={conflict.latestRow.updatedAt} options={options} />
      ) : null}

      <PanelSection title={t("calls.panel.section.booking")}>
        <div className="grid gap-3 min-[480px]:grid-cols-2">
          <SelectField {...selectProps("startTime", false)} label={t("calls.column.time")} options={options.timeSlots} required />
          <SelectField {...selectProps("courseId", false)} label={t("calls.column.course")} options={options.courses} required />
        </div>
        <TextField {...textProps("customerMemo")} label={t("calls.column.customerMemo")} />
        <div className="grid gap-3 min-[480px]:grid-cols-2">
          <SelectField {...selectProps("therapist1Id")} label={t("calls.column.therapist1")} options={options.therapists} />
          <SelectField
            {...selectProps("therapist2Id")}
            errorMessage={firstFieldError(fieldErrors, "therapist2Id")}
            label={t("calls.column.therapist2")}
            options={options.therapists}
          />
        </div>
      </PanelSection>

      <PanelSection title={t("calls.panel.section.entry")}>
        <ActualEntryField
          disabled={disabled}
          displayEnd={row.displayEnd}
          errorMessage={firstFieldError(fieldErrors, "actualEntryTime")}
          onBlur={() => onCommit()}
          onChange={(value) => onEdit({ actualEntryTime: nullableValue(value) })}
          onCommitValue={(value) => onCommit({ actualEntryTime: nullableValue(value) })}
          value={draft.actualEntryTime ?? ""}
          warningTime={row.warningTime}
        />
        <div className="grid gap-3 min-[480px]:grid-cols-2">
          <SelectField
            {...selectProps("roomId")}
            emptyLabel={t("calls.placeholder.roomUnassigned")}
            errorMessage={firstFieldError(fieldErrors, "roomId")}
            label={t("calls.column.room")}
            options={options.rooms}
          />
          <SelectField
            {...selectProps("status", false)}
            errorMessage={firstFieldError(fieldErrors, "status")}
            label={t("calls.column.status")}
            options={options.statuses}
            required
          />
        </div>
      </PanelSection>

      <section
        aria-label={t("calls.panel.section.payment")}
        className="grid gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-secondary"
        data-panel-section="payment"
        tabIndex={-1}
      >
        <h3 className="text-[0.9375rem] font-semibold text-foreground">{t("calls.panel.section.payment")}</h3>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold text-muted">{t("calls.column.paymentMethod")}</legend>
          <div className="flex flex-wrap gap-2">
            {[{ value: "", label: t("calls.panel.paymentNone") }, ...options.paymentMethods].map((method) => (
              <label className={pillClass} key={method.value || "none"}>
                <input
                  checked={(draft.paymentMethodCode ?? "") === method.value}
                  className="sr-only"
                  data-payment-method={method.value}
                  disabled={disabled}
                  name={`payment-method-${row.id}`}
                  onChange={() => onCommit({ paymentMethodCode: nullableValue(method.value) })}
                  type="radio"
                  value={method.value}
                />
                {method.label}
              </label>
            ))}
          </div>
        </fieldset>
        <SelectField {...selectProps("discountTypeCode")} label={t("calls.column.discountType")} options={options.discountTypes} />
        <PaymentAmounts row={row} saveHeld={isSaveHeld(status)} showSettlementAmounts={showSettlementAmounts} t={t} locale={locale} />
        <Button
          className="justify-self-start"
          disabled={disabled || !visitComplete || draft.status === visitComplete}
          onClick={() => visitComplete && onCommit({ status: visitComplete })}
          type="button"
        >
          {t("calls.panel.payComplete")}
        </Button>
      </section>

      <PanelSection title={t("calls.panel.section.memo")}>
        <TextField {...textProps("note")} label={t("calls.column.note")} />
      </PanelSection>

      {warningsSection}
      {relatedSection}

      {/* 드물게 쓰는 입력(스펙 D20): 방문별 요청, 확인값, 고객 연결 정정. */}
      <details className="group grid gap-4 rounded-md border border-border px-4 py-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-foreground">{t("calls.panel.more")}</summary>
        <div className="mt-3 grid gap-4">
          <TextField {...textProps("visitRequest")} label={t("calls.column.visitRequest")} />
          <SelectField {...selectProps("confirmationCode")} label={t("calls.column.confirmation")} options={options.confirmationCodes} />
          {customerLinkSection}
        </div>
      </details>
    </div>
  );
}

/**
 * 결제 묶음의 계산값. 저장 실패나 충돌로 초안이 서버와 다르면(isSaveHeld) 옛 계산값 대신 대기 표시를 한다.
 * 수당은 정산 금액을 볼 수 있는 역할(관리자·정산 담당)에게만 보인다.
 */
function PaymentAmounts({
  locale,
  row,
  saveHeld,
  showSettlementAmounts,
  t
}: {
  locale: ReturnType<typeof useLocale>;
  row: ServiceCallRowDto;
  saveHeld: boolean;
  showSettlementAmounts: boolean;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}) {
  const calculated = row.calculationStatus === "calculated" && !saveHeld;
  const amount = (value: number) => (calculated ? formatNumber(locale, value) : "—");
  const statusText = saveHeld
    ? t("calls.calc.errorPending")
    : row.calculationStatus === "calculated"
      ? t("calls.calc.calculated")
      : row.calculationStatus === "not_completed"
        ? t("calls.calc.notCompleted")
        : t(calculationErrorMessageKey(row.calculationStatus));
  const statusIsError = saveHeld || (row.calculationStatus !== "calculated" && row.calculationStatus !== "not_completed");

  return (
    <dl data-calculation-status={row.calculationStatus}>
      <DetailRow
        label={t("calls.column.paymentAmount")}
        value={
          <span className="grid justify-items-end gap-0.5 [font-variant-numeric:tabular-nums]">
            {calculated && row.discountAmount > 0 && row.basePrice > row.paymentAmount ? (
              <span className="text-xs font-normal text-muted line-through">{formatNumber(locale, row.basePrice)}</span>
            ) : null}
            <span className={calculated && row.discountAmount > 0 ? "font-bold" : undefined}>{amount(row.paymentAmount)}</span>
          </span>
        }
      />
      <DetailRow label={t("calls.column.discount")} value={amount(row.discountAmount)} />
      {showSettlementAmounts ? (
        <>
          <DetailRow label={t("calls.column.therapist1Commission")} value={amount(row.therapist1Commission)} />
          <DetailRow label={t("calls.column.therapist2Commission")} value={amount(row.therapist2Commission)} />
        </>
      ) : null}
      <DetailRow
        label={t("calls.panel.calculation")}
        value={<span className={statusIsError ? "text-danger" : undefined}>{statusText}</span>}
      />
    </dl>
  );
}
