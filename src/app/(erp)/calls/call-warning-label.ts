import type { MessageKey } from "@/lib/i18n/types";
import type { CallRowWarningDto } from "@/modules/calls/service-call-service";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** 양보 문장은 "4:00 예약이 있습니다"처럼 12시간제로 말한다(스펙 B02 예시). */
export function spokenClock(value: string) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || minute === undefined) return value;
  const spokenHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${spokenHour}:${minute}`;
}

/** 경고 코드를 현장 문장으로 바꾼다. 행의 첫 경고와 콜 상세 패널의 목록이 같은 문장을 쓴다. */
export function callWarningLabel(t: Translate, warning: CallRowWarningDto) {
  const time = warning.relatedTime ? spokenClock(warning.relatedTime) : "";
  switch (warning.code) {
    case "previous_service_unfinished":
      return t("calls.warning.previousServiceUnfinished");
    case "room_overlap":
      return t("calls.warning.roomOverlap", { time });
    case "yield_to_reservation":
      return t("calls.actualEntry.warning", { time });
    case "calculation_error":
      return t("calls.warning.calculationError");
  }
}
