/**
 * "지금"(스펙 B05)은 화면 기능이다: 활성 시간 슬롯과 지금 시각을 받아 슬롯 하나를 고르는 순수 함수로 둔다.
 * 지금을 넘지 않는 마지막 활성 슬롯을 고르고, 지금이 첫 슬롯보다 이르면 첫 슬롯을 고른다. 날짜를 오늘로
 * 맞추거나, 가능 목록을 펼치거나, 저장하거나, Therapist를 고르는 일은 이 함수가 아니라 부르는 쪽(빠른 예약
 * 패널)이 한다.
 *
 * 슬롯은 서버가 이미 sortOrder로 정렬해 준 영업일 순서로 받는다. 영업일이 자정을 넘어 이어질 수 있어(예:
 * 11:00 ~ 다음날 10:50) 첫 슬롯의 시계 값을 하루의 시작으로 보고, 그보다 이른 시계 값은 다음 날로 넘어간
 * 것으로 보정해 비교한다(가능 코스 판정이 쓰는 영업일 개념과 같다). 다만 이 함수는 슬롯 목록이 하루 전체를
 * 덮는다고 가정하지 않는다 — 보정한 지금이 마지막 슬롯보다도 늦으면(슬롯 목록이 지금을 전혀 덮지 않으면)
 * "지금이 첫 슬롯보다 이르다"는 규칙대로 첫 슬롯을 고른다.
 */
export function selectNowSlot(activeSlots: ReadonlyArray<{ value: string }>, now: string): string {
  if (activeSlots.length === 0) {
    return "";
  }

  const first = activeSlots[0]!;
  const last = activeSlots[activeSlots.length - 1]!;
  const dayStart = clockMinutes(first.value);
  const businessMinute = (value: string) => {
    const minutes = clockMinutes(value);
    return minutes < dayStart ? minutes + 24 * 60 : minutes;
  };

  const nowMinutes = businessMinute(now);
  if (nowMinutes > businessMinute(last.value)) {
    return first.value;
  }

  let chosen = first.value;
  for (const slot of activeSlots) {
    if (businessMinute(slot.value) <= nowMinutes) {
      chosen = slot.value;
    }
  }
  return chosen;
}

/**
 * ±10분 버튼(2026-10-22 고객 요청): 예약 시각을 delta분 옮긴다. 슬롯 사이 10분 단위 시각도 서버가 받는다. 영업 시간(첫 슬롯 ~
 * 마지막 슬롯) 밖으로는 나가지 않고, 자정을 넘으면 다음 달력날 시각으로 이어진다. 시각이 비어 있으면 그대로 둔다.
 */
export function shiftStartTime(activeSlots: ReadonlyArray<{ value: string }>, time: string, delta: number): string {
  if (!time || activeSlots.length === 0) {
    return time;
  }
  const dayStart = clockMinutes(activeSlots[0]!.value);
  const businessMinute = (value: string) => {
    const minutes = clockMinutes(value);
    return minutes < dayStart ? minutes + 24 * 60 : minutes;
  };
  const last = businessMinute(activeSlots[activeSlots.length - 1]!.value);
  const next = Math.min(Math.max(businessMinute(time) + delta, dayStart), last) % (24 * 60);
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}

/**
 * 시각 목록: 30분 슬롯에, ±10분으로 맞춘 슬롯 사이 시각(지금 값)이 있으면 그 자리에 끼운다. 빠른 예약의 시각 칸과 콜 상세의
 * 시각 칸이 같이 쓴다 — 슬롯에 없는 저장 값도 빈칸이 아니라 그 시각으로 보인다. 슬롯은 영업일 순서로 받는다.
 */
export function timeOptionsWith<Option extends { value: string; label: string }>(timeSlots: readonly Option[], current: string | null | undefined) {
  const slots = timeSlots.map((slot) => ({ label: slot.label, value: slot.value }));
  if (!current || slots.length === 0 || slots.some((slot) => slot.value === current)) return slots;
  const dayStart = clockMinutes(slots[0]!.value);
  const businessMinute = (value: string) => (clockMinutes(value) < dayStart ? clockMinutes(value) + 24 * 60 : clockMinutes(value));
  const at = slots.filter((slot) => businessMinute(slot.value) < businessMinute(current)).length;
  return [...slots.slice(0, at), { label: current, value: current }, ...slots.slice(at)];
}

export function clockMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** "지금"의 시계 값(HH:mm, 이 기기의 시계). 빠른 예약의 "지금"과 원장 줄의 "입장"이 함께 쓴다. */
export function nowClockString(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
