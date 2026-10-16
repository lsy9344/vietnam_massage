import {
  initialNewCallRowSave,
  isNewRowSaveLocked,
  newCallRowSaveReducer,
  type NewCallRowRequest,
  type NewCallRowSave,
  type NewCallRowSaveEvent
} from "@/app/(erp)/calls/call-new-row-save";
import { QUICK_BOOKING_PARTY_MAX_GUESTS, type QuickBookingPartyInput } from "@/modules/calls/service-call-schema";

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
  // 새 고객(F01, 티켓 24). zod 중첩 오류는 "newCustomer" 하나로 모인다.
  newCustomer: "customer",
  serviceDate: "schedule",
  startTime: "schedule",
  courseId: "therapist",
  therapist1Id: "therapist",
  therapist2Id: "therapist",
  roomId: "room",
  note: "room",
  visitRequest: "room",
  // 일행 손님 목록 자체가 잘못된 경우(zod의 guests 오류). 손님을 고르는 단계로 보낸다.
  guests: "therapist"
};

/** 손님 한 명이 고르는 칸(스펙 D10, 티켓 02). 손님 1은 저장 초안의 같은 칸을 쓴다. */
export type QuickBookingGuest = { courseId: string; therapist1Id: string | null; therapist2Id: string | null; roomId: string | null };
export type QuickBookingGuestField = keyof QuickBookingGuest;

/** 일행 저장 거절의 손님별 칸 오류 키. 서버 액션과 패널이 같이 쓴다. */
export function quickBookingGuestFieldKey(position: number, field: QuickBookingGuestField) {
  return `guests.${position}.${field}`;
}

const GUEST_FIELD_KEY = /^guests\.(\d+)\.(\w+)$/;

/** 손님별 칸 오류 키의 손님 번호(1부터). 일행이 함께 쓰는 칸의 오류면 null이다. */
export function quickBookingGuestPosition(field: string) {
  const position = GUEST_FIELD_KEY.exec(field)?.[1];
  return position ? Number(position) : null;
}

/**
 * 일행 저장 입력이 zod에서 거절된 칸의 키. 손님 칸(["guests", 0부터, 칸])은 손님별 키(1부터)로 바꿔 그 손님·칸
 * 옆에 보이게 하고, 나머지는 첫 경로 이름 그대로다(한 건 저장의 flatten과 같다).
 */
export function quickBookingPartyIssueField(path: readonly PropertyKey[]) {
  const [head, index, field] = path;
  if (head === "guests" && typeof index === "number" && typeof field === "string") {
    return quickBookingGuestFieldKey(index + 1, field as QuickBookingGuestField);
  }
  return String(head);
}

/** 저장 거절의 칸 오류가 속한 단계. 손님별 키는 그 칸의 단계로 간다. */
export function quickBookingStepOfField(field: string): QuickBookingStep | undefined {
  const guestField = GUEST_FIELD_KEY.exec(field)?.[2];
  return QUICK_BOOKING_STEP_OF_FIELD[guestField ?? field];
}

/** 손님 한 명 몫의 칸 오류. 손님 1은 손님 키가 없는(한 건 저장과 같은) 오류도 함께 받는다. */
export function guestFieldErrors(fieldErrors: Record<string, string[]>, position: number) {
  const result: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const match = GUEST_FIELD_KEY.exec(key);
    if (match ? Number(match[1]) === position : position === 1) result[match ? match[2] : key] = messages;
  }
  return result;
}

/** 원장의 "1명 추가"(스펙 D14, 티켓 04)가 빠른 예약에 넘기는 일행. size는 지금 일행 인원이다. */
export type QuickBookingJoinParty = { partyId: string; serviceDate: string; startTime: string; customerMemo: string | null; size: number };

export type QuickBookingState = {
  step: QuickBookingStep;
  /** 저장되지 않은 값이 있는지. 패널을 닫으려 할 때 안내 여부로 쓴다. 저장을 마치면 다시 false다. */
  touched: boolean;
  save: NewCallRowSave;
  /** 일행의 손님 2…N(티켓 02). 비어 있으면 한 명 예약이고 지금 흐름과 같다. */
  partyGuests: QuickBookingGuest[];
  /** 이미 있는 일행에 1명을 더하는 중이면 그 일행. 이때는 한 명 저장이고 고객을 잇지 않는다(스펙 D12). */
  joinParty: QuickBookingJoinParty | null;
};

export type QuickBookingEvent =
  | { type: "step"; step: QuickBookingStep }
  /** 패널을 저장 없이 닫기로 확정했을 때(떠나기 전 안내에서 "닫기"를 고름). 새 요청 id로 처음부터 시작한다. */
  | { type: "discard"; nextRequestId: string }
  /** 인원 수(1–10). 손님 2…N을 늘리거나 줄이고, 이미 고른 손님은 남긴다. */
  | { type: "partySize"; size: number }
  /** 손님 2…N 중 한 명의 코스·Therapist·객실. 손님 1은 저장 초안을 고치는 edit·choose를 그대로 쓴다. */
  | { type: "guest"; position: number; changes: Partial<QuickBookingGuest> }
  /** 원장의 "1명 추가": 새 요청 id로 처음부터, 일행의 시각·고객/메모·일행 id를 채워 Therapist 단계에서 시작한다. */
  | { type: "joinParty"; join: QuickBookingJoinParty; nextRequestId: string }
  | NewCallRowSaveEvent;

export function initialQuickBookingState(
  ledger: { operatingMonthId: string; serviceDate: string },
  requestId: string
): QuickBookingState {
  return { step: "customer", touched: false, save: initialNewCallRowSave(ledger, requestId), partyGuests: [], joinParty: null };
}

function blankGuest(): QuickBookingGuest {
  return { courseId: "", therapist1Id: null, therapist2Id: null, roomId: null };
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
  if (event.type === "joinParty") {
    const fresh = initialQuickBookingState(
      { operatingMonthId: state.save.draft.operatingMonthId, serviceDate: event.join.serviceDate },
      event.nextRequestId
    );
    const { partyId, startTime, customerMemo } = event.join;
    return {
      ...fresh,
      step: "therapist",
      joinParty: event.join,
      save: { ...fresh.save, draft: { ...fresh.save.draft, partyId, startTime, customerMemo } }
    };
  }
  if (event.type === "partySize" || event.type === "guest") {
    // 일행에 1명을 더할 때는 그 한 명만 고른다.
    if (state.joinParty) return state;
    // 보내는 중이거나 저장 여부를 모르는 동안에는 일행도 초안처럼 바꾸지 않는다. 다시 시도는 같은 일행을 보낸다.
    if (isQuickBookingLocked(state)) return state;
    // 일행을 바꾸는 것도 고르기다. 앞 저장 결과와 오류를 내린다.
    const save = newCallRowSaveReducer(state.save, { type: "choose", changes: {} });
    if (event.type === "partySize") {
      const others = Math.min(Math.max(Math.trunc(event.size), 1), QUICK_BOOKING_PARTY_MAX_GUESTS) - 1;
      const partyGuests = Array.from({ length: others }, (_, index) => state.partyGuests[index] ?? blankGuest());
      return { ...state, save, partyGuests, touched: true };
    }
    const index = event.position - 2;
    if (index < 0 || index >= state.partyGuests.length) return state;
    const partyGuests = state.partyGuests.map((guest, candidate) => (candidate === index ? { ...guest, ...event.changes } : guest));
    return { ...state, save, partyGuests, touched: true };
  }
  if (event.type === "discard") {
    return initialQuickBookingState(
      { operatingMonthId: state.save.draft.operatingMonthId, serviceDate: state.save.draft.serviceDate },
      event.nextRequestId
    );
  }

  const save = newCallRowSaveReducer(state.save, event);
  if (event.type === "saved") {
    return { step: "customer", touched: false, save, partyGuests: [], joinParty: null };
  }
  return { ...state, save, touched: true };
}

export function isQuickBookingLocked(state: QuickBookingState) {
  return isNewRowSaveLocked(state.save.status);
}

/** 손님 1(저장 초안의 칸)부터 N까지의 고른 값. */
export function quickBookingGuests(draft: Pick<NewCallRowRequest, "courseId" | "therapist1Id" | "therapist2Id" | "roomId">, partyGuests: QuickBookingGuest[]): QuickBookingGuest[] {
  return [
    { courseId: draft.courseId, therapist1Id: draft.therapist1Id ?? null, therapist2Id: draft.therapist2Id ?? null, roomId: draft.roomId ?? null },
    ...partyGuests
  ];
}

/**
 * 일행 저장 요청(스펙 D10–D12). 시각·고객·메모·비고는 저장 초안의 값을 일행이 같이 쓰고, 손님마다 코스·
 * Therapist·객실을 보낸다. 코스를 고르지 않은 손님은 손님 1의 코스를 쓴다. 요청 id는 초안의 것 하나다.
 */
export function quickBookingPartyRequest(request: NewCallRowRequest, partyGuests: QuickBookingGuest[]): QuickBookingPartyInput {
  const { courseId, therapist1Id, therapist2Id, roomId, ...shared } = request;
  const guests = quickBookingGuests({ courseId, therapist1Id, therapist2Id, roomId }, partyGuests).map((guest) => ({
    ...guest,
    courseId: guest.courseId || courseId
  }));
  return { ...shared, guests };
}

/** 손님 position이 아닌 다른 손님들이 이미 고른 Therapist. 한 사람을 두 손님에게 고르지 못하게 목록에서 뺀다. */
export function otherGuestTherapistIds(guests: QuickBookingGuest[], position: number) {
  const taken = new Set<string>();
  guests.forEach((guest, index) => {
    if (index + 1 === position) return;
    for (const therapistId of [guest.therapist1Id, guest.therapist2Id]) {
      if (therapistId) taken.add(therapistId);
    }
  });
  return taken;
}
