import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
});

export const metadata: Metadata = {
  title: "Vietnam Aesthetic ERP",
  description: "운영 원장, 객실 현황, 정산, 월마감을 위한 ERP 앱 쉘"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
