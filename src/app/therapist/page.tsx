import { TherapistAttendanceActionsSlot } from "@/components/therapist/therapist-attendance-actions-slot";
import { TherapistClockOutNoticeSlot } from "@/components/therapist/therapist-clock-out-notice-slot";
import { TherapistCorrectionRequestDialog } from "@/components/therapist/therapist-correction-request-dialog";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTodayCallList } from "@/components/therapist/therapist-today-call-list";
import { TherapistTodayStatus } from "@/components/therapist/therapist-today-status";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { Button } from "@/components/ui/button";
import { SummaryCard } from "@/components/ui/summary-card";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";
import { getTherapistTodayView } from "@/modules/therapists/therapist-today-view-service";

/**
 * 오늘 탭(Therapist 첫 화면, 스펙 D10–D12, 티켓 03). 순서는 D12 그대로다: 출근·퇴근 버튼(05) →
 * 오늘 현황(다음 콜까지 남은 시간·오늘 한 것·오늘 예상 코스 수당) → 퇴근 미입력 안내(06) →
 * 날짜별 내 콜 목록. 05는 todayView.today.attendanceStatus를 자리에 넘기는 한 줄만 더했다.
 * 09는 attendanceStatus 자리에 오늘 날짜를, 퇴근 미입력 안내에 정정 요청 다이얼로그 트리거를 더했다.
 */
export default async function TherapistTodayPage() {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const now = new Date();
  const [profile, todayView] = await Promise.all([getTherapistProfile(employeeId), getTherapistTodayView({ employeeId, now })]);
  const lastUpdatedAt = now.toISOString();

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.nav.today")} />
      <TherapistRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <TherapistRefreshController />
        <TherapistAttendanceActionsSlot attendanceStatus={todayView.today.attendanceStatus} serviceDate={todayView.today.serviceDate} />
        <TherapistTodayStatus doneCount={todayView.today.doneCount} locale={locale} nextCallInMinutes={todayView.today.nextCallInMinutes}>
          <SummaryCard
            accent="lavender"
            label={t("therapist.today.expectedPayoutLabel")}
            note={t("therapist.today.expectedPayoutNote")}
            unit={t("settlements.vndSuffix")}
            value={formatCurrencyVnd(locale, todayView.today.expectedPayoutAmount)}
          />
        </TherapistTodayStatus>
        <TherapistClockOutNoticeSlot
          action={
            <TherapistCorrectionRequestDialog
              dateOptions={todayView.today.clockOutMissingDates}
              trigger={
                <Button type="button" variant="secondary">
                  {t("therapist.attendance.correctionRequestButton")}
                </Button>
              }
            />
          }
          dates={todayView.today.clockOutMissingDates}
          locale={locale}
        />
        <TherapistTodayCallList days={todayView.days} locale={locale} todayDate={todayView.today.serviceDate} />
      </TherapistRefresh>
    </div>
  );
}
