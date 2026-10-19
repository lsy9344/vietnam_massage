import { clockCodeMinuteNow, computeClockInCode, deriveClockCodeDaySecretHex, previousClockCodeMinute } from "@/modules/therapists/therapist-clock-code";
import { addDaysToIsoDate } from "@/lib/operating-date";

/**
 * 출근 코드의 서버 쪽(스펙 M11): 비밀값(NEXTAUTH_SECRET)을 다루는 자리다. 날짜 키 계산·코드 계산
 * 자체는 therapist-clock-code.ts(Web Crypto 순수 모듈)를 그대로 쓰고, 이 파일은 그 비밀값을 어디서
 * 가져오는지(getTherapistClockCodeSecret)와, 매장 화면에 내려줄 값(오늘·다음 날 키)과 Therapist가
 * 입력한 코드를 맞는지 보는 일(verifyTherapistClockInCode)만 더한다.
 */

export type ClockCodeDisplayKey = { date: string; daySecretHex: string };
export type ClockCodeDisplayKeys = { today: ClockCodeDisplayKey; tomorrow: ClockCodeDisplayKey };

/** NEXTAUTH_SECRET에서 이 용도의 비밀값을 가져온다. 새 환경 변수를 두지 않는다(M11). */
export function getTherapistClockCodeSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET이 설정되어 있지 않아 출근 코드를 계산할 수 없습니다.");
  }
  return secret;
}

/**
 * 매장 화면(TV 구석, "출근 코드" 버튼 화면)에 내려줄 오늘·다음 날의 날짜 키. 화면은 이 값만으로
 * 자정을 넘겨도 서버를 다시 부르지 않고 다음 날 키로 넘어간다(D13, M11).
 */
export async function getTherapistClockCodeDisplayKeys(input: { now?: Date; secret?: string } = {}): Promise<ClockCodeDisplayKeys> {
  const secret = input.secret ?? getTherapistClockCodeSecret();
  const today = businessTodayIsoDateFor(input.now);
  const tomorrow = addDaysToIsoDate(today, 1);
  const [todaySecretHex, tomorrowSecretHex] = await Promise.all([
    deriveClockCodeDaySecretHex(secret, today),
    deriveClockCodeDaySecretHex(secret, tomorrow)
  ]);
  return {
    today: { date: today, daySecretHex: todaySecretHex },
    tomorrow: { date: tomorrow, daySecretHex: tomorrowSecretHex }
  };
}

function businessTodayIsoDateFor(now?: Date) {
  return clockCodeMinuteNow(now).calendarDate;
}

/**
 * Therapist가 입력한 코드가 지금 분 또는 직전 분(M11, D14)의 코드와 맞는지 본다. 직전 분이 전날이면
 * 전날 키로 계산한다(previousClockCodeMinute). 두 후보 중 하나만 맞으면 된다.
 */
export async function verifyTherapistClockInCode(input: { now?: Date; submittedCode: string; secret?: string }): Promise<boolean> {
  const submitted = input.submittedCode.trim();
  if (!/^\d{4}$/.test(submitted)) return false;

  const secret = input.secret ?? getTherapistClockCodeSecret();
  const current = clockCodeMinuteNow(input.now);
  const previous = previousClockCodeMinute(current);

  const codes = await Promise.all(
    [current, previous].map(async (candidate) => {
      const daySecretHex = await deriveClockCodeDaySecretHex(secret, candidate.calendarDate);
      return computeClockInCode(daySecretHex, candidate.minuteOfDay);
    })
  );
  return codes.includes(submitted);
}
