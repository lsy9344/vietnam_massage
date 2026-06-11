import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vietnam Massage ERP",
  description: "운영 원장, 객실 현황, 정산, 월마감을 위한 ERP 앱 쉘"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
