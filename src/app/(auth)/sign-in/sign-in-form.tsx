"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const identity = String(formData.get("identity") ?? "");
    const password = String(formData.get("password") ?? "");
    const callbackUrl = searchParams.get("callbackUrl") ?? "/";

    const result = await signIn("credentials", {
      identity,
      password,
      callbackUrl,
      redirect: false
    });

    setIsSubmitting(false);

    if (!result?.ok) {
      setErrorMessage(t("auth.error.invalidCredentials"));
      return;
    }

    router.replace(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium" htmlFor="identity">
          {t("auth.signIn.identityLabel")}
        </label>
        <input
          autoComplete="username"
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand"
          id="identity"
          name="identity"
          required
          type="text"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">
          {t("auth.signIn.passwordLabel")}
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {errorMessage ? (
        <p className="rounded-md border border-danger bg-background px-3 py-2 text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button className="w-full justify-center" disabled={isSubmitting} type="submit">
        {t("auth.signIn.submit")}
      </Button>
    </form>
  );
}
