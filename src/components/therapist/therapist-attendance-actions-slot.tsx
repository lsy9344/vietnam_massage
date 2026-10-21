"use client";

import { Button } from "@/components/ui/button";
import { TherapistClockCodeDialog } from "@/components/therapist/therapist-clock-code-dialog";
import { TherapistCorrectionRequestDialog } from "@/components/therapist/therapist-correction-request-dialog";
import { useT } from "@/lib/i18n/client";
import type { TherapistTodayAttendanceStatus } from "@/modules/therapists/therapist-today-view-service";

/**
 * 출근·퇴근 버튼(티켓 05, 스펙 D12·D13·D15). "오늘" 탭 맨 위, 오늘 현황 카드 바로 위(03이 둔 자리,
 * src/app/therapist/page.tsx). 출근 가능이면 "출근", 퇴근 가능이면 "퇴근" 버튼이 코드 입력
 * 다이얼로그(TherapistClockCodeDialog)를 연다. 둘 다 찍었으면(both_recorded) 버튼 대신 "이미 찍음 —
 * 정정 요청" 안내와 정정 요청 다이얼로그 트리거를 보인다(09).
 */
export function TherapistAttendanceActionsSlot({ attendanceStatus, serviceDate }: { attendanceStatus: TherapistTodayAttendanceStatus; serviceDate: string }) {
  const t = useT();

  if (attendanceStatus === "both_recorded") {
    return (
      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <p className="text-sm font-semibold text-muted">{t("therapist.attendance.alreadyClockedNotice")}</p>
        <TherapistCorrectionRequestDialog
          dateOptions={[serviceDate]}
          trigger={
            <Button type="button" variant="secondary">
              {t("therapist.attendance.correctionRequestButton")}
            </Button>
          }
        />
      </div>
    );
  }

  const action = attendanceStatus === "check_in_available" ? "check_in" : "check_out";
  const label = action === "check_in" ? t("therapist.attendance.checkInButton") : t("therapist.attendance.checkOutButton");

  return (
    <div className="mb-6">
      <TherapistClockCodeDialog action={action} trigger={<Button className="px-8 text-base">{label}</Button>} />
    </div>
  );
}
