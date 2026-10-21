export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const BUSINESS_TIME_ZONE_OFFSET = "+07:00";
export const BUSINESS_TIME_ZONE_OFFSET_MINUTES = 7 * 60;
export const BUSINESS_DAY_START_TIME = "03:00";

/** 지금 시각을 베트남 업무 시간대(Asia/Ho_Chi_Minh)의 HH:mm으로 돌려준다. */
export function currentBusinessTimeHm(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
