import type { ReactNode } from "react";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * 오늘 현황(스펙 D12): 다음 콜까지 남은 시간, 오늘 한 것 N. 오늘 예상 코스 수당(티켓 07)의 카드 자리는
 * children이다 — 비우면 두 카드만 보이고, 07이 그 자리에 세 번째 SummaryCard를 끼워 넣으면 그대로 같은
 * 줄(600px 미만은 한 열)에 들어간다. 03은 이 자리를 비워 둔다.
 *
 * R17(design.md §2.3): 다음 콜까지 남은 시간은 매출·건수·잔액·비용 어느 계열도 아니라 butter를 쓴다.
 * lavender는 매출 계열(결제 합계·순매출)이라 돈 카드(오늘 예상 코스 수당, src/app/therapist/page.tsx)가
 * 쓴다.
 */
export function TherapistTodayStatus({
  locale,
  nextCallInMinutes,
  doneCount,
  children
}: {
  locale: Locale;
  /** 다음 콜까지 남은 분. 오늘 남은 콜이 없으면 null. */
  nextCallInMinutes: number | null;
  /** 오늘 한 것(사용중·청소중·방문완료, M7). */
  doneCount: number;
  children?: ReactNode;
}) {
  const t = createTranslator(locale);
  return (
    <SummaryCards className="mb-6" label={t("therapist.today.statusAria")}>
      <SummaryCard
        accent="butter"
        label={t("therapist.today.nextCallLabel")}
        unit={nextCallInMinutes === null ? undefined : t("therapist.today.minutesUnit")}
        value={nextCallInMinutes === null ? t("therapist.today.noMoreCallsToday") : String(nextCallInMinutes)}
      />
      <SummaryCard accent="mint" label={t("therapist.today.doneCountLabel")} unit={t("therapist.today.callUnit")} value={String(doneCount)} />
      {children}
    </SummaryCards>
  );
}
