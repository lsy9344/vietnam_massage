import type { Locale } from "@/lib/i18n/config";

/**
 * 숫자/날짜/금액 표시용 Intl locale.
 * - vi: "vi-VN", ko: "ko-KR"
 *
 * 주의: 업무 timezone(Asia/Seoul)과 VND 통화는 유지한다.
 * ISO 날짜 생성용 en-CA(src/lib/operating-date.ts)는 이 helper와 무관하며 건드리지 않는다.
 */
function intlLocale(locale: Locale): string {
  return locale === "vi" ? "vi-VN" : "ko-KR";
}

/** 정수/실수 그룹 구분 표시. 기존 `Intl.NumberFormat("ko-KR")` 대체. */
export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/**
 * VND 금액 표시. 통화 단위는 VND로 고정한다.
 * 기존 화면이 통화 기호 없이 숫자만 노출하던 점을 유지하기 위해 기본은 그룹 구분 숫자만 반환한다.
 * 통화 기호가 필요하면 withSymbol=true를 사용한다.
 */
export function formatCurrencyVnd(locale: Locale, value: number, withSymbol = false): string {
  if (withSymbol) {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0
    }).format(value);
  }
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(value);
}

/** 날짜/시간 표시. 기존 `Intl.DateTimeFormat("ko-KR")` 대체. */
export function formatDateTime(locale: Locale, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(value));
}

/** Asia/Seoul 기준 HH:mm 시각. 기존 room-status-card formatKstTime 대체. */
export function formatKstTime(locale: Locale, value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
