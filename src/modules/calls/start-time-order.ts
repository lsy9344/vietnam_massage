/**
 * 예약 시각의 순서와 허용 범위. 시간 슬롯은 30분 단위지만, 콜은 영업 시간 안이면 슬롯 사이의 10분 단위 시각(11:10 등)에도
 * 잡는다(2026-10-22 고객 요청). 영업일은 자정을 넘어 이어지므로 시각 글자가 아니라 슬롯 순서와 영업일 분으로 비교한다.
 */
/** isActive가 없으면 활성 슬롯으로 본다(활성 슬롯만 읽어 온 목록). */
type Slot = { value: string; sortOrder: number; isActive?: boolean };

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MINUTES = 24 * 60;

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/** 활성 슬롯을 순서대로, 첫 슬롯을 영업일 시작으로 본 분과 함께. 첫 슬롯보다 이른 시각은 그 영업일의 뒤(다음 달력날)다. */
function activeSlotMinutes(slots: readonly Slot[]) {
  const active = slots.filter((slot) => slot.isActive !== false).sort((left, right) => left.sortOrder - right.sortOrder);
  const dayStart = active[0] ? clockMinutes(active[0].value) : 0;
  const minuteOf = (value: string) => {
    const minutes = clockMinutes(value);
    return minutes < dayStart ? minutes + DAY_MINUTES : minutes;
  };
  return { minuteOf, active: active.map((slot) => ({ minute: minuteOf(slot.value), order: slot.sortOrder })) };
}

/**
 * 원장 정렬 순서. 슬롯 시각은 그 슬롯의 정렬 순서, 슬롯 사이 시각은 바로 앞 활성 슬롯의 순서 뒤에 분만큼 붙는다(한 슬롯 간격은
 * 1000분보다 짧다). 시각 모양이 아니거나 활성 슬롯이 없으면 undefined — 부르는 쪽이 끝으로 보낸다.
 */
export function startTimeOrder(slots: readonly Slot[]) {
  const bySlot = new Map(slots.map((slot) => [slot.value, slot.sortOrder]));
  const { minuteOf, active } = activeSlotMinutes(slots);
  return (time: string): number | undefined => {
    const slotOrder = bySlot.get(time);
    if (slotOrder !== undefined) return slotOrder;
    if (!CLOCK_TIME.test(time)) return undefined;
    const minute = minuteOf(time);
    const previous = active.filter((slot) => slot.minute < minute).at(-1);
    return previous ? previous.order + (minute - previous.minute) / 1000 : undefined;
  };
}

/** 슬롯이 아닌 예약 시각도 10분 단위이고 첫 활성 슬롯과 마지막 활성 슬롯 사이면 받는다. */
export function isStartTimeWithinSlots(time: string, slots: readonly Slot[]) {
  if (!CLOCK_TIME.test(time) || clockMinutes(time) % 10 !== 0) return false;
  const { minuteOf, active } = activeSlotMinutes(slots);
  const first = active[0];
  const last = active.at(-1);
  if (!first || !last) return false;
  const minute = minuteOf(time);
  return minute >= first.minute && minute <= last.minute;
}
