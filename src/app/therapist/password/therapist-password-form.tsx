"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { changeTherapistPasswordAction, type TherapistPasswordActionState } from "@/app/therapist/password/actions";
import { useT } from "@/lib/i18n/client";

/**
 * 비밀번호 변경 폼(390px). 바뀌면 오늘 탭으로 보낸다(스펙 "비밀번호 변경 → Therapist 화면").
 * 서버 액션에 현재·새 비밀번호를 같이 보낸다(티켓 02 가정).
 */
export function TherapistPasswordForm() {
  const t = useT();
  const router = useRouter();
  const currentId = useId();
  const nextId = useId();
  const [state, formAction, pending] = useActionState<TherapistPasswordActionState, FormData>(changeTherapistPasswordAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.replace("/therapist");
      router.refresh();
    }
  }, [state, router]);

  const currentErrors = state && !state.ok ? state.fieldErrors?.currentSecret ?? [] : [];
  const nextErrors = state && !state.ok ? state.fieldErrors?.nextSecret ?? [] : [];

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-foreground" htmlFor={currentId}>
          {t("therapist.password.currentLabel")}
        </label>
        <input
          aria-invalid={currentErrors.length > 0 || undefined}
          autoComplete="current-password"
          className={inputFieldClassName({ invalid: currentErrors.length > 0, className: "w-full" })}
          id={currentId}
          name="currentSecret"
          required
          type="password"
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-foreground" htmlFor={nextId}>
          {t("therapist.password.nextLabel")}
        </label>
        <input
          aria-describedby={`${nextId}-hint`}
          aria-invalid={nextErrors.length > 0 || undefined}
          autoComplete="new-password"
          className={inputFieldClassName({ invalid: nextErrors.length > 0, className: "w-full" })}
          id={nextId}
          minLength={8}
          name="nextSecret"
          required
          type="password"
        />
        <span className="text-xs text-muted" id={`${nextId}-hint`}>
          {t("therapist.password.nextHint")}
        </span>
      </div>
      {state && !state.ok && state.formError ? (
        <p className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {state.formError}
        </p>
      ) : null}
      <Button className="w-full justify-center" disabled={pending} type="submit">
        {t("therapist.password.submit")}
      </Button>
    </form>
  );
}
