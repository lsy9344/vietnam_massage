import { CallStatusChip, callStatusKeyOf, type CallStatusKey } from "@/components/domain/call-status-chip";
import { DateCapsule } from "@/components/ui/date-capsule";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { intlLocale } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import type { TherapistTodayCallDto, TherapistTodayDayDto } from "@/modules/therapists/therapist-today-view-service";

// 콜 상태 이름은 Therapist 화면만의 말이 아니라 원장·대시보드와 같은 기존 키를 그대로 쓴다(design.md 6.8의
// CallStatusChip과 같은 선례, ledger-status-counts.tsx의 고정 배열 모양).
const STATUS_LABEL_KEYS: Record<CallStatusKey, MessageKey> = {
  reserved: "calls.statusCounts.reserved",
  inUse: "calls.summary.inUse",
  cleaning: "calls.summary.cleaning",
  completed: "calls.summary.completed",
  noShow: "calls.summary.noShow",
  canceled: "calls.summary.canceled"
};

// 취소·노쇼는 흐리게 남긴다(스펙 D10).
const FADED_STATUSES: ReadonlySet<CallStatusKey> = new Set(["noShow", "canceled"]);

function formatDayHeading(locale: Locale, serviceDate: string) {
  const date = new Date(`${serviceDate}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function TherapistTodayCallCard({ locale, call }: { locale: Locale; call: TherapistTodayCallDto }) {
  const t = createTranslator(locale);
  const statusKey = callStatusKeyOf(call.status);
  const faded = statusKey !== null && FADED_STATUSES.has(statusKey);

  return (
    <li className={cn("min-h-14 rounded-md border border-border bg-surface px-4 py-2.5", faded && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
          <DateCapsule>{call.startTime}</DateCapsule>
          <span aria-hidden="true">{"→"}</span>
          <span className={call.endTime.isEstimated ? "text-faint" : "font-semibold"}>{call.endTime.time}</span>
          <span className="font-semibold">{call.courseCode}</span>
          <span className="text-muted">{call.roomLabel}</span>
        </div>
        {statusKey ? <CallStatusChip label={t(STATUS_LABEL_KEYS[statusKey])} size="sm" status={statusKey} /> : null}
      </div>
      {call.guestName || call.partnerTherapistName ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {call.guestName ? <span>{call.guestName}</span> : null}
          {call.partnerTherapistName ? <span>{t("therapist.today.withPartner", { name: call.partnerTherapistName })}</span> : null}
        </div>
      ) : null}
      {call.visitRequest || call.customerPreferenceNote ? (
        <div className="mt-1 grid gap-0.5 text-xs text-muted">
          {call.visitRequest ? <p>{call.visitRequest}</p> : null}
          {call.customerPreferenceNote ? <p>{call.customerPreferenceNote}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * 오늘과 앞으로 7일의 내 콜(스펙 D10), 날짜별로 묶어 보여준다. 보기만 한다 — 상태를 바꾸는 버튼이나
 * 링크는 없다(원장과 달리 Therapist 화면의 역할, 스펙 D10 체크박스).
 */
export function TherapistTodayCallList({ locale, days, todayDate }: { locale: Locale; days: TherapistTodayDayDto[]; todayDate: string }) {
  const t = createTranslator(locale);
  return (
    <div className="grid gap-6">
      {days.map((day) => (
        <section aria-label={formatDayHeading(locale, day.serviceDate)} key={day.serviceDate}>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            {formatDayHeading(locale, day.serviceDate)}
            {day.serviceDate === todayDate ? ` · ${t("therapist.today.todayMarker")}` : ""}
          </h2>
          {day.calls.length === 0 ? (
            <p className="text-sm text-faint">{t("therapist.today.noCallsThatDay")}</p>
          ) : (
            <ul className="grid gap-2">
              {day.calls.map((call) => (
                <TherapistTodayCallCard call={call} key={call.id} locale={locale} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
