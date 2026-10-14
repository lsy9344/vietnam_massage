import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";
import { LocaleSwitcher } from "@/components/domain/locale-switcher";
import { getServerTranslator } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

/** 셸 없는 로그인 화면(design.md 6.15): 가운데 카드, 골드 브랜드 표식, 검정 주 버튼. */
export default async function SignInPage() {
  const { locale, t } = await getServerTranslator();
  return (
    <LocaleProvider locale={locale}>
      <main className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 min-[840px]:px-8 min-[840px]:py-6">
          <div className="flex items-stretch gap-3">
            {/* 골드는 로그인에서 브랜드 표식에만 쓴다(design.md 2.2). */}
            <span aria-hidden="true" className="w-1.5 shrink-0 rounded-full bg-brand-secondary" />
            <p className="py-1 text-[0.9375rem] font-semibold">{t("auth.signIn.eyebrow")}</p>
          </div>
          <LocaleSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
          <section aria-labelledby="sign-in-title" className="w-full max-w-md rounded-xl border border-border bg-surface p-6 min-[600px]:p-8">
            <h1 className="text-xl font-bold lg:text-2xl" id="sign-in-title">
              {t("auth.signIn.title")}
            </h1>
            <p className="mt-2 text-sm text-muted">{t("auth.signIn.description")}</p>
            <Suspense>
              <SignInForm />
            </Suspense>
          </section>
        </div>
      </main>
    </LocaleProvider>
  );
}
