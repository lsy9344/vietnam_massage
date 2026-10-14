import type { ReactNode } from "react";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { createTranslator } from "@/lib/i18n";
import { codeLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { DailyCallLedgerSummaryDto } from "@/modules/calls/service-call-service";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="flex min-h-7 items-center text-muted">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function formatters(locale: Locale) {
  const t = createTranslator(locale);
  return {
    t,
    count: (value: number) => `${formatNumber(locale, value)}${t("live.countSuffix")}`,
    amount: (value: number) => formatCurrencyVnd(locale, value),
    vnd: (value: number) => `${formatCurrencyVnd(locale, value)} ${t("live.vndSuffix")}`
  };
}

/**
 * 실시간 화면 맨 위 요약 카드(design.md 6.7): 건수는 민트, 결제합계·순매출은 라벤더. 값은 모두 콜 서비스
 * (getDailyCallLedgerSummary)가 준 그대로다. 현금·계좌 잔액은 하루 수납·지출 탭에 있고 여기에는 두지 않는다.
 */
export function LiveSummaryCards({ summary, locale }: { summary: DailyCallLedgerSummaryDto; locale: Locale }) {
  const { t, count, amount } = formatters(locale);
  const warningTotal =
    summary.warningCounts.coursePolicyMissing + summary.warningCounts.therapistRateMissing + summary.warningCounts.secondTherapistRequired;

  return (
    <div className="mb-6 grid gap-4">
      <SummaryCards label={t("live.kpi.aria")}>
        {/* REQ-009: 예약건수는 상태가 아니라 원장에 등록된 전체 건수다(방문완료·노쇼·취소로 바뀌어도 빠지지 않음). */}
        <SummaryCard accent="mint" label={t("live.summary.reservationCount")} value={count(summary.reservationCount)} />
        <SummaryCard accent="mint" label={t("live.summary.inUse")} value={count(summary.inUseCount)} />
        <SummaryCard accent="lavender" label={t("live.kpi.paymentTotal")} unit={t("live.vndSuffix")} value={amount(summary.paymentTotal)} />
        <SummaryCard accent="lavender" label={t("live.kpi.netSales")} unit={t("live.vndSuffix")} value={amount(summary.netSales)} />
      </SummaryCards>
      {warningTotal > 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusIndicator label={t("calls.cashbook.warnings.count", { count: warningTotal })} tone="warning" />
          <span className="text-sm text-foreground">
            {t("live.warning.excluded", {
              policy: summary.warningCounts.coursePolicyMissing,
              rate: summary.warningCounts.therapistRateMissing,
              second: summary.warningCounts.secondTherapistRequired
            })}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** 객실판 아래의 나머지 숫자: 상태별 건수 전체, 결제수단별 합계, 코스별 방문완료. */
export function LiveSummaryDetails({ summary, locale }: { summary: DailyCallLedgerSummaryDto; locale: Locale }) {
  const { t, count, vnd } = formatters(locale);
  const statusRows: Array<{ labelKey: MessageKey; value: number; tone: StatusTone | null }> = [
    { labelKey: "live.summary.reservationCount", value: summary.reservationCount, tone: null },
    { labelKey: "live.summary.inUse", value: summary.inUseCount, tone: "info" },
    { labelKey: "live.summary.cleaning", value: summary.cleaningCount, tone: "info" },
    { labelKey: "live.summary.completed", value: summary.completedCount, tone: "success" },
    { labelKey: "live.summary.noShow", value: summary.noShowCount, tone: "warning" },
    { labelKey: "live.summary.canceled", value: summary.canceledCount, tone: "neutral" }
  ];

  return (
    <div className="mt-10 grid grid-cols-1 gap-4 min-[840px]:grid-cols-3">
      <Card title={t("live.summary.aria")}>
        <dl className="mt-2">
          {statusRows.map((row) => {
            const label = t(row.labelKey);
            return (
              <Row
                key={row.labelKey}
                label={row.tone ? <StatusIndicator label={label} tone={row.tone} /> : label}
                value={count(row.value)}
              />
            );
          })}
        </dl>
      </Card>
      <Card title={t("live.payment.aria")}>
        {/* REQ-004: 카운터 직원이 돈통 현금 흐름을 한눈에 보도록 결제수단별 집계를 첫화면에도 노출한다. */}
        <dl className="mt-2">
          <Row label={codeLabel(locale, "PAYMENT_METHOD", "CASH", true)} value={vnd(summary.paymentMethodTotals.cash)} />
          <Row label={codeLabel(locale, "PAYMENT_METHOD", "CARD", true)} value={vnd(summary.paymentMethodTotals.card)} />
          <Row label={codeLabel(locale, "PAYMENT_METHOD", "BANK_TRANSFER", true)} value={vnd(summary.paymentMethodTotals.bank)} />
          <Row label={codeLabel(locale, "PAYMENT_METHOD", "OTHER", true)} value={vnd(summary.paymentMethodTotals.other)} />
        </dl>
      </Card>
      <Card title={t("live.kpi.courseCompleted")}>
        <dl className="mt-2">
          {summary.courseSummaries.map((course) => (
            <Row key={course.courseCode} label={course.courseCode} value={count(course.completedCount)} />
          ))}
        </dl>
      </Card>
    </div>
  );
}
