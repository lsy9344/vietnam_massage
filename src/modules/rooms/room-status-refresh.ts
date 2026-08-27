import { BUSINESS_TIME_ZONE } from "@/lib/business-time";

/**
 * 자동 갱신을 돌리는 시간대. 콜 시간 슬롯(11:00~01:00, `defaultTimeSlots`)을 기준으로 한다.
 * - 시작: 첫 슬롯인 11:00
 * - 종료: 마지막 슬롯 01:00에 시작한 콜이 끝날 때까지 여유를 둔 03:00
 *
 * 이 창을 벗어나면 매장이 확실히 닫혀 있으므로 폴링을 멈춘다. Neon 컴퓨트는 질의 횟수가 아니라
 * "깨어 있는 시간"으로 과금되므로, 마감 후 폴링을 멈춰야 실제로 요금이 줄어든다.
 * (주기를 15초→30초로 늘리는 것만으로는 DB가 계속 깨어 있어 요금이 그대로다.)
 */
export const LIVE_REFRESH_START_HOUR = 11;
export const LIVE_REFRESH_END_HOUR = 3;

const hourFormatterCache = new Map<string, Intl.DateTimeFormat>();

function hourFormatter(timeZone: string) {
  const cached = hourFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" });
  hourFormatterCache.set(timeZone, formatter);
  return formatter;
}

/**
 * 매장 현지 시각의 "시"(0~23)를 돌려준다.
 * 브라우저(직원 노트북·휴대폰)가 어느 지역에 있든 매장 시간대로 판단해야 하므로 시간대를 고정한다.
 */
export function businessHourAt(now: Date, timeZone: string = BUSINESS_TIME_ZONE) {
  return Number(hourFormatter(timeZone).format(now));
}

/** 지금이 자동 갱신을 돌려야 하는 영업 시간대인지 판단한다. 자정을 넘어가는 구간이라 OR로 본다. */
export function isWithinLiveRefreshWindow(now: Date, timeZone: string = BUSINESS_TIME_ZONE) {
  const hour = businessHourAt(now, timeZone);
  return hour >= LIVE_REFRESH_START_HOUR || hour < LIVE_REFRESH_END_HOUR;
}

export function latestRoomStatusUpdatedAt(values: Array<{ updatedAt: string }>, fallbackUpdatedAt: string) {
  if (values.length === 0) return fallbackUpdatedAt;
  return values.reduce((latest, value) => (value.updatedAt > latest ? value.updatedAt : latest), values[0].updatedAt);
}
