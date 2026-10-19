import { DateCapsule } from "@/components/ui/date-capsule";
import { DetailRow } from "@/components/ui/detail-row";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { resolveKoreanMessage } from "@/lib/i18n/errors";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import { COUNT_KING_MIN_CALLS, FULL_ATTENDANCE_THRESHOLD_DAYS } from "@/modules/closing/monthly-closing-thresholds";
import type { TherapistPayoutStatus } from "@/modules/therapists/therapist-payout-status";
import type { TherapistPayoutDailyEntryDto, TherapistPayoutViewDto } from "@/modules/therapists/therapist-payout-view-service";

/**
 * 수당 탭 본문(D19–D21, 티켓 07). 서비스가 돌려준 값을 그대로 그린다 — 금액·순위를 다시 계산하지
 * 않는다. 지급 확인은 세 상태(확인됨/아직/관리자 확인 중)를 글자+색+모양의 작은 칩으로만 보이고,
 * 송금처럼 보이는 금액 강조(체크 아이콘, 초록 큰 글자 등)는 쓰지 않는다(ADR 0004). 계산 중(미확정)과
 * 확정 금액은 상태 문구로 분명히 나눈다(ADR 0010).
 */

const payoutStatusTone: Record<TherapistPayoutStatus, StatusTone> = {
  confirmed: "success",
  unconfirmed: "neutral",
  needsReview: "warning"
};

function vnd(locale: Locale, t: ReturnType<typeof createTranslator>, value: number) {
  return `${formatCurrencyVnd(locale, value)} ${t("settlements.vndSuffix")}`;
}

function PayoutStatusChip({ locale, status }: { locale: Locale; status: TherapistPayoutStatus }) {
  const t = createTranslator(locale);
  return <StatusIndicator label={t(`therapist.payout.status.${status}`)} size="sm" tone={payoutStatusTone[status]} />;
}

function MonthSummary({ locale, month, isConfirmed, closeVersion }: { locale: Locale; month: TherapistPayoutViewDto["month"]; isConfirmed: boolean; closeVersion: number | null }) {
  const t = createTranslator(locale);
  const monthStatusLabel = isConfirmed ? t("therapist.payout.month.statusConfirmed", { version: closeVersion ?? 0 }) : t("therapist.payout.month.statusDraft");

  const countKingNote = month.countKingRank
    ? t("therapist.payout.month.myRank", { rank: month.countKingRank })
    : month.totalCallCount < COUNT_KING_MIN_CALLS
      ? t("therapist.payout.month.belowMinCalls", { minCalls: COUNT_KING_MIN_CALLS })
      : t("therapist.payout.month.noRank");

  const fullAttendanceNote =
    month.fullAttendanceDays === null
      ? t("therapist.payout.month.fullAttendanceSourceMissing")
      : t("therapist.payout.month.fullAttendanceDays", { days: month.fullAttendanceDays, threshold: FULL_ATTENDANCE_THRESHOLD_DAYS });

  return (
    <div className="grid gap-3">
      <SummaryCards label={t("therapist.payout.month.summaryAria")}>
        <SummaryCard accent="peach" label={t("therapist.payout.month.finalAmountLabel")} note={monthStatusLabel} unit={t("settlements.vndSuffix")} value={formatCurrencyVnd(locale, month.finalAmount)} />
        <SummaryCard accent="mint" label={t("therapist.payout.month.countKingLabel")} note={countKingNote} unit={t("settlements.vndSuffix")} value={formatCurrencyVnd(locale, month.countKingBonusAmount)} />
        <SummaryCard accent="butter" label={t("therapist.payout.month.fullAttendanceLabel")} note={fullAttendanceNote} unit={t("settlements.vndSuffix")} value={formatCurrencyVnd(locale, month.fullAttendanceAllowanceAmount)} />
      </SummaryCards>
      <dl className="rounded-lg bg-surface p-4">
        <DetailRow label={t("therapist.payout.month.myCallCount", { count: month.totalCallCount })} value={countKingNote} />
        <DetailRow
          label={t("therapist.payout.month.baselineTitle", { minCalls: COUNT_KING_MIN_CALLS })}
          value={
            month.rankBaseline.length === 0
              ? t("therapist.payout.month.baselineEmpty")
              : month.rankBaseline.map((entry) => t("therapist.payout.month.baselineRank", { rank: entry.rank, count: entry.callCount })).join(" · ")
          }
        />
      </dl>
    </div>
  );
}

function DailyEntryCard({ entry, locale }: { entry: TherapistPayoutDailyEntryDto; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <li className="grid gap-2 rounded-md bg-surface px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <DateCapsule>{entry.serviceDate}</DateCapsule>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{vnd(locale, t, entry.amount)}</span>
          {entry.confirmationStatus ? <PayoutStatusChip locale={locale} status={entry.confirmationStatus} /> : null}
        </div>
      </div>
      {entry.calls.length > 0 ? (
        <ul className="grid gap-1 pl-1">
          {entry.calls.map((call) => (
            <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted" key={`${call.serviceCallId}-${call.startTime}`}>
              <DateCapsule>{call.startTime}</DateCapsule>
              <span className="font-semibold text-foreground">{call.courseCode}</span>
              {call.isAmountPending ? (
                <StatusIndicator label={t("therapist.payout.daily.amountPending")} size="sm" tone="warning" />
              ) : (
                <span>{vnd(locale, t, call.commissionAmount)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TherapistPayoutView({ locale, view }: { locale: Locale; view: TherapistPayoutViewDto }) {
  const t = createTranslator(locale);

  return (
    <div className="grid gap-6">
      <MonthSummary closeVersion={view.closeVersion} isConfirmed={view.isConfirmed} locale={locale} month={view.month} />

      <section aria-label={t("therapist.payout.daily.title")} className="grid gap-3">
        <h2 className="text-sm font-semibold text-muted">{t("therapist.payout.daily.title")}</h2>
        {!view.evidenceAvailable && view.evidenceNotice ? <p className="text-sm text-muted">{resolveKoreanMessage(locale, view.evidenceNotice)}</p> : null}
        {view.dailyEntries.length === 0 ? (
          <ScreenState description={t("therapist.payout.daily.empty")} kind="empty" label={t("common.screenState.empty")} title={t("therapist.payout.daily.empty")} />
        ) : (
          <ul className="grid gap-2">
            {view.dailyEntries.map((entry) => (
              <DailyEntryCard entry={entry} key={entry.serviceDate} locale={locale} />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">{t("settlements.statement.disclaimer")}</p>
    </div>
  );
}
