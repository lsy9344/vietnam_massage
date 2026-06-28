import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-md border border-border bg-surface p-6" aria-labelledby="sign-in-title">
        <p className="text-sm font-semibold text-muted">Vietnam Aesthetic ERP</p>
        <h1 id="sign-in-title" className="mt-2 text-2xl font-semibold">
          직원 계정 로그인
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          관리자에게 발급받은 이메일 또는 계정 ID로 로그인한다.
        </p>
        <Suspense>
          <SignInForm />
        </Suspense>
      </section>
    </main>
  );
}
