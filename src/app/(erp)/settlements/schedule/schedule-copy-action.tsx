"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { copyLastWeekScheduleAction, type ScheduleCopyActionState } from "@/app/(erp)/settlements/schedule/actions";
import { DayOffImpactNotice } from "@/app/(erp)/settlements/schedule/schedule-cell-form";

/**
 * 지난주 복사(스토리 101, 티켓 28). 지금 보고 있는 주(weekStartDate)의 미입력 칸만 바로 앞 7일의
 * 값으로 채우고, 채운 칸 수를 알려준다. 이미 입력된 근무 예정·휴무는 덮지 않는다. 도구줄의 주요
 * 행동 자리에 둔다. 페이지가 week.weekStartDate를 key로 다시 만들어 주마다 결과 문구가 남지 않는다.
 * 복사로 새로 휴무가 된 칸에 배정된 콜이 있으면(S8, 스토리 102) 직원·날짜별로 DayOffImpactNotice와
 * 같은 안내를 보인다.
 */
export function ScheduleCopyWeekAction({ weekStartDate, canOpenLedger }: { weekStartDate: string; canOpenLedger: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ScheduleCopyActionState, FormData>(copyLastWeekScheduleAction, null);
  const impacts = state?.ok ? state.data.impacts : [];

  return (
    <div className="grid gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input name="date" type="hidden" value={weekStartDate} />
        <Button disabled={pending} type="submit" variant="secondary">
          {pending ? t("settlements.schedule.copy.pending") : t("settlements.schedule.copy.action")}
        </Button>
        <span aria-live="polite" className="text-sm text-muted">
          {state?.ok
            ? t("settlements.schedule.copy.result", { count: state.data.filledCount })
            : state && !state.ok
              ? t("settlements.schedule.copy.failed", { message: state.formError ?? "" })
              : null}
        </span>
      </form>
      {impacts.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-foreground">{t("settlements.schedule.copy.impactsHeading")}</p>
          {impacts.map((impact) => (
            <DayOffImpactNotice
              calls={impact.calls}
              canOpenLedger={canOpenLedger}
              date={impact.date}
              employeeName={impact.employeeName}
              key={`${impact.employeeId}:${impact.date}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
