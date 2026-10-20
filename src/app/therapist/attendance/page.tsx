import { TherapistAttendanceCalendar } from "@/components/therapist/therapist-attendance-calendar";
import { TherapistClockOutNoticeSlot } from "@/components/therapist/therapist-clock-out-notice-slot";
import { TherapistCorrectionRequestDialog } from "@/components/therapist/therapist-correction-request-dialog";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { Button } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";
import { requireTherapistAccess } from "@/app/therapist/require-therapist-access";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";
import { getTherapistAttendanceCalendar, listTherapistClockOutMissingDates } from "@/modules/therapists/therapist-attendance-calendar-service";
import { TherapistAttendanceMonthNav } from "@/app/therapist/attendance/therapist-attendance-month-nav";

type AttendancePageSearchParams = { month?: string };

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

/**
 * 근태 탭(스펙 D17–D18, 티켓 06). 퇴근 미입력 안내(오늘 탭과 같은 컴포넌트) → 달 이동 → 월 달력.
 * ?month=YYYY-MM으로 지난 달을 본다. 형식이 올바르지 않으면 오늘이 속한 달로 되돌린다.
 * 09가 퇴근 미입력 안내에 정정 요청 다이얼로그 트리거를 더했다.
 */
export default async function TherapistAttendancePage({ searchParams }: { searchParams: Promise<AttendancePageSearchParams> }) {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const requestedMonthKey = params.month && MONTH_KEY_PATTERN.test(params.month) ? params.month : undefined;
  const now = new Date();

  const [profile, calendar, clockOutMissingDates] = await Promise.all([
    getTherapistProfile(employeeId),
    getTherapistAttendanceCalendar({ employeeId, monthKey: requestedMonthKey, now }),
    listTherapistClockOutMissingDates({ employeeId, now })
  ]);
  const lastUpdatedAt = now.toISOString();

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
        <TherapistAttendanceMonthNav locale={locale} monthKey={calendar.monthKey} />
        <TherapistAttendanceCalendar days={calendar.days} locale={locale} monthKey={calendar.monthKey} todayServiceDate={calendar.todayServiceDate} />
      </TherapistRefresh>
    </div>
  );
}
