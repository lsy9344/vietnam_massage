import type { ServiceCallCreateInput } from "@/modules/calls/service-call-schema";

/** 원장 새 행의 입력. 운영월과 날짜는 원장이 연 날이다. */
export type NewCallRowDraft = Omit<ServiceCallCreateInput, "requestId">;

/** 새 행 저장 요청. 요청 id는 초안마다 하나이고, 저장을 마칠 때까지 몇 번을 보내도 같다. */
export type NewCallRowRequest = ServiceCallCreateInput;

/**
 * saved: 바로 앞 초안이 저장됐다. 지금 초안은 새 행이다.
 * checking: 응답을 받지 못해(네트워크 오류, 시간 초과) 콜이 만들어졌는지 모른다. 다시 시도는 같은 요청 id로 보낸다.
 */
export type NewRowSaveStatus = "idle" | "saving" | "saved" | "failed" | "checking";

export type NewCallRowSave = {
  draft: NewCallRowDraft;
  requestId: string;
  status: NewRowSaveStatus;
  /** 응답을 기다리는 저장. */
  inFlight: NewCallRowRequest | null;
  /** 저장 결과 안내. 같은 요청 id로 이미 만든 콜이 돌아왔으면 "이미 저장된 콜입니다". */
  notice: string | null;
  /** 저장이 거절된 이유. 서버가 준 문장이다. 거절된 요청은 아무것도 만들지 않았다. */
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export type NewCallRowSaveEvent =
  | { type: "edit"; changes: Partial<NewCallRowDraft> }
  /** 가능 코스에서 고른 시각·코스·Therapist. 저장이 아니므로 앞 저장 결과를 행에서 내린다. */
  | { type: "choose"; changes: Partial<NewCallRowDraft> }
  | { type: "submit" }
  /** nextRequestId: 저장을 마쳤으니 다음 초안은 새 요청 id를 쓴다. */
  | { type: "saved"; request: NewCallRowRequest; notice: string | null; nextRequestId: string }
  | { type: "failed"; request: NewCallRowRequest; message: string | null; fieldErrors?: Record<string, string[]> }
  | { type: "lost"; request: NewCallRowRequest };

function blankDraft(ledger: { operatingMonthId: string; serviceDate: string }): NewCallRowDraft {
  return {
    operatingMonthId: ledger.operatingMonthId,
    serviceDate: ledger.serviceDate,
    startTime: "",
    actualEntryTime: null,
    roomId: null,
    courseId: "",
    customerMemo: null,
    customerId: null,
    therapist1Id: null,
    therapist2Id: null,
    earcareEmployeeId: null,
    status: "RESERVED",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    confirmationCode: null
  };
}

export function initialNewCallRowSave(ledger: { operatingMonthId: string; serviceDate: string }, requestId: string): NewCallRowSave {
  return { draft: blankDraft(ledger), requestId, status: "idle", inFlight: null, notice: null, message: null, fieldErrors: {} };
}

/**
 * 원장 새 행 하나의 저장 순서(스펙 B07). 응답을 받지 못하면 초안과 요청 id를 그대로 두고 "저장 여부 확인 중"이 된다.
 * 다시 보내도 같은 요청 id라 콜은 하나만 생긴다. 보내는 일은 부르는 쪽이 `inFlight`를 보고 한다.
 */
export function newCallRowSaveReducer(state: NewCallRowSave, event: NewCallRowSaveEvent): NewCallRowSave {
  switch (event.type) {
    case "edit": {
      // 보내는 중이거나 저장 여부를 모르는 동안에는 초안을 바꾸지 않는다. 다시 시도는 이미 저장됐을지 모르는 그 값을 보낸다.
      if (isNewRowSaveLocked(state.status)) return state;
      const next = { ...state, draft: { ...state.draft, ...event.changes } };
      // 저장을 마친 뒤 적는 것은 새 행이다. 앞 행의 저장 결과는 내린다.
      return state.status === "saved" ? { ...next, status: "idle", notice: null } : next;
    }
    case "choose":
      if (isNewRowSaveLocked(state.status)) return state;
      return { ...state, draft: { ...state.draft, ...event.changes }, status: "idle", notice: null, message: null, fieldErrors: {} };
    case "submit":
      if (state.status === "saving") return state;
      return {
        ...state,
        status: "saving",
        inFlight: { ...state.draft, requestId: state.requestId },
        notice: null,
        message: null,
        fieldErrors: {}
      };
    case "saved":
      // 이 초안의 어느 시도든 저장됐으면 끝이다. 시간 초과로 그만 기다린 뒤에 온 응답도 같다. 앞 초안의 늦은 응답은 버린다.
      if (event.request.requestId !== state.requestId) return state;
      return {
        ...initialNewCallRowSave({ operatingMonthId: state.draft.operatingMonthId, serviceDate: state.draft.serviceDate }, event.nextRequestId),
        status: "saved",
        notice: event.notice
      };
    case "failed":
      if (!answersCurrentAttempt(state, event.request)) return state;
      return { ...state, status: "failed", inFlight: null, message: event.message, fieldErrors: event.fieldErrors ?? {} };
    case "lost":
      if (event.request !== state.inFlight) return state;
      return { ...state, status: "checking", inFlight: null };
  }
}

/** 다시 보낸 저장을 기다리는 동안 온 앞 시도의 실패는 버리고, 다시 보낸 저장의 답을 기다린다. */
function answersCurrentAttempt(state: NewCallRowSave, request: NewCallRowRequest) {
  return request.requestId === state.requestId && (state.inFlight === null || state.inFlight === request);
}

/** 보내는 중이거나 저장 여부를 모르는 새 행. 입력칸을 잠근다. */
export function isNewRowSaveLocked(status: NewRowSaveStatus) {
  return status === "saving" || status === "checking";
}

/** 저장이 거절되었거나 저장 여부를 모르는 새 행. 떠나기 전 안내 대상이다(스펙 B07, 티켓 18). */
export function isNewRowSaveHeld(status: NewRowSaveStatus) {
  return status === "failed" || status === "checking";
}
