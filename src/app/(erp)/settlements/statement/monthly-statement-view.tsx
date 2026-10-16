"use client";

import { useEffect, useState } from "react";
import { PayoutStatusIndicator } from "@/app/(erp)/settlements/payout-confirmation-panel";
import { AmountText, PanelSection, vnd } from "@/app/(erp)/settlements/settlement-parts";
import { therapistEvidenceAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { rateStatus, roleKey } from "@/app/(erp)/settlements/therapist-settlement-view";
import { COUNT_KING_MIN_CALLS, FULL_ATTENDANCE_THRESHOLD_DAYS } from "@/modules/closing/monthly-closing-thresholds";
import { ledgerCallHref } from "@/lib/ledger-address";
import { Button } from "@/components/ui/button";
import { DateCapsule } from "@/components/ui/date-capsule";
import { DetailRow } from "@/components/ui/detail-row";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { resolveKoreanMessage } from "@/lib/i18n/errors";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { serviceStatusLabel } from "@/lib/i18n/codes";
import { settlementBasisText } from "@/lib/i18n/settlement-basis";
import type {
  MonthlyStatementDailyEntryDto,
  MonthlyStatementDto,
  MonthlyStatementTherapistSummaryDto
} from "@/modules/closing/monthly-statement-service";

/**
 * 월 명세서 화면(스펙 F05, 티켓 32). 서비스가 돌려준 값을 그대로 그린다 — 금액·근거를 다시 계산하지 않는다.
 * 마감 버전을 보는 중이면(evidence.available === false) 날짜별 근거 자리에 "저장되지 않았습니다" 안내만 둔다
 * (서비스 doc 참고). 인쇄는 브라우저 인쇄 대화상자를 그대로 쓰고(PDF 저장도 같은 경로), 인쇄 버튼·고르기
 * 폼은 print:hidden으로 인쇄물에서 뺀다.
 */

function formatFullDateTime(locale: Locale, value: string | null) {
  if (!value) return "";
  return formatDateTime(locale, value, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusLabel(t: Translator, result: MonthlyStatementDto) {
  return result.isConfirmed ? t("settlements.statement.status.confirmed", { version: result.closeVersion ?? 0 }) : t("settlements.statement.status.draft");
}

function fullAttendanceText(t: Translator, locale: Locale, summary: MonthlyStatementTherapistSummaryDto) {
  if (summary.fullAttendanceDays === null) {
    return t("settlements.statement.basis.fullAttendance.sourceMissing");
  }
  if (summary.fullAttendanceDays >= FULL_ATTENDANCE_THRESHOLD_DAYS) {
    return t("settlements.statement.basis.fullAttendance.eligible", {
      days: summary.fullAttendanceDays,
      amount: formatNumber(locale, summary.fullAttendanceAllowanceAmount)
    });
  }
  return t("settlements.statement.basis.fullAttendance.belowThreshold", { days: summary.fullAttendanceDays });
}

function countKingText(t: Translator, locale: Locale, summary: MonthlyStatementTherapistSummaryDto) {
  if (summary.countKingRank) {
    return t("settlements.statement.basis.countKing.ranked", {
      count: summary.totalCallCount,
      rank: summary.countKingRank,
      amount: formatNumber(locale, summary.countKingBonusAmount)
    });
  }
  if (summary.totalCallCount >= COUNT_KING_MIN_CALLS) {
    return t("settlements.statement.basis.countKing.eligibleNoRank", { count: summary.totalCallCount });
  }
  return t("settlements.statement.basis.countKing.excluded", { count: summary.totalCallCount });
}

function SummarySection({ result, locale, t }: { result: MonthlyStatementDto; locale: Locale; t: Translator }) {
  const summary = result.summary;
  const countSuffix = t("settlements.countSuffix");

  return (
    <PanelSection title={t("settlements.statement.summary.breakdownTitle")}>
      {summary === null ? (
        <p className="text-sm text-muted">{t("settlements.statement.summary.noRow")}</p>
      ) : (
        <dl>
          {summary.kind === "THERAPIST" ? (
            <>
              <DetailRow label={t("settlements.statement.summary.therapist.totalCalls")} value={`${summary.totalCallCount}${countSuffix}`} />
              <DetailRow label={t("settlements.statement.summary.therapist.monthlySettlement")} value={vnd(locale, summary.monthlySettlementAmount)} />
              <DetailRow
                label={t("settlements.statement.summary.therapist.fullAttendance")}
                value={
                  <span className="grid justify-end gap-0.5">
                    <span>{vnd(locale, summary.fullAttendanceAllowanceAmount)}</span>
                    <span className="text-xs font-normal text-muted">{fullAttendanceText(t, locale, summary)}</span>
                  </span>
                }
              />
              <DetailRow
                label={t("settlements.statement.summary.therapist.countKing")}
                value={
                  <span className="grid justify-end gap-0.5">
                    <span>{vnd(locale, summary.countKingBonusAmount)}</span>
                    <span className="text-xs font-normal text-muted">{countKingText(t, locale, summary)}</span>
                  </span>
                }
              />
            </>
          ) : summary.kind === "OPERATIONS" ? (
            <>
              <DetailRow
                label={t("settlements.statement.summary.operations.daily")}
                value={
                  <span className="grid justify-end gap-0.5">
                    <span>{vnd(locale, summary.dailyIncentiveAmount)}</span>
                    <span className="text-xs font-normal text-muted">
                      {t("settlements.statement.basis.operations.dailyEvidenceCount", { count: summary.dailyEvidenceCount })}
                    </span>
                  </span>
                }
              />
              <DetailRow
                label={t("settlements.statement.summary.operations.monthly")}
                value={
                  <span className="grid justify-end gap-0.5">
                    <span>{vnd(locale, summary.monthlyIncentiveAmount)}</span>
                    <span className="text-xs font-normal text-muted">
                      {summary.monthlyCalculationBasis
                        ? settlementBasisText(locale, summary.monthlyCalculationBasis)
                        : t("settlements.statement.basis.operations.noPolicy")}
                    </span>
                  </span>
                }
              />
            </>
          ) : null}
        </dl>
      )}
    </PanelSection>
  );
}

function DailyEntryCard({
  entry,
  locale,
  t,
  canOpenLedger
}: {
  entry: MonthlyStatementDailyEntryDto;
  locale: Locale;
  t: Translator;
  canOpenLedger: boolean;
}) {
  const countSuffix = t("settlements.countSuffix");
  return (
    <div className="grid gap-2 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <DateCapsule>{entry.serviceDate}</DateCapsule>
          <span className="text-muted">{entry.attendanceSummary ?? t("settlements.statement.evidence.noAttendance")}</span>
          <span className="text-muted">
            {entry.callCount}
            {countSuffix}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{vnd(locale, entry.amount)}</span>
          {entry.payoutConfirmation ? <PayoutStatusIndicator status={entry.payoutConfirmation.status} t={t} /> : null}
        </span>
      </div>
      {entry.calls.length > 0 ? (
        <ul aria-label={t("settlements.statement.evidence.column.calls")} className="grid gap-1 pl-1">
          {entry.calls.map((call) => {
            const href = canOpenLedger ? ledgerCallHref(call) : null;
            // S9(V08): 적용 정책 근거(코스 수당·0원 정책). 같은 콜에 담당 역할이 둘이면(이중 역할) 둘 다 보인다.
            const policies = entry.appliedPolicies.filter((policy) => policy.serviceCallId === call.serviceCallId);
            const body = (
              <>
                <DateCapsule>{call.startTime}</DateCapsule>
                <span className="font-semibold">{call.courseCode}</span>
                <span>{call.therapistNames.join(", ") || "—"}</span>
                <span className="text-muted">{serviceStatusLabel(locale, call.status)}</span>
                {href ? <span className="font-semibold underline underline-offset-4">{t("settlements.evidenceCall.openLedger")}</span> : null}
              </>
            );
            return (
              <li className="grid gap-1 text-sm" key={call.serviceCallId}>
                <div className="flex flex-wrap items-center gap-2">{href ? <a href={href}>{body}</a> : body}</div>
                {policies.length > 0 ? (
                  <ul aria-label={t("settlements.statement.evidence.appliedPolicy.title")} className="grid gap-1 pl-4">
                    {policies.map((policy) => {
                      const status = rateStatus[policy.rateStatus];
                      return (
                        <li className="flex flex-wrap items-center gap-2 text-xs text-muted" key={`${policy.serviceCallId}-${policy.role}`}>
                          <span>{t(roleKey[policy.role])}</span>
                          <StatusIndicator label={t(status.key)} tone={status.tone} />
                          <AmountText amount={therapistEvidenceAmount(policy)} locale={locale} />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function EvidenceSection({
  result,
  locale,
  t,
  canOpenLedger
}: {
  result: MonthlyStatementDto;
  locale: Locale;
  t: Translator;
  canOpenLedger: boolean;
}) {
  return (
    <PanelSection title={t("settlements.statement.evidence.title")}>
      {!result.evidence.available ? (
        <p className="text-sm text-muted">{resolveKoreanMessage(locale, result.evidence.notice)}</p>
      ) : result.evidence.dailyEntries.length === 0 ? (
        <p className="text-sm text-muted">{t("settlements.statement.evidence.empty.title")}</p>
      ) : (
        <div className="grid gap-2">
          {result.evidence.dailyEntries.map((entry) => (
            <DailyEntryCard canOpenLedger={canOpenLedger} entry={entry} key={entry.serviceDate} locale={locale} t={t} />
          ))}
        </div>
      )}
    </PanelSection>
  );
}

function PayoutUnitsSection({ result, locale, t }: { result: MonthlyStatementDto; locale: Locale; t: Translator }) {
  return (
    <PanelSection title={t("settlements.statement.payout.title")}>
      {result.payoutUnits.length === 0 ? (
        <p className="text-sm text-muted">{t("settlements.statement.payout.empty.title")}</p>
      ) : (
        <ul className="grid gap-2">
          {result.payoutUnits.map((unit, index) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              key={unit.serviceDate ?? `monthly-${index}`}
            >
              <span className="font-semibold text-foreground">{unit.serviceDate ?? t("settlements.statement.payout.monthlyLabel")}</span>
              <PayoutStatusIndicator status={unit.payoutConfirmation.status} t={t} />
              <span className="text-muted">
                {t("settlements.payout.currentAmount")}: {vnd(locale, unit.payoutConfirmation.currentAmount)}
              </span>
              {unit.payoutConfirmation.difference !== null && unit.payoutConfirmation.difference !== 0 ? (
                <span className="text-muted">
                  {t("settlements.payout.difference")}: {vnd(locale, unit.payoutConfirmation.difference)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}

export function MonthlyStatementView({ result, canOpenLedger }: { result: MonthlyStatementDto; canOpenLedger: boolean }) {
  const t = useT();
  const locale = useLocale();
  // 출력 시각: beforeprint에서 그 순간의 시각으로 갱신한다(인쇄물에 실제 출력 시각이 찍히도록).
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    function handleBeforePrint() {
      setPrintedAt(new Date().toISOString());
    }
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  return (
    <div className="grid gap-4">
      <div className="print:hidden">
        <Button onClick={() => window.print()} type="button">
          {t("settlements.statement.print")}
        </Button>
      </div>

      <section aria-label={t("settlements.statement.title")} className="grid gap-4 rounded-lg border border-border bg-surface p-6 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {result.displayName} <span className="text-sm font-normal text-muted">({result.staffCode})</span>
            </h2>
            <p className="text-sm text-muted">
              {t(`settlements.statement.group.${result.employeeGroup}`)} · {result.monthKey} ({result.startDate} ~ {result.endDate})
            </p>
          </div>
          <StatusIndicator label={statusLabel(t, result)} tone={result.isConfirmed ? "success" : "neutral"} />
        </div>

        {result.isConfirmed ? (
          <p className="text-sm text-muted">
            {t("settlements.statement.confirmedMeta", {
              confirmedAt: formatFullDateTime(locale, result.confirmedAt),
              confirmedBy: result.confirmedByAccountId ?? ""
            })}
          </p>
        ) : null}
        {result.reopenedAt ? (
          <p className="text-sm text-muted">
            {t("settlements.statement.reopenedMeta", {
              reopenedAt: formatFullDateTime(locale, result.reopenedAt),
              reason: result.reopenReason ?? ""
            })}
          </p>
        ) : null}

        <div>
          <p className="text-sm text-muted">{t("settlements.statement.summary.finalAmount")}</p>
          <p className="text-3xl font-bold text-foreground">{vnd(locale, result.finalAmount)}</p>
        </div>

        <SummarySection locale={locale} result={result} t={t} />
        <EvidenceSection canOpenLedger={canOpenLedger} locale={locale} result={result} t={t} />
        <PayoutUnitsSection locale={locale} result={result} t={t} />

        <div className="grid gap-1 border-t border-border pt-3 text-xs text-muted">
          <p>{t("settlements.statement.printedAt", { timestamp: formatFullDateTime(locale, printedAt) })}</p>
          <p>{t("settlements.statement.disclaimer")}</p>
        </div>
      </section>
    </div>
  );
}
