import { ScreenState } from "@/components/ui/screen-state";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

function formatNoticeDate(locale: Locale, isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", { timeZone: "UTC", month: "long", day: "numeric" }).format(date);
}

/**
 * 퇴근 미입력 안내(티켓 06, 스펙 D17·M4 "퇴근 미입력 안내 여부"). "오늘" 탭의 오늘 현황 카드
 * (TherapistTodayStatus) 바로 아래, 콜 목록 위에 둔다(src/app/therapist/page.tsx). 근태 탭 맨
 * 위에도 같은 컴포넌트를 쓴다(TherapistAttendanceCalendarScreen). dates가 비어 있으면 아무것도
 * 보이지 않는다. 요청 버튼은 09가 action prop으로 더한다 — 이 티켓은 안내 문구만 보인다.
 */
export function TherapistClockOutNoticeSlot({ locale, dates }: { locale: Locale; dates: string[] }) {
  if (dates.length === 0) return null;
  const t = createTranslator(locale);
  const formatted = dates.map((date) => formatNoticeDate(locale, date));

  return (
    <ScreenState
      className="mb-6"
      description={t("therapist.attendance.clockOutMissingNotice.description", { dates: formatted.join(", ") })}
      kind="warning"
      label={t("therapist.attendance.clockOutMissingNotice.label")}
      title={t("therapist.attendance.clockOutMissingNotice.title")}
    />
  );
}
