"use client";

import { FormEvent, useRef, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { validateSignIn, type SignInField } from "@/app/(auth)/sign-in/sign-in-validation";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import type { MessageKey } from "@/lib/i18n";
import { localeCookieAssignment, signInLocaleFor } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";

const CREDENTIALS_ERROR_ID = "sign-in-error";

/**
 * 계정 인증만 한다. 권한은 인증된 계정의 역할에서 정해지므로 역할을 고르는 칸이 없다.
 * 오류는 문장 대신 번역 key로 들고 있어서, 오류가 보이는 중에 언어를 바꾸면 새 언어로 다시 그려진다.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignInField, MessageKey>>>({});
  const [credentialsRejected, setCredentialsRejected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const identityRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCredentialsRejected(false);

    const formData = new FormData(event.currentTarget);
    const identity = String(formData.get("identity") ?? "");
    const password = String(formData.get("password") ?? "");
    const errors = validateSignIn({ identity, password });
    setFieldErrors(errors);
    if (errors.identity || errors.password) {
      (errors.identity ? identityRef : passwordRef).current?.focus();
      return;
    }

    setIsSubmitting(true);
    const callbackUrl = searchParams.get("callbackUrl") ?? "/";

    const result = await signIn("credentials", {
      identity,
      password,
      callbackUrl,
      redirect: false
    });

    setIsSubmitting(false);

    if (!result?.ok) {
      setCredentialsRejected(true);
      return;
    }

    // Therapist는 로그인하면 바로 베트남어로 시작한다(signInLocaleFor). 첫 화면을 그리기 전에 쿠키를 바꾼다.
    const signInLocale = signInLocaleFor((await getSession())?.user?.role);
    if (signInLocale) document.cookie = localeCookieAssignment(signInLocale);

    router.replace(result.url ?? callbackUrl);
    router.refresh();
  }

  // 계정 정보 거절은 두 칸 모두의 문제라 두 칸이 같은 오류 문장을 가리킨다.
  function describedBy(field: SignInField) {
    if (fieldErrors[field]) return `${field}-error`;
    return credentialsRejected ? CREDENTIALS_ERROR_ID : undefined;
  }

  const fields: Array<{ name: SignInField; type: string; autoComplete: string; label: MessageKey; ref: typeof identityRef }> = [
    { name: "identity", type: "text", autoComplete: "username", label: "auth.signIn.identityLabel", ref: identityRef },
    { name: "password", type: "password", autoComplete: "current-password", label: "auth.signIn.passwordLabel", ref: passwordRef }
  ];

  return (
    <form className="mt-6 grid gap-4" noValidate onSubmit={handleSubmit}>
      {fields.map((field) => {
        const error = fieldErrors[field.name];
        const invalid = Boolean(error) || credentialsRejected;
        return (
          <div className="grid gap-1.5" key={field.name}>
            <label className="text-sm font-semibold text-foreground" htmlFor={field.name}>
              {t(field.label)}
            </label>
            <input
              aria-describedby={describedBy(field.name)}
              aria-invalid={invalid || undefined}
              autoComplete={field.autoComplete}
              className={inputFieldClassName({ invalid, className: "w-full" })}
              id={field.name}
              name={field.name}
              ref={field.ref}
              required
              type={field.type}
            />
            {error ? (
              <p className="text-sm text-danger" id={`${field.name}-error`}>
                {t(error)}
              </p>
            ) : null}
          </div>
        );
      })}
      {credentialsRejected ? (
        <p className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger" id={CREDENTIALS_ERROR_ID} role="alert">
          {t("auth.error.invalidCredentials")}
        </p>
      ) : null}
      <Button className="mt-2 w-full justify-center" disabled={isSubmitting} type="submit">
        {t("auth.signIn.submit")}
      </Button>
    </form>
  );
}
