"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ModalPanel } from "@/components/ui/panel";
import { requestTherapistCorrectionAction, type TherapistRequestActionState } from "@/app/therapist/attendance/actions";
import { useT } from "@/lib/i18n/client";

/**
 * 정정 요청 다이얼로그(스펙 D23, 티켓 09). "이미 찍음"(05)과 "퇴근 미입력"(06) 안내 양쪽이 이
 * 하나의 다이얼로그를 연다. dateOptions가 하나면 숨은 값으로 고정하고(05의 오늘), 여럿이면
 * (06의 퇴근 미입력이 여러 날짜일 때) 고를 수 있게 select를 보인다. 출근·퇴근 시각은 둘 다
 * 선택이지만 최소 하나는 적어야 한다(서버가 검사). 사유는 필수다.
 */
export function TherapistCorrectionRequestDialog({ dateOptions, trigger }: { dateOptions: string[]; trigger: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<TherapistRequestActionState, FormData>(requestTherapistCorrectionAction, null);
  const dateId = useId();
  const checkInId = useId();
  const checkOutId = useId();
  const reasonId = useId();
  // 성공 state는 다이얼로그를 다시 열어도 그대로 남는다(컴포넌트 자체는 마운트 상태 유지) —
  // ref로 "이미 처리한 성공"을 기억해 두지 않으면 다시 열 때마다 바로 닫혀 버린다.
  const handledSuccessRef = useRef<TherapistRequestActionState>(null);

  useEffect(() => {
    if (state?.ok && state !== handledSuccessRef.current) {
      handledSuccessRef.current = state;
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const dateError = state && !state.ok ? state.fieldErrors?.date?.[0] : undefined;
  const reasonError = state && !state.ok ? state.fieldErrors?.reason?.[0] : undefined;
  const formError = state && !state.ok && !dateError && !reasonError ? state.formError : undefined;

  return (
    <ModalPanel
      description={t("therapist.attendance.correction.dialogDescription")}
      onOpenChange={setOpen}
      open={open}
      placement="center"
      title={t("therapist.attendance.correction.dialogTitle")}
      trigger={trigger}
    >
      <form action={formAction} className="grid gap-4">
        {dateOptions.length === 1 ? (
          <input name="date" type="hidden" value={dateOptions[0]} />
        ) : (
          <div className="grid gap-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor={dateId}>
              {t("therapist.attendance.correction.dateLabel")}
            </label>
            <select className={inputFieldClassName({ className: "w-full", invalid: Boolean(dateError) })} defaultValue={dateOptions[0]} id={dateId} name="date">
              {dateOptions.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
        )}
        {dateError ? (
          <span className="text-sm text-danger" role="alert">
            {dateError}
          </span>
        ) : null}

        <div className="grid gap-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor={checkInId}>
            {t("therapist.attendance.correction.checkInLabel")}
          </label>
          <input className={inputFieldClassName({ className: "w-full" })} disabled={pending} id={checkInId} name="requestedCheckInTime" type="time" />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor={checkOutId}>
            {t("therapist.attendance.correction.checkOutLabel")}
          </label>
          <input className={inputFieldClassName({ className: "w-full" })} disabled={pending} id={checkOutId} name="requestedCheckOutTime" type="time" />
        </div>

        <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={reasonId}>
          {t("therapist.attendance.correction.reasonLabel")}
          <textarea
            className={inputFieldClassName({ className: "h-auto min-h-20 py-2", invalid: Boolean(reasonError) })}
            disabled={pending}
            id={reasonId}
            name="reason"
            placeholder={t("therapist.attendance.correction.reasonPlaceholder")}
          />
        </label>
        {reasonError ? (
          <span className="text-sm text-danger" role="alert">
            {reasonError}
          </span>
        ) : null}

        {formError ? (
          <p className="text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}

        <Button disabled={pending} type="submit">
          {pending ? t("therapist.attendance.correction.submitting") : t("therapist.attendance.correction.submit")}
        </Button>
      </form>
    </ModalPanel>
  );
}
