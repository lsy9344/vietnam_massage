"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModalPanel } from "@/components/ui/panel";
import { submitTherapistClockInCodeAction } from "@/app/therapist/clock-in-actions";
import { formatBusinessTime } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/client";
import type { TherapistClockInAction } from "@/modules/therapists/therapist-clock-in-service";

const CODE_LENGTH = 4;
const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;

/**
 * 출근·퇴근 코드 입력(스펙 D13–D15, 티켓 05). 숫자 키패드 + 큰 글자(스킬 ui-ux-pro-max 점검: 키 44px
 * 이상, 입력판 4자리를 큰 글자로 보임). 틀리면 남은 횟수, 잠기면 풀리는 시각을 보인다(D14).
 */
export function TherapistClockCodeDialog({ action, trigger }: { action: TherapistClockInAction; trigger: React.ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setDigits("");
      setError(null);
    }
  }

  function pressDigit(digit: string) {
    if (isPending || digits.length >= CODE_LENGTH) return;
    setDigits((current) => current + digit);
  }

  function pressBackspace() {
    if (isPending) return;
    setDigits((current) => current.slice(0, -1));
  }

  function submit() {
    startTransition(() => {
      void (async () => {
        const result = await submitTherapistClockInCodeAction(action, digits);
        if (result.ok) {
          setOpen(false);
          setDigits("");
          setError(null);
          router.refresh();
          return;
        }

        setDigits("");
        switch (result.code) {
          case "CLOCK_CODE_INVALID":
            setError(t("therapist.attendance.error.invalid", { remaining: String(result.remainingAttempts) }));
            break;
          case "CLOCK_CODE_LOCKED":
            setError(t("therapist.attendance.error.locked", { until: formatBusinessTime(locale, result.lockedUntil) }));
            break;
          case "ALREADY_CLOCKED_IN":
          case "ALREADY_CLOCKED_OUT":
          case "CHECK_IN_REQUIRED_BEFORE_CHECK_OUT":
            setError(t("therapist.attendance.alreadyClockedNotice"));
            break;
          default:
            setError(result.message ?? t("therapist.attendance.error.generic"));
        }
      })();
    });
  }

  return (
    <ModalPanel
      description={t("therapist.attendance.dialog.description")}
      onOpenChange={handleOpenChange}
      open={open}
      title={action === "check_in" ? t("therapist.attendance.dialog.checkInTitle") : t("therapist.attendance.dialog.checkOutTitle")}
      trigger={trigger}
    >
      <div className="grid gap-5">
        <p
          aria-label={t("therapist.attendance.dialog.codeAria")}
          className="rounded-lg border border-border bg-surface py-4 text-center text-5xl font-black tabular-nums tracking-[0.3em] text-foreground"
        >
          {digits.padEnd(CODE_LENGTH, "·")}
        </p>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {KEYPAD_DIGITS.map((key, index) =>
            key === "" ? (
              <span aria-hidden key={`blank-${index}`} />
            ) : (
              <button
                className="min-h-16 rounded-lg bg-surface text-3xl font-bold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:pointer-events-none disabled:opacity-50"
                disabled={isPending}
                key={key}
                onClick={() => (key === "⌫" ? pressBackspace() : pressDigit(key))}
                type="button"
              >
                {key}
              </button>
            )
          )}
        </div>

        <Button disabled={digits.length !== CODE_LENGTH || isPending} onClick={submit}>
          {isPending ? t("therapist.attendance.dialog.submitting") : t("therapist.attendance.dialog.submit")}
        </Button>
      </div>
    </ModalPanel>
  );
}
