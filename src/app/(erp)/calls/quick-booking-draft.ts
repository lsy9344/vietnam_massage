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
 * 빠른 예약의 두 단계(1018 스펙 D19). ① 조건: 날짜·시각·인원을 고르고 코스 칩으로 손님을 담는다. ② 고객: 예약 경로·
 * 예약자명·메모를 넣고 저장한다. 객실 단계와 확인 단계는 없다. 단계를 오가도 값이 유지된다.
 */
export const QUICK_BOOKING_STEPS = ["conditions", "customer"] as const;
export type QuickBookingStep = (typeof QUICK_BOOKING_STEPS)[number];

/** 저장 입력 필드가 속한 단계. 저장 거절의 필드별 오류를 패널 요약에서 그 단계로 바로 보낼 때 쓴다. */
export const QUICK_BOOKING_STEP_OF_FIELD: Record<string, QuickBookingStep> = {
  customerId: "customer",
  customerMemo: "customer",
  // zod 중첩 오류는 "newCustomer" 하나로 모인다.
  newCustomer: "customer",
  bookingChannelCode: "customer",
  bookerName: "customer",
  bookerHandle: "customer",
  note: "customer",
  visitRequest: "customer",
  serviceDate: "conditions",
  startTime: "conditions",
  courseId: "conditions",
  therapist1Id: "conditions",
  therapist2Id: "conditions",
  roomId: "conditions",
  // 일행 손님 목록 자체가 잘못된 경우(zod의 guests 오류). 손님을 담는 단계로 보낸다.
  guests: "conditions"
};

/** 전화·워크인, 경로를 아직 안 고른 상태만 메신저 ID(ID 칸)를 받지 않는다(2026-10-23 고객 요청). */
const BOOKING_CHANNELS_WITHOUT_HANDLE = new Set(["PHONE", "WALK_IN"]);

/** 이 예약 경로가 메신저 ID(ID 칸)를 받는지. 빠른 예약 ②와 저장 요청 만들기가 함께 쓴다. */
export function bookingChannelTakesHandle(code: string | null | undefined): boolean {
  if (!code) return false;
  return !BOOKING_CHANNELS_WITHOUT_HANDLE.has(code);
}

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
export type QuickBookingJoinParty = {
  partyId: string;
  serviceDate: string;
  startTime: string;
  customerMemo: string | null;
  bookingChannelCode: string | null;
  bookerName: string | null;
  bookerHandle: string | null;
  size: number;
};

export type QuickBookingState = {
  step: QuickBookingStep;
  /** 저장되지 않은 값이 있는지. 패널을 닫으려 할 때 안내 여부로 쓴다. 저장을 마치면 다시 false다. */
  touched: boolean;
  /** 손님 1의 코스·Therapist는 저장 초안의 칸이기도 하다. 담은 손님이 바뀔 때마다 맞춘다. */
  save: NewCallRowSave;
  /** 인원(1–10). 이만큼 손님을 담아야 ②로 넘어가 저장할 수 있다. */
  partySize: number;
  /** 코스 칩으로 담은 손님(1018 스펙 D20). Therapist가 비었으면 미지명 손님이다. 객실은 고르지 않는다. */
  guests: QuickBookingGuest[];
  /**
   * 원장의 "1명 추가"로 열었으면 그 일행. 이때는 한 명 저장이고 고객을 잇지 않는다(스펙 D12). 시각을 바꾸면 일행이 아닌
   * 별도 예약이라 고객은 보통 예약과 같다(1018 스펙 D29, joinsParty).
   */
  joinParty: QuickBookingJoinParty | null;
  /** 원장 현황 줄 카드에서 열었으면 그 Therapist. ①의 목록 맨 위(미지명 줄 아래)에 골라 둔다. */
  presetTherapistId: string | null;
};

export type QuickBookingEvent =
  | { type: "step"; step: QuickBookingStep }
  /** 패널을 저장 없이 닫기로 확정했을 때(떠나기 전 안내에서 "닫기"를 고름). 새 요청 id로 처음부터 시작한다. */
  | { type: "discard"; nextRequestId: string }
  /** 인원 수(1–10). 줄면 뒤에 담은 손님부터 뺀다. */
  | { type: "partySize"; size: number }
  /** 코스 칩 하나를 눌러 손님을 담는다. therapist1Id가 null이면 미지명 손님이다. */
  | { type: "addGuest"; guest: { courseId: string; therapist1Id: string | null } }
  | { type: "removeGuest"; index: number }
  /** D코스 손님의 두 번째 Therapist(index는 0부터). null이면 비운다. */
  | { type: "secondTherapist"; index: number; therapistId: string | null }
  /** 원장의 "1명 추가": 새 요청 id로 처음부터, 일행의 시각·고객/메모·예약 경로·예약자명·일행 id를 채워 시작한다. */
  | { type: "joinParty"; join: QuickBookingJoinParty; nextRequestId: string }
  /**
   * 패널을 새로 연다: 새 요청 id로 처음부터, 날짜와 기본 시각을 채운다. 원장 Therapist 현황 줄의 카드(1018 스펙 D17)에서
   * 열면 그 Therapist를 골라 둔다. 아직 고친 것이 없다.
   */
  | { type: "start"; serviceDate: string; startTime: string; presetTherapistId: string | null; nextRequestId: string }
  | NewCallRowSaveEvent;

export function initialQuickBookingState(
  ledger: { operatingMonthId: string; serviceDate: string },
  requestId: string
): QuickBookingState {
  return {
    step: "conditions",
    touched: false,
    save: initialNewCallRowSave(ledger, requestId),
    partySize: 1,
    guests: [],
    joinParty: null,
    presetTherapistId: null
  };
}

function freshFrom(state: QuickBookingState, serviceDate: string, nextRequestId: string) {
  return initialQuickBookingState({ operatingMonthId: state.save.draft.operatingMonthId, serviceDate }, nextRequestId);
}

/** 담은 손님을 바꾼다. 손님 1은 저장 초안의 칸에도 적는다. 고르기라서 앞 저장 결과와 오류를 내린다. */
function withGuests(state: QuickBookingState, guests: QuickBookingGuest[], partySize = state.partySize): QuickBookingState {
  const first = guests[0];
  const save = newCallRowSaveReducer(state.save, {
    type: "choose",
    changes: {
      courseId: first?.courseId ?? "",
      therapist1Id: first?.therapist1Id ?? null,
      therapist2Id: first?.therapist2Id ?? null,
      roomId: null
    }
  });
  return { ...state, save, guests, partySize, touched: true };
}

/** "1명 추가"로 연 손님이 그 일행에 붙는지. 일행은 같은 날·같은 예약 시각인 콜만이다(1018 스펙 D29). */
export function joinsParty(state: Pick<QuickBookingState, "joinParty" | "save">) {
  const { joinParty, save } = state;
  return joinParty !== null && save.draft.serviceDate === joinParty.serviceDate && save.draft.startTime === joinParty.startTime;
}

/** 담은 손님(exceptIndex는 빼고)이 이미 맡은 Therapist. 한 사람을 두 손님에게 담지 못한다. */
export function takenTherapistIds(guests: QuickBookingGuest[], exceptIndex = -1): ReadonlySet<string> {
  return new Set(guests.flatMap((guest, index) => (index === exceptIndex ? [] : [guest.therapist1Id, guest.therapist2Id])).filter((id): id is string => Boolean(id)));
}

/**
 * 저장할 초안(1018 스펙 D21–D22). 예약자명은 고객/메모 칸에도 넣어 객실·TV 같은 다른 화면이 지금처럼 이름을 보인다.
 * 기존 고객을 고르지 않았고 예약자명이 있으면 그 이름으로 새 고객을 만든다. 일행에 더하는 손님은 고객을 잇지 않는다
 * (스펙 D12). "1명 추가"에서 시각을 바꾼 손님은 일행 id 없이 보통 예약과 같이 저장하고, 일행에서는 경로·예약자명만
 * 이어받는다(D29). 이름이 빈 워크인의 임시 이름은 서버가 붙인다. 메신저 ID(bookerHandle)는 그 예약 경로가 메신저일
 * 때만 보내고, 아니면 전에 다른 경로에서 입력해 둔 ID가 남지 않게 null로 지운다(2026-10-23 고객 요청).
 */
function bookingDraft(state: QuickBookingState) {
  const { draft } = state.save;
  const bookerName = draft.bookerName?.trim() || null;
  const bookerHandle = bookingChannelTakesHandle(draft.bookingChannelCode) ? draft.bookerHandle?.trim() || null : null;
  const joining = joinsParty(state);
  // 별도 예약은 일행의 고객/메모(join 때 채운 값)를 쓰지 않는다.
  const separate = state.joinParty !== null && !joining;
  return {
    ...draft,
    bookerName,
    bookerHandle,
    customerMemo: bookerName ?? (separate ? null : (draft.customerMemo ?? null)),
    partyId: joining ? state.joinParty!.partyId : null,
    customerId: joining ? null : (draft.customerId ?? null),
    newCustomer:
      !joining && !draft.customerId && bookerName ? { name: bookerName, phone: null, memo: null, preferenceNote: null } : null
  };
}

/**
 * call-new-row-save.ts(티켓 16)의 저장 상태머신을 그대로 감싸 단계와 손님 담기를 더한다. edit·choose·submit·failed·
 * lost는 저장되지 않은 값을 남긴 것이라 touched를 켜고, saved는 새 초안으로 돌아가 단계도 처음(조건)으로 되돌린다.
 */
export function quickBookingReducer(state: QuickBookingState, event: QuickBookingEvent): QuickBookingState {
  switch (event.type) {
    case "step":
      return { ...state, step: event.step };
    case "discard":
      return freshFrom(state, state.save.draft.serviceDate, event.nextRequestId);
    case "joinParty": {
      const next = freshFrom(state, event.join.serviceDate, event.nextRequestId);
      const { partyId, startTime, customerMemo, bookingChannelCode, bookerName, bookerHandle } = event.join;
      return {
        ...next,
        joinParty: event.join,
        save: { ...next.save, draft: { ...next.save.draft, partyId, startTime, customerMemo, bookingChannelCode, bookerName, bookerHandle } }
      };
    }
    case "start": {
      const next = freshFrom(state, event.serviceDate, event.nextRequestId);
      return { ...next, presetTherapistId: event.presetTherapistId, save: { ...next.save, draft: { ...next.save.draft, startTime: event.startTime } } };
    }
    case "partySize":
    case "addGuest":
    case "removeGuest":
    case "secondTherapist": {
      // 보내는 중이거나 저장 여부를 모르는 동안에는 손님도 초안처럼 바꾸지 않는다. 다시 시도는 같은 손님을 보낸다.
      if (isQuickBookingLocked(state)) return state;
      if (event.type === "partySize") {
        // 일행에 1명을 더할 때는 그 한 명만 담는다.
        if (state.joinParty) return state;
        const size = Math.min(Math.max(Math.trunc(event.size) || 1, 1), QUICK_BOOKING_PARTY_MAX_GUESTS);
        return withGuests(state, state.guests.slice(0, size), size);
      }
      if (event.type === "addGuest") {
        if (state.guests.length >= state.partySize) return state;
        const { courseId, therapist1Id } = event.guest;
        if (therapist1Id && takenTherapistIds(state.guests).has(therapist1Id)) return state;
        return withGuests(state, [...state.guests, { courseId, therapist1Id, therapist2Id: null, roomId: null }]);
      }
      if (event.type === "removeGuest") {
        if (!state.guests[event.index]) return state;
        return withGuests(state, state.guests.filter((_, index) => index !== event.index));
      }
      const guest = state.guests[event.index];
      if (!guest) return state;
      if (event.therapistId && takenTherapistIds(state.guests, event.index).has(event.therapistId)) return state;
      if (event.therapistId && event.therapistId === guest.therapist1Id) return state;
      return withGuests(
        state,
        state.guests.map((candidate, index) => (index === event.index ? { ...candidate, therapist2Id: event.therapistId } : candidate))
      );
    }
    case "submit": {
      // 인원만큼 담아야 저장한다(1018 스펙 D20).
      if (state.guests.length === 0 || state.guests.length !== state.partySize) return state;
      const prepared = { ...state.save, draft: bookingDraft(state) };
      return { ...state, save: newCallRowSaveReducer(prepared, event), touched: true };
    }
    case "saved": {
      const save = newCallRowSaveReducer(state.save, event);
      if (save === state.save) return state;
      return { ...initialQuickBookingState({ operatingMonthId: save.draft.operatingMonthId, serviceDate: save.draft.serviceDate }, save.requestId), save };
    }
    default:
      return { ...state, save: newCallRowSaveReducer(state.save, event), touched: true };
  }
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
