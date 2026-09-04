import type { Locale } from "@/lib/i18n/config";
import { BUSINESS_TIME_ZONE } from "@/lib/business-time";

/**
 * 숫자/날짜/금액 표시용 Intl locale.
 * - vi: "vi-VN", ko: "ko-KR"
 *
 * 주의: 업무 timezone(Asia/Ho_Chi_Minh)과 VND 통화는 유지한다.
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

/**
 * 날짜/시간 표시. 기존 `Intl.DateTimeFormat("ko-KR")` 대체.
 *
 * 24시간제로 고정한다. ko-KR 기본값인 12시간제는 오전/오후 문구를 만드는데, 서버(Node)와
 * 브라우저(Chromium)의 ICU 데이터가 다르면 같은 시각이 "오후 7:42"와 "PM 7:42"로 갈려
 * hydration mismatch가 난다. 그러면 React가 트리를 다시 그리면서 서버 액션 결과 메시지와
 * 입력값이 사라져 "저장이 안 된 것처럼" 보인다. 자릿수 표기가 없으면 판정 문구도 없다.
 */
export function formatDateTime(locale: Locale, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: BUSINESS_TIME_ZONE, hour12: false, ...options }).format(new Date(value));
}

/** 베트남 업무 시간 기준 HH:mm 시각. */
export function formatBusinessTime(locale: Locale, value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
