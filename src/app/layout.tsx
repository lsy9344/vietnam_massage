import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

// 라틴·베트남어 글자. 한국어는 globals.css의 --font-body 다음 순서(Pretendard, 시스템 글꼴)로 그린다.
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-jakarta"
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, "app.title"),
    description: t(locale, "app.description")
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={jakartaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
