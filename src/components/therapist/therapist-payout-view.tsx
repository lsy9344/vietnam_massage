import { DateCapsule } from "@/components/ui/date-capsule";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import type { TherapistPayoutStatus } from "@/modules/therapists/therapist-payout-status";
import type { TherapistPayoutViewDto } from "@/modules/therapists/therapist-payout-view-service";

/** 현재 영업일 수당만 표시한다. 금액과 지급 확인 상태는 서버 서비스의 값을 그대로 쓴다. */

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

function DailyEntryCard({ entry, locale }: { entry: TherapistPayoutViewDto; locale: Locale }) {
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
          {entry.calls.map((call, index) => (
            <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted" key={`${call.serviceCallId}-${index}`}>
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
      <section aria-label={t("therapist.payout.daily.title")} className="grid gap-3">
        <h2 className="text-sm font-semibold text-muted">{t("therapist.payout.daily.title")}</h2>
        {view.calls.length === 0 ? (
          <ScreenState description={t("therapist.payout.daily.empty")} kind="empty" label={t("common.screenState.empty")} title={t("therapist.payout.daily.empty")} />
        ) : (
          <ul className="grid gap-2">
            <DailyEntryCard entry={view} locale={locale} />
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">{t("therapist.payout.daily.note")}</p>
    </div>
  );
}
