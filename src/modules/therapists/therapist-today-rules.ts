/**
 * "오늘" 탭(티켓 03, 스펙 D10–D12)의 DB 없이 확인하는 순수 규칙. service-call-service.ts의 영업일 분
 * 계산(businessMinute 계열)은 비공개라, ledger-flow.ts·quick-booking-now-slot.ts와 같은 방식으로
 * 이 모듈에도 작게 다시 둔다(코드베이스 지도 0절 3·선례).
 */

function clockMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** 영업일 분: dayStart(첫 활성 슬롯 시각)보다 이른 시계 값은 자정을 넘은 다음 날로 본다. */
export function businessMinuteOf(clock: string, dayStart: string): number {
  const minutes = clockMinutes(clock);
  const start = clockMinutes(dayStart);
  return minutes < start ? minutes + 24 * 60 : minutes;
}

/** 콜을 영업일 시작 시각 기준으로 정렬한다(자정을 넘는 시각도 올바른 순서가 된다). */
export function sortByBusinessStartTime<T extends { startTime: string }>(calls: readonly T[], dayStart: string): T[] {
  return [...calls].sort((left, right) => businessMinuteOf(left.startTime, dayStart) - businessMinuteOf(right.startTime, dayStart));
}

// isNoShowStatus·isCanceledStatus와 같은 값이다(assigned-service-call-query.ts와 같은 선례로 작게 다시 둔다).
const NO_SHOW_OR_CANCELED_STATUSES = ["노쇼", "NO_SHOW", "취소", "CANCELED"];

/**
 * 다음 콜까지 남은 분(스펙 D12 "다음 콜까지 남은 시간"). (가정) 아직 시작 시각이 지나지 않은, 취소·노쇼가
 * 아닌 콜 가운데 가장 이른 것까지로 본다 — 지금 진행 중인 콜은 이미 시작했으므로 "다음"이 아니다. 오늘
 * 남은 콜이 없으면 null이다.
 */
export function minutesUntilNextCall(input: {
  now: string;
  dayStart: string;
  calls: ReadonlyArray<{ startTime: string; status: string }>;
}): number | null {
  const nowMinute = businessMinuteOf(input.now, input.dayStart);
  const upcoming = input.calls
    .filter((call) => !NO_SHOW_OR_CANCELED_STATUSES.includes(call.status))
    .map((call) => businessMinuteOf(call.startTime, input.dayStart))
    .filter((minute) => minute > nowMinute)
    .sort((left, right) => left - right);
  return upcoming.length > 0 ? upcoming[0] - nowMinute : null;
}

/**
 * 손님 이름(스펙 D11): 예약자명 → 연결 고객 이름 → 고객/메모 첫 줄. ledger-flow.ts의 ledgerWhoLabel과
 * 같은 순서이나, 이 화면은 예약 경로(채널)를 보이지 않아 이름만 돌려준다. 이 모듈의 좁은 질의가 이미
 * customer.name을 바로 선택해 두므로 ledgerWhoLabel의 배열 인자 모양 대신 이 작은 함수로 다시 둔다.
 */
export function callGuestName(call: { bookerName: string | null; customerName: string | null; customerMemo: string | null }): string | null {
  const memoLine = call.customerMemo?.split("\n")[0]?.trim();
  return call.bookerName?.trim() || call.customerName || memoLine || null;
}
