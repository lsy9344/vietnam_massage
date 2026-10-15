import {
  initialNewCallRowSave,
  isNewRowSaveLocked,
  newCallRowSaveReducer,
  type NewCallRowSave,
  type NewCallRowSaveEvent
} from "@/app/(erp)/calls/call-new-row-save";

/**
 * 빠른 예약 패널의 단계(스펙 F01, 티켓 20). 고객 → 날짜·예약시각 → Therapist·코스 → 객실·메모 → 확인(저장)
 * 순서로 진행하되, 단계를 오가도 값이 유지된다. 21(두 명 코스)은 "therapist" 단계에, 23(방문별 요청)은
 * "room" 단계에, 24(새 고객·최근 방문 가져오기)는 "customer" 단계에 더한다.
 */
export const QUICK_BOOKING_STEPS = ["customer", "schedule", "therapist", "room", "review"] as const;
export type QuickBookingStep = (typeof QUICK_BOOKING_STEPS)[number];

/** 저장 입력 필드가 속한 단계. 저장 거절의 필드별 오류를 패널 요약에서 그 단계로 바로 보낼 때 쓴다. */
export const QUICK_BOOKING_STEP_OF_FIELD: Record<string, QuickBookingStep> = {
  customerId: "customer",
  customerMemo: "customer",
  serviceDate: "schedule",
  startTime: "schedule",
  courseId: "therapist",
  therapist1Id: "therapist",
  therapist2Id: "therapist",
  roomId: "room",
  note: "room"
};

export type QuickBookingState = {
  step: QuickBookingStep;
  /** 저장되지 않은 값이 있는지. 패널을 닫으려 할 때 안내 여부로 쓴다. 저장을 마치면 다시 false다. */
  touched: boolean;
  save: NewCallRowSave;
};

export type QuickBookingEvent = { type: "step"; step: QuickBookingStep } | NewCallRowSaveEvent;

export function initialQuickBookingState(
  ledger: { operatingMonthId: string; serviceDate: string },
  requestId: string
): QuickBookingState {
  return { step: "customer", touched: false, save: initialNewCallRowSave(ledger, requestId) };
}

/**
 * call-new-row-save.ts(티켓 16)의 저장 상태머신을 그대로 감싸 단계 이동만 더한다. edit·choose·submit·
 * failed·lost는 저장되지 않은 값을 남긴 것이라 touched를 켜고, saved는 새 초안으로 돌아가 단계도 처음(고객)
 * 으로 되돌린다(패널은 저장 성공 시 닫히므로 다음에 열 때 새로 시작한다).
 */
export function quickBookingReducer(state: QuickBookingState, event: QuickBookingEvent): QuickBookingState {
  if (event.type === "step") {
    return { ...state, step: event.step };
  }

  const save = newCallRowSaveReducer(state.save, event);
  if (event.type === "saved") {
    return { step: "customer", touched: false, save };
  }
  return { ...state, save, touched: true };
}

export function isQuickBookingLocked(state: QuickBookingState) {
  return isNewRowSaveLocked(state.save.status);
}
