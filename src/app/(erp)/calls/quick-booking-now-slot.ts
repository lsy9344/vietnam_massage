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

function clockMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}
