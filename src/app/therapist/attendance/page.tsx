import { TherapistAttendanceCalendar, TherapistAttendanceWeek } from "@/components/therapist/therapist-attendance-calendar";
import { TherapistClockOutNoticeSlot } from "@/components/therapist/therapist-clock-out-notice-slot";
import { TherapistCorrectionRequestDialog } from "@/components/therapist/therapist-correction-request-dialog";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { Button } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";
import {
  getTherapistAttendanceCalendar,
  getTherapistAttendanceWeek,
  listTherapistClockOutMissingDates
} from "@/modules/therapists/therapist-attendance-calendar-service";
import { resolveTherapistAttendanceView } from "@/app/therapist/attendance/attendance-view";
import { formatAttendanceRange, TherapistAttendanceNav, type TherapistAttendanceNavRange } from "@/app/therapist/attendance/therapist-attendance-nav";

type AttendancePageSearchParams = { week?: string; month?: string };

/**
 * 근태 탭(스펙 D17–D18, 티켓 06). 퇴근 미입력 안내(오늘 탭과 같은 컴포넌트) → 기간·보기 전환 → 주 보기 또는 월 달력.
 * 기본은 이번 주이고 ?week=YYYY-MM-DD로 다른 주를, ?month=YYYY-MM으로 월 달력을 본다(attendance-view.ts).
 * 09가 퇴근 미입력 안내에 정정 요청 다이얼로그 트리거를 더했다.
 */
export default async function TherapistAttendancePage({ searchParams }: { searchParams: Promise<AttendancePageSearchParams> }) {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const view = resolveTherapistAttendanceView(params);
  const now = new Date();

  const [profile, calendar, clockOutMissingDates] = await Promise.all([
    getTherapistProfile(employeeId),
    view.kind === "week"
      ? getTherapistAttendanceWeek({ employeeId, date: view.date, now }).then((week) => ({ kind: "week" as const, ...week }))
      : getTherapistAttendanceCalendar({ employeeId, monthKey: view.monthKey, now }).then((month) => ({ kind: "month" as const, ...month })),
    listTherapistClockOutMissingDates({ employeeId, now })
  ]);
  const lastUpdatedAt = now.toISOString();
  const range: TherapistAttendanceNavRange =
    calendar.kind === "week"
      ? { kind: "week", weekStartDate: calendar.weekStartDate, weekEndDate: calendar.weekEndDate }
      : { kind: "month", monthKey: calendar.monthKey };

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.nav.attendance")} />
      <TherapistRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <TherapistRefreshController />
        <TherapistClockOutNoticeSlot
          action={
            <TherapistCorrectionRequestDialog
              dateOptions={clockOutMissingDates}
              trigger={
                <Button type="button" variant="secondary">
                  {t("therapist.attendance.correctionRequestButton")}
                </Button>
              }
            />
          }
          dates={clockOutMissingDates}
          locale={locale}
        />
        <TherapistAttendanceNav locale={locale} range={range} todayServiceDate={calendar.todayServiceDate} />
        {calendar.kind === "week" ? (
          <TherapistAttendanceWeek
            days={calendar.days}
            locale={locale}
            todayServiceDate={calendar.todayServiceDate}
            weekLabel={formatAttendanceRange(locale, range)}
          />
        ) : (
          <TherapistAttendanceCalendar days={calendar.days} locale={locale} monthKey={calendar.monthKey} todayServiceDate={calendar.todayServiceDate} />
        )}
      </TherapistRefresh>
    </div>
  );
}
