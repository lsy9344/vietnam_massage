import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { resolveDomainErrorMessage, resolveKoreanMessage } from "@/lib/i18n/errors";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import { linkToScreen } from "@/lib/routes";
import {
  getMonthlyClosingSnapshot,
  MonthlyClosingDomainError,
  type MonthlyClosingDto
} from "@/modules/closing/monthly-closing-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  listOpsMonthlyIncentivePreview,
  type OpsMonthlyIncentiveResultDto
} from "@/modules/settlements/ops-monthly-incentive-service";
import { OpsMonthlyView } from "@/app/(erp)/settlements/operations/monthly/ops-monthly-view";
import {
  amountLabel,
  AmountText,
  EvidenceCallItem,
  EvidenceCallList,
  SettlementEmptyNotice,
  SettlementErrorNotice,
  SettlementWarningLine,
  summaryAmount,
  vnd
} from "@/app/(erp)/settlements/settlement-parts";
import { EMPLOYEE_PARAM, incentiveRuleHasBasis, settlementAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { DetailRow } from "@/components/ui/detail-row";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";

type OpsMonthlyIncentivePageSearchParams = {
  operatingMonthId?: string;
  employee?: string;
};

function formatShare(value: number) {
  return `${Math.round(value * 10000) / 100}%`;
}

// Dynamic-threshold ops warning ("{n}콜 미만으로 운영팀 월 인센이 없습니다.") has a runtime number, so the
// fixed Korean→vi map can't match it; rebuild from the captured threshold. Localized to this page.
const OPS_BELOW_THRESHOLD_PATTERN = /^(\d+)콜 미만으로 운영팀 월 인센이 없습니다\.$/;

function opsMonthlyWarningPart(locale: Locale, message: string) {
  if (locale === "vi") {
    const match = OPS_BELOW_THRESHOLD_PATTERN.exec(message);
    if (match) {
      return `Dưới ${match[1]} cuộc gọi nên không có thưởng tháng nhóm vận hành.`;
    }
  }
  return resolveKoreanMessage(locale, message);
}

/**
 * Translates the ops-monthly warning string at the display boundary. The service may join several
 * fixed warnings with " " (mergeWarningMessages), so split on the sentence boundary, translate each
 * part (dynamic-threshold regex first, then the fixed Korean→vi map), then re-join.
 */
function opsMonthlyWarningText(locale: Locale, message: string) {
  if (locale !== "vi") return message;
  return message
    .split(/(?<=다\.)\s+/)
    .map((part) => opsMonthlyWarningPart(locale, part))
    .join(" ");
}

function warningTotal(result: OpsMonthlyIncentiveResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
  );
}

function thresholdLabel(t: Translator, result: OpsMonthlyIncentiveResultDto) {
  if (result.ruleStatus === "missing_policy") return t("settlements.opsMonthly.threshold.missingPolicy");
  if (result.ruleStatus === "below_threshold") return t("settlements.opsMonthly.threshold.belowThreshold");
  return t("settlements.opsMonthly.threshold.applied", { count: result.appliedThresholdCallCount ?? 0 });
}

const sectionClassName = "rounded-lg border border-border bg-surface p-4";

function PreviewNotice({ locale, t, selectedMonth, result }: { locale: Locale; t: Translator; selectedMonth: { status: string }; result: OpsMonthlyIncentiveResultDto }) {
  const isClosed = result.isClosedOrLocked;
  const isReopenedReview = selectedMonth.status === "검토중";
  return (
    <section className={sectionClassName}>
      <div className="flex flex-wrap items-center gap-3">
        <StatusIndicator
          label={isClosed ? t("settlements.opsMonthly.preview.current") : t("settlements.opsMonthly.preview.draft")}
          tone={isClosed ? "info" : "neutral"}
        />
        <span className="text-sm font-semibold text-foreground">
          {t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {isClosed
          ? t("settlements.opsMonthly.preview.closedDescription")
          : isReopenedReview
            ? t("settlements.opsMonthly.preview.reviewDescription")
            : t("settlements.opsMonthly.preview.draftDescription")}
      </p>
    </section>
  );
}

function SnapshotSummary({ locale, t, closing, currentStatus }: { locale: Locale; t: Translator; closing: MonthlyClosingDto; currentStatus: string }) {
  const operations = closing.snapshot.operations;
  const isHistoricalAfterReopen = currentStatus === "검토중" && closing.reopenedAt !== null;
  const label = isHistoricalAfterReopen ? t("settlements.opsMonthly.snapshot.previous") : t("settlements.opsMonthly.snapshot.confirmed");
  const heading = isHistoricalAfterReopen
    ? t("settlements.opsMonthly.snapshot.headingPrevious", { monthKey: closing.snapshot.month.monthKey })
    : t("settlements.opsMonthly.snapshot.headingConfirmed", { monthKey: closing.snapshot.month.monthKey });
  return (
    <section aria-label={t("settlements.opsMonthly.snapshot.aria", { label })} className={sectionClassName}>
      <StatusIndicator label={label} tone={isHistoricalAfterReopen ? "neutral" : "success"} />
      <h2 className="mt-3 text-[0.9375rem] font-semibold text-foreground">{heading}</h2>
      <p className="mt-1 text-sm text-muted">
        {t("settlements.opsMonthly.snapshot.meta", { id: closing.snapshot.id, version: closing.closeVersion, confirmedAt: closing.confirmedAt })}
      </p>
      {isHistoricalAfterReopen ? <p className="mt-1 text-sm text-muted">{t("settlements.opsMonthly.snapshot.currentEditable")}</p> : null}
      <dl className="mt-3">
        <DetailRow label={t("settlements.opsMonthly.snapshot.totalPayout")} value={vnd(locale, operations.totalOpsPayoutAmount)} />
        <DetailRow label={t("settlements.opsMonthly.snapshot.dailyIncentive")} value={vnd(locale, operations.dailyIncentiveAmount)} />
        <DetailRow label={t("settlements.opsMonthly.snapshot.monthlyIncentive")} value={vnd(locale, operations.monthlyIncentiveAmount)} />
        <DetailRow
          label={t("settlements.opsMonthly.snapshot.monthlyTotalCalls")}
          value={`${operations.monthlyOpsCallCredit}${t("settlements.callSuffix")}`}
        />
      </dl>
    </section>
  );
}

function ShareSummary({ locale, t, result }: { locale: Locale; t: Translator; result: OpsMonthlyIncentiveResultDto }) {
  const hasBasis = incentiveRuleHasBasis(result.ruleStatus);
  const rows = [
    [t("settlements.opsMonthly.share.lead"), result.shares.leadShare, result.shares.leadAmount],
    [t("settlements.opsMonthly.share.counterTeam"), result.shares.counterTeamShare, result.shares.counterTeamAmount],
    [t("settlements.opsMonthly.share.waiterTeam"), result.shares.waiterTeamShare, result.shares.waiterTeamAmount]
  ] as const;
  return (
    <section aria-label={t("settlements.opsMonthly.share.title")} className={sectionClassName}>
      <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("settlements.opsMonthly.share.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("settlements.opsMonthly.share.description")}</p>
      <dl className="mt-2">
        {rows.map(([label, share, amount]) => (
          <DetailRow
            key={label}
            label={label}
            value={
              <>
                <AmountText amount={settlementAmount(amount, hasBasis)} locale={locale} />
                {hasBasis ? (
                  <span className="ml-2 font-normal text-muted">{t("settlements.opsMonthly.share.ratio", { value: formatShare(share) })}</span>
                ) : null}
              </>
            }
          />
        ))}
      </dl>
    </section>
  );
}

export default async function OperationsMonthlyIncentivePage({
  searchParams
}: {
  searchParams: Promise<OpsMonthlyIncentivePageSearchParams>;
}) {
  const account = await requireRouteAccess("/settlements/operations/monthly");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/settlements/operations/monthly" title={t("settlements.opsMonthly.title")} />
        <NoOperatingMonthNotice description={t("settlements.opsMonthly.emptyMonthDescription")} locale={locale} role={account.role} />
      </div>
    );
  }

  let result: OpsMonthlyIncentiveResultDto | null = null;
  let closingSnapshot: MonthlyClosingDto | null = null;
  let snapshotErrorMessage: string | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: selectedMonth.id
    });
    if (result.isClosedOrLocked || selectedMonth.status === "검토중") {
      try {
        const snapshot = await getMonthlyClosingSnapshot({
          operatingMonthId: selectedMonth.id
        });
        closingSnapshot = result.isClosedOrLocked || snapshot.reopenedAt !== null ? snapshot : null;
      } catch (error) {
        if (error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND") {
          snapshotErrorMessage = t("settlements.opsMonthly.snapshotNotFound");
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) console.error("[settlements/operations/monthly] load error", error);
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
    const koFallback = error instanceof Error ? error.message : t("settlements.opsMonthly.error.fallback");
    errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
  }

  const context = { operatingMonthId: selectedMonth.id, date: null };
  const canOpenLedger = linkToScreen(account.role, "/calls", context) !== null;
  const hasBasis = result ? incentiveRuleHasBasis(result.ruleStatus) : false;
  const visibleEvidence = result ? result.callEvidence.slice(0, 50) : [];

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={context}
        dateControls={
          <DateContextControls date={null} locale={locale} months={operatingMonths} path="/settlements/operations/monthly" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements/operations/monthly"
        title={t("settlements.opsMonthly.title")}
      />

      {errorMessage ? (
        <SettlementErrorNotice
          locale={locale}
          message={errorMessage}
          query={{ operatingMonthId: selectedMonth.id }}
          title={t("settlements.opsMonthly.error.title")}
        />
      ) : result ? (
        <div className="grid gap-6">
          {closingSnapshot ? <SnapshotSummary closing={closingSnapshot} currentStatus={selectedMonth.status} locale={locale} t={t} /> : null}
          {snapshotErrorMessage ? (
            <SettlementWarningLine detail={snapshotErrorMessage} label={t("settlements.opsMonthly.snapshotMissing.title")} />
          ) : null}
          <PreviewNotice locale={locale} result={result} selectedMonth={selectedMonth} t={t} />
          <div className="grid gap-4">
            <SummaryCards label={t("settlements.opsMonthly.summary.aria")}>
              <SummaryCard
                accent="mint"
                label={t("settlements.opsMonthly.summary.monthlyTotalCalls")}
                note={t("settlements.opsMonthly.summary.monthlyTotalCallsBasis", { count: result.sourceCallCount })}
                value={`${result.monthlyOpsCallCredit}${t("settlements.callSuffix")}`}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.opsMonthly.summary.totalMonthly")}
                note={`${t("settlements.opsMonthly.summary.appliedThreshold")}: ${thresholdLabel(t, result)}`}
                {...summaryAmount(settlementAmount(result.totalMonthlyIncentiveAmount, hasBasis), locale)}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.opsMonthly.summary.employeeTotal")}
                note={t("settlements.opsMonthly.summary.undistributed", {
                  amount: amountLabel(settlementAmount(result.shares.undistributedAmount, hasBasis), locale)
                })}
                {...summaryAmount(
                  settlementAmount(
                    result.rows.reduce((sum, row) => sum + row.payoutAmount, 0),
                    hasBasis
                  ),
                  locale
                )}
              />
            </SummaryCards>
            {result.warningMessage ? (
              <SettlementWarningLine detail={opsMonthlyWarningText(locale, result.warningMessage)} label={t("settlements.opsMonthly.warning.title")} />
            ) : null}
            {warningTotal(result) > 0 ? (
              <SettlementWarningLine
                detail={t("settlements.opsMonthly.summary.warningBreakdown", {
                  notCompleted: result.warningCounts.notCompleted,
                  policyMissing: result.warningCounts.coursePolicyMissing,
                  rateMissing: result.warningCounts.therapistRateMissing,
                  secondRequired: result.warningCounts.secondTherapistRequired
                })}
                label={t("settlements.warning.excluded", { count: warningTotal(result) })}
              />
            ) : null}
          </div>
          <ShareSummary locale={locale} result={result} t={t} />
          {result.rows.length > 0 ? (
            <OpsMonthlyView initialEmployeeId={params[EMPLOYEE_PARAM] ?? null} key={selectedMonth.id} result={result} />
          ) : (
            <SettlementEmptyNotice
              description={t("settlements.opsMonthly.employeeTable.empty.description")}
              locale={locale}
              title={t("settlements.opsMonthly.employeeTable.empty.title")}
            />
          )}
          <section aria-label={t("settlements.opsMonthly.callEvidence.title")} className="grid gap-3">
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("settlements.opsMonthly.callEvidence.title")}</h2>
              {result.callEvidence.length > 0 ? (
                <p className="mt-1 text-sm text-muted">
                  {t("settlements.opsMonthly.callEvidence.description", { count: result.callEvidence.length })}
                </p>
              ) : null}
            </div>
            {visibleEvidence.length > 0 ? (
              <EvidenceCallList label={t("settlements.opsMonthly.callEvidence.title")}>
                {visibleEvidence.map((evidence) => (
                  <li key={evidence.serviceCallId}>
                    <EvidenceCallItem
                      amount={`${evidence.opsCallCredit}${t("settlements.callSuffix")}`}
                      call={evidence.call}
                      canOpenLedger={canOpenLedger}
                      locale={locale}
                      serviceDate={evidence.serviceDate}
                    />
                  </li>
                ))}
              </EvidenceCallList>
            ) : (
              <p className="text-sm text-muted">{t("settlements.opsMonthly.callEvidence.empty.title")}</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
