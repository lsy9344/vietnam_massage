import Link from "next/link";
import { canPerform, requireRouteAccess } from "@/lib/authorization";
import { PageHeader } from "@/components/domain/page-header";
import { ClosingActionPanel, type ConfirmDialogSummary } from "@/app/(erp)/closing/closing-action-panel";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { resolveKoreanMessage } from "@/lib/i18n/errors";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import {
  getMonthlyClosingSnapshot,
  MonthlyClosingDomainError,
  type MonthlyClosingDto
} from "@/modules/closing/monthly-closing-service";
import {
  listMonthlyClosingPreview,
  type MonthlyClosingPreviewDto,
  type MonthlyClosingTherapistRowDto
} from "@/modules/closing/monthly-closing-preview-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type ClosingPageSearchParams = {
  operatingMonthId?: string;
};

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

// The count-king tie-breaker literal mirrors the closing service constant. It stays English
// (audit-stable) and is appended verbatim to the reconstructed basis, exactly like the service does.
const COUNT_KING_TIE_BREAKER_BASIS =
  "tie-breaker: totalCallCount desc, monthlySettlementAmount desc, staffCode asc, Employee.id asc";

// Count-king eligibility threshold; matches COUNT_KING_MIN_CALLS in monthly-closing-preview-service.
const COUNT_KING_MIN_CALLS = 40;

/**
 * Reconstructs the localized full-attendance basis text from the row's structured fields,
 * instead of rendering the Korean `row.fullAttendanceBasis` the service produces for audit/snapshot.
 */
function fullAttendanceBasisText(locale: Locale, t: Translator, row: MonthlyClosingTherapistRowDto) {
  if (row.fullAttendanceDays === null) {
    return t("closing.therapist.basis.fullAttendance.sourceMissing");
  }
  if (row.fullAttendanceDays >= 20) {
    return t("closing.therapist.basis.fullAttendance.eligible", {
      days: row.fullAttendanceDays,
      amount: formatCurrencyVnd(locale, row.fullAttendanceAllowanceAmount)
    });
  }
  return t("closing.therapist.basis.fullAttendance.belowThreshold", { days: row.fullAttendanceDays });
}

/**
 * Reconstructs the localized count-king basis text from the row's structured fields, appending
 * the English tie-breaker literal where the service does (ranked / eligible-no-rank branches).
 */
function countKingBasisText(locale: Locale, t: Translator, row: MonthlyClosingTherapistRowDto) {
  if (row.countKingRank) {
    const text = t("closing.therapist.basis.countKing.ranked", {
      count: row.totalCallCount,
      rank: row.countKingRank,
      amount: formatNumber(locale, row.countKingBonusAmount)
    });
    return `${text} / ${COUNT_KING_TIE_BREAKER_BASIS}`;
  }
  if (row.totalCallCount >= COUNT_KING_MIN_CALLS) {
    const text = t("closing.therapist.basis.countKing.eligibleNoRank", { count: row.totalCallCount });
    return `${text} / ${COUNT_KING_TIE_BREAKER_BASIS}`;
  }
  return t("closing.therapist.basis.countKing.excluded", { count: row.totalCallCount });
}

// Dynamic-threshold ops warning ("{n}콜 미만으로 운영팀 월 인센이 없습니다.") cannot be matched by the
// fixed Korean→vi map, so it is rebuilt from the captured threshold number. Localized to the page.
const OPS_BELOW_THRESHOLD_PATTERN = /^(\d+)콜 미만으로 운영팀 월 인센이 없습니다\.$/;

function opsWarningTextSingle(locale: Locale, message: string) {
  if (locale === "vi") {
    const match = OPS_BELOW_THRESHOLD_PATTERN.exec(message);
    if (match) {
      return `Dưới ${match[1]} cuộc gọi nên không có thưởng tháng nhóm vận hành.`;
    }
  }
  return resolveKoreanMessage(locale, message);
}

/**
 * Translates an ops warning message. The closing service may join several fixed warnings with " ",
 * so we split on the sentence boundary, translate each part, then re-join.
 */
function opsWarningText(locale: Locale, message: string) {
  if (locale !== "vi") return message;
  return message
    .split(/(?<=다\.)\s+/)
    .map((part) => opsWarningTextSingle(locale, part))
    .join(" ");
}

function PreviewNotice({ locale, t, result }: { locale: Locale; t: Translator; result: MonthlyClosingPreviewDto }) {
  const isClosed = result.previewStatus === "closed_current";
  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
          {t("closing.preview.current")}
        </span>
        <span className="text-sm font-semibold text-foreground">{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, result.status)}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {isClosed
          ? t("closing.preview.closedDescription")
          : t("closing.preview.draftDescription")}
      </p>
    </section>
  );
}

function ClosingStepper({ locale, t, status }: { locale: Locale; t: Translator; status: string }) {
  const steps = ["작성중", "검토중", "마감확정", "잠금"];
  const currentIndex = Math.max(steps.indexOf(status), 0);

  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3" aria-label={t("closing.stepper.aria")}>
      <ol className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => {
          const active = index === currentIndex;
          const passed = index < currentIndex;
          return (
            <li
              aria-current={active ? "step" : undefined}
              className={`border px-3 py-2 text-sm ${
                active
                  ? "border-brand bg-brand text-brand-foreground"
                  : passed
                    ? "border-success bg-success/10 text-success"
                    : "border-border bg-background text-muted"
              }`}
              key={step}
            >
              <div className="text-xs font-medium">{t("closing.stepper.step", { index: index + 1 })}</div>
              <div className="font-semibold">{operatingMonthStatusLabel(locale, step)}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SnapshotSummary({ locale, t, closing, currentStatus }: { locale: Locale; t: Translator; closing: MonthlyClosingDto; currentStatus: string }) {
  const isHistoricalAfterReopen = currentStatus === "검토중" && closing.reopenedAt !== null;
  const label = isHistoricalAfterReopen ? t("closing.snapshot.previous") : t("closing.snapshot.confirmed");
  const heading = isHistoricalAfterReopen
    ? t("closing.snapshot.headingPrevious", { monthKey: closing.snapshot.month.monthKey })
    : t("closing.snapshot.headingConfirmed", { monthKey: closing.snapshot.month.monthKey });

  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{label}</div>
          <h2 className="mt-2 text-base font-semibold text-foreground">{heading}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("closing.snapshot.meta", {
              id: closing.snapshot.id,
              version: closing.closeVersion,
              confirmedBy: closing.confirmedByAccountId,
              confirmedAt: closing.confirmedAt
            })}
          </p>
          {isHistoricalAfterReopen ? (
            <p className="mt-1 text-sm text-muted">
              {t("closing.snapshot.reopenMeta", { reason: closing.reopenReason ?? "", reopenedAt: closing.reopenedAt ?? "" })}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-muted">{t("closing.snapshot.totalPayout")}</div>
          <div className="text-lg font-semibold text-foreground tabular-nums">{formatVnd(locale, t, closing.snapshot.totals.grandPayoutAmount)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("closing.snapshot.therapist")}</div>
          <div className="font-semibold tabular-nums">{formatVnd(locale, t, closing.snapshot.totals.therapistPayoutAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("closing.snapshot.operations")}</div>
          <div className="font-semibold tabular-nums">{formatVnd(locale, t, closing.snapshot.operations.totalOpsPayoutAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("closing.snapshot.earcare")}</div>
          <div className="font-semibold tabular-nums">{formatVnd(locale, t, closing.snapshot.totals.earcarePayoutAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("closing.snapshot.warning")}</div>
          <div className="font-semibold tabular-nums">{closing.snapshot.warningCounts.total}{t("settlements.countSuffix")}</div>
        </div>
      </div>
    </section>
  );
}

function SummaryBand({ locale, t, result }: { locale: Locale; t: Translator; result: MonthlyClosingPreviewDto }) {
  const rows = [
    [t("closing.summary.therapistPayout"), result.totals.therapistPayoutAmount, t("closing.summary.therapistBasis", { count: result.therapists.totalCallCount })],
    [t("closing.summary.opsDaily"), result.totals.opsDailyIncentiveAmount, t("closing.summary.opsDailyBasis", { count: result.operations.rows.length })],
    [t("closing.summary.opsMonthly"), result.totals.opsMonthlyIncentiveAmount, t("closing.summary.opsMonthlyBasis", { count: result.operations.monthlyOpsCallCredit })],
    [t("closing.summary.earcarePayout"), result.totals.earcarePayoutAmount, t("closing.summary.earcareBasis", { count: result.earcare.sourceCallCount })],
    [t("closing.summary.grandPayout"), result.totals.grandPayoutAmount, t("closing.summary.grandBasis", { count: result.warningCounts.total })]
  ] as const;

  return (
    <section aria-label={t("closing.summary.aria")} className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {rows.map(([label, amount, basis]) => (
        <div key={label} className="border border-border bg-surface px-4 py-3">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{formatVnd(locale, t, amount)}</div>
          <div className="mt-1 text-xs text-muted">{basis}</div>
        </div>
      ))}
    </section>
  );
}

function confirmSummaryFor(result: MonthlyClosingPreviewDto): ConfirmDialogSummary {
  return {
    monthKey: result.monthKey,
    startDate: result.startDate,
    endDate: result.endDate,
    status: result.status,
    grandPayoutAmount: result.totals.grandPayoutAmount,
    therapistPayoutAmount: result.totals.therapistPayoutAmount,
    therapistCount: result.therapists.rows.length,
    operationsPayoutAmount: result.operations.totalOpsPayoutAmount,
    operationsCount: result.operations.rows.length,
    opsDailyIncentiveAmount: result.totals.opsDailyIncentiveAmount,
    opsMonthlyIncentiveAmount: result.totals.opsMonthlyIncentiveAmount,
    earcarePayoutAmount: result.totals.earcarePayoutAmount,
    earcareCount: result.earcare.rows.length,
    warningCount: result.warningCounts.total
  };
}

function TherapistTable({ locale, t, result }: { locale: Locale; t: Translator; result: MonthlyClosingPreviewDto }) {
  if (result.therapists.rows.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">{t("closing.therapist.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("closing.therapist.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("closing.therapist.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("closing.therapist.description")}</p>
      </div>
      <table className="min-w-[1320px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("closing.therapist.column.therapist")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.therapist.column.monthlyTotalCalls")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.therapist.column.monthlySettlement")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.therapist.column.fullAttendanceDays")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.therapist.column.fullAttendanceAllowance")}</th>
            <th className="border-b border-border px-3 py-2">{t("closing.therapist.column.countKing")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.therapist.column.countKingBonus")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.therapist.column.finalPayout")}</th>
            <th className="border-b border-border px-3 py-2">{t("closing.therapist.column.basis")}</th>
          </tr>
        </thead>
        <tbody>
          {result.therapists.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.totalCallCount}{t("settlements.countSuffix")}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.monthlySettlementAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.fullAttendanceDays === null ? t("closing.therapist.noSource") : `${row.fullAttendanceDays}${t("settlements.daySuffix")}`}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, row.fullAttendanceAllowanceAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.countKingRank ? t("closing.therapist.rank", { rank: row.countKingRank }) : t("closing.therapist.noRank")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, row.countKingBonusAmount)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.finalPayoutAmount)}</td>
              <td className="px-3 py-2 text-muted">
                <div>{fullAttendanceBasisText(locale, t, row)}</div>
                <div>{countKingBasisText(locale, t, row)}</div>
                <div>
                  {t("closing.therapist.evidenceLine", { evidence: row.assignmentEvidenceCount, zero: row.warningCounts.zeroPolicy, missing: row.warningCounts.missingPolicy })}
                </div>
                {row.bonusWarningMessages.length > 0 ? (
                  <div className="mt-1 font-medium text-danger">
                    {row.bonusWarningMessages.map((message) => resolveKoreanMessage(locale, message)).join(" / ")}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OperationsTable({ locale, t, result }: { locale: Locale; t: Translator; result: MonthlyClosingPreviewDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("closing.operations.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("closing.operations.description")}</p>
      </div>
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("closing.operations.column.opsStaff")}</th>
            <th className="border-b border-border px-3 py-2">{t("closing.operations.column.position")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.operations.column.dailyIncentive")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.operations.column.monthlyIncentive")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.operations.column.opsTotal")}</th>
            <th className="border-b border-border px-3 py-2">{t("closing.operations.column.basis")}</th>
          </tr>
        </thead>
        <tbody>
          {result.operations.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2">{row.position}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, row.dailyIncentiveAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, row.monthlyIncentiveAmount)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.totalOpsPayoutAmount)}</td>
              <td className="px-3 py-2 text-muted">
                {t("closing.operations.dailyEvidence", { count: row.dailyEvidenceCount })}
                {row.monthlyCalculationBasis ? ` / ${row.monthlyCalculationBasis}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EarcareTable({ locale, t, result }: { locale: Locale; t: Translator; result: MonthlyClosingPreviewDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("closing.earcare.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("closing.earcare.description")}</p>
      </div>
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("closing.earcare.column.earcareStaff")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.earcare.column.eligibleDays")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("closing.earcare.column.earcarePayout")}</th>
            <th className="border-b border-border px-3 py-2">{t("closing.earcare.column.basis")}</th>
          </tr>
        </thead>
        <tbody>
          {result.earcare.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.eligibleDayCount}{t("settlements.daySuffix")}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EvidenceSection({ locale, t, result }: { locale: Locale; t: Translator; result: MonthlyClosingPreviewDto }) {
  return (
    <section className="mb-4 border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("closing.evidence.title")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("closing.evidence.line1", {
            period: result.evidence.period,
            sourceDayCount: result.evidence.sourceDayCount,
            includedCallCount: result.evidence.includedCallCount,
            excludedCallCount: result.evidence.excludedCallCount
          })}
        </p>
        <p className="mt-1 text-sm text-muted">
          {t("closing.evidence.line2", {
            fullAttendanceSourceStatus: result.evidence.fullAttendanceSourceStatus,
            fullAttendanceSourceDayCount: result.evidence.fullAttendanceSourceDayCount,
            countKingEligibleCount: result.evidence.countKingEligibleCount,
            countKingExcludedCount: result.evidence.countKingExcludedCount,
            countKingTieBreaker: result.evidence.countKingTieBreaker
          })}
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-border px-4 py-3 md:border-r">
          <div className="text-xs font-medium text-muted">{t("closing.evidence.warningCounts")}</div>
          <div className="mt-1 text-sm text-foreground">
            {t("closing.evidence.warningCountsLine", {
              total: result.warningCounts.total,
              policy: result.evidence.policyWarningCount,
              therapistExcluded: result.warningCounts.therapistExcludedCallCount,
              fullAttendanceSourceMissing: result.warningCounts.fullAttendanceSourceMissing,
              fullAttendanceSourceDay: result.warningCounts.fullAttendanceSourceDayCount,
              countKingEligible: result.warningCounts.countKingEligibleCount,
              countKingExcluded: result.warningCounts.countKingExcludedCount,
              opsDaily:
                result.warningCounts.opsDaily.notCompleted +
                result.warningCounts.opsDaily.coursePolicyMissing +
                result.warningCounts.opsDaily.therapistRateMissing +
                result.warningCounts.opsDaily.secondTherapistRequired,
              opsMonthly:
                result.warningCounts.opsMonthly.notCompleted +
                result.warningCounts.opsMonthly.coursePolicyMissing +
                result.warningCounts.opsMonthly.therapistRateMissing +
                result.warningCounts.opsMonthly.secondTherapistRequired,
              opsMessage: result.warningCounts.opsWarningMessageCount,
              earcareNormalStaffZeroDays: result.warningCounts.earcareNormalStaffZeroDays,
              earcareUndistributed: result.warningCounts.earcareUndistributedDays
            })}
          </div>
        </div>
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs font-medium text-muted">{t("closing.evidence.representative")}</div>
          <div className="mt-1 break-all text-sm text-foreground">
            {[
              ...result.evidence.representativeEvidence.therapist,
              ...result.evidence.representativeEvidence.operationsDaily,
              ...result.evidence.representativeEvidence.operationsMonthly,
              ...result.evidence.representativeEvidence.earcare
            ].join(", ") || t("closing.evidence.noEvidence")}
          </div>
        </div>
      </div>
      {result.operations.warningMessages.length > 0 ? (
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-muted">{t("closing.evidence.opsWarning")}</div>
          <ul className="mt-1 list-inside list-disc text-sm text-muted">
            {result.operations.warningMessages.map((message) => (
              <li key={message}>{opsWarningText(locale, message)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default async function ClosingPage({ searchParams }: { searchParams: Promise<ClosingPageSearchParams> }) {
  const account = await requireRouteAccess("/closing");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.closing")}
          title={t("closing.title")}
          description={t("closing.emptyDescription")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("closing.emptyMonthDescription")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  let result: MonthlyClosingPreviewDto | null = null;
  let closingSnapshot: MonthlyClosingDto | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listMonthlyClosingPreview({
      operatingMonthId: selectedMonth.id
    });
    closingSnapshot = await getMonthlyClosingSnapshot({
      operatingMonthId: selectedMonth.id
    });
  } catch (error) {
    if (error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND") {
      closingSnapshot = null;
    } else {
      errorMessage = error instanceof Error ? error.message : t("closing.error.fallback");
    }
  }
  const canWriteClosing = canPerform(account.role, "closing:write");
  const canReopenClosing = canPerform(account.role, "closing:reopen");

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.closing")}
        title={t("closing.title")}
        description={t("closing.description")}
        meta={
          <>
            <div>{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)}</div>
            <div>
              {t("common.dateRange")}: {selectedMonth.startDate} ~ {selectedMonth.endDate}
            </div>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.operatingMonth")}
          <select
            aria-label={t("common.operatingMonth")}
            className="h-9 min-w-44 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={selectedMonth.id}
            name="operatingMonthId"
          >
            {operatingMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
              </option>
            ))}
          </select>
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      <ClosingStepper locale={locale} t={t} status={selectedMonth.status} />
      <ClosingActionPanel
        canReopen={canReopenClosing}
        canWrite={canWriteClosing}
        confirmSummary={result ? confirmSummaryFor(result) : null}
        operatingMonthId={selectedMonth.id}
        status={selectedMonth.status}
      />

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">{t("closing.error.title")}</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              {t("settlements.requery")}
            </button>
          </form>
        </section>
      ) : result ? (
        <>
          {closingSnapshot ? <SnapshotSummary locale={locale} t={t} closing={closingSnapshot} currentStatus={selectedMonth.status} /> : null}
          <PreviewNotice locale={locale} t={t} result={result} />
          <SummaryBand locale={locale} t={t} result={result} />
          <TherapistTable locale={locale} t={t} result={result} />
          <OperationsTable locale={locale} t={t} result={result} />
          <EarcareTable locale={locale} t={t} result={result} />
          <EvidenceSection locale={locale} t={t} result={result} />
        </>
      ) : null}
    </main>
  );
}
