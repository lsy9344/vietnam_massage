import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
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
    <html lang={locale} className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
