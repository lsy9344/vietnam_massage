"use client";

import { Button } from "@/components/ui/button";
import { TherapistClockCodeDialog } from "@/components/therapist/therapist-clock-code-dialog";
import { useT } from "@/lib/i18n/client";
import type { TherapistTodayAttendanceStatus } from "@/modules/therapists/therapist-today-view-service";

/**
 * 출근·퇴근 버튼(티켓 05, 스펙 D12·D13·D15). "오늘" 탭 맨 위, 오늘 현황 카드 바로 위(03이 둔 자리,
 * src/app/therapist/page.tsx). 출근 가능이면 "출근", 퇴근 가능이면 "퇴근" 버튼이 코드 입력
 * 다이얼로그(TherapistClockCodeDialog)를 연다. 둘 다 찍었으면(both_recorded) 버튼 대신 "이미 찍음 —
 * 정정 요청" 안내만 보인다 — 요청으로 이어지는 링크는 09가 단다(이 티켓은 글자만 둔다).
 */
export function TherapistAttendanceActionsSlot({ attendanceStatus }: { attendanceStatus: TherapistTodayAttendanceStatus }) {
  const t = useT();

  if (attendanceStatus === "both_recorded") {
    return <p className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted">{t("therapist.attendance.alreadyClockedNotice")}</p>;
  }

  const action = attendanceStatus === "check_in_available" ? "check_in" : "check_out";
  const label = action === "check_in" ? t("therapist.attendance.checkInButton") : t("therapist.attendance.checkOutButton");

  return (
    <div className="mb-6">
      <TherapistClockCodeDialog action={action} trigger={<Button className="px-8 text-base">{label}</Button>} />
    </div>
  );
}
