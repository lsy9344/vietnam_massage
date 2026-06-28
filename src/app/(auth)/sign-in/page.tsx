import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";
import { LocaleSwitcher } from "@/components/domain/locale-switcher";
import { getServerTranslator } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

export default async function SignInPage() {
  const { locale, t } = await getServerTranslator();
  return (
    <LocaleProvider locale={locale}>
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-md border border-border bg-surface p-6" aria-labelledby="sign-in-title">
          <div className="mb-4 flex justify-end">
            <LocaleSwitcher />
          </div>
          <p className="text-sm font-semibold text-muted">{t("auth.signIn.eyebrow")}</p>
          <h1 id="sign-in-title" className="mt-2 text-2xl font-semibold">
            {t("auth.signIn.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("auth.signIn.description")}</p>
          <Suspense>
            <SignInForm />
          </Suspense>
        </section>
      </main>
    </LocaleProvider>
  );
}
