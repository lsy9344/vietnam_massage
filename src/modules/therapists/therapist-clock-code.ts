import { addDaysToIsoDate, businessClockString, businessTodayIsoDate } from "@/lib/operating-date";

/**
 * 출근 코드 계산(스펙 D13–D14, M11). 매장 화면(TV 구석, "출근 코드" 버튼 화면)과 서버(검증)가 같은
 * 함수를 쓴다. Cloudflare Workers와 브라우저 둘 다에서 돌아야 해서 Web Crypto(crypto.subtle)만 쓰고,
 * Node 전용 API(node:crypto, Buffer)는 쓰지 않는다 — 선례가 없는 첫 Web Crypto 모듈이다(코드베이스
 * 지도 16절). 비밀값(NEXTAUTH_SECRET)을 다루는 쪽(서버)은 therapist-clock-code-service.ts가 맡고,
 * 이 모듈은 "날짜 키(day secret)"부터만 안다 — 매장 화면에 비밀값 자체는 내려가지 않는다(M11).
 */

const CODE_DIGITS = 4;
const CODE_MODULUS = 10 ** CODE_DIGITS;
const MINUTES_PER_DAY = 1440;
/** HMAC 메시지에 붙이는 용도 이름(M11: "NEXTAUTH_SECRET에서 용도 이름을 붙여 끌어낸다"). */
const DAY_SECRET_LABEL = "therapist-clock-code";

export type ClockCodeMinute = {
  /** 매장 시간대(Asia/Ho_Chi_Minh) 달력 날짜. 운영일이 아니다(M11) — YYYY-MM-DD. */
  calendarDate: string;
  /** 그 달력 날짜 안의 분(0–1439). */
  minuteOfDay: number;
};

function toUint8Array(bytes: ArrayBuffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

/** 바이트 → 소문자 hex. src/app/(erp)/calls/call-request-id.ts의 newRequestId와 같은 모양(선례). */
function bytesToHex(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function hmacSha256(keyBytes: Uint8Array<ArrayBuffer>, message: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toUint8Array(signature);
}

/** 지금의 (달력 날짜, 분)을 매장 시간대로 돌려준다. */
export function clockCodeMinuteNow(now = new Date()): ClockCodeMinute {
  const calendarDate = businessTodayIsoDate(now);
  const [hour, minute] = businessClockString(now).split(":").map(Number);
  return { calendarDate, minuteOfDay: hour * 60 + minute };
}

/** 바로 앞 1분. 자정을 넘기면 전날의 마지막 분(1439)이다(M11: "직전 분이 전날이면 전날 키로 계산"). */
export function previousClockCodeMinute(minute: ClockCodeMinute): ClockCodeMinute {
  if (minute.minuteOfDay === 0) {
    return { calendarDate: addDaysToIsoDate(minute.calendarDate, -1), minuteOfDay: MINUTES_PER_DAY - 1 };
  }
  return { calendarDate: minute.calendarDate, minuteOfDay: minute.minuteOfDay - 1 };
}

/**
 * 서버 비밀값(NEXTAUTH_SECRET)에서 그날만 쓰는 키를 끌어낸다(M11). HMAC 메시지에 용도 이름과 날짜를
 * 함께 넣어, 이 날짜 키가 새도 다른 날짜나 다른 용도의 키를 끌어낼 수 없게 한다. hex로 돌려줘
 * 매장 화면에 JSON으로 그대로 내려줄 수 있다.
 */
export async function deriveClockCodeDaySecretHex(secret: string, calendarDate: string): Promise<string> {
  const bytes = await hmacSha256(new TextEncoder().encode(secret), `${DAY_SECRET_LABEL}:${calendarDate}`);
  return bytesToHex(bytes);
}

/** 그날 키와 분 번호로 4자리 코드를 만든다(M11). 서버(검증)와 매장 화면(표시)이 이 함수 하나를 쓴다. */
export async function computeClockInCode(daySecretHex: string, minuteOfDay: number): Promise<string> {
  const signature = await hmacSha256(hexToBytes(daySecretHex), String(minuteOfDay));
  const view = new DataView(signature.buffer, signature.byteOffset, 4);
  const code = view.getUint32(0) % CODE_MODULUS;
  return String(code).padStart(CODE_DIGITS, "0");
}
