import { cancelCellDraft } from "@/app/(erp)/calls/call-ledger-keyboard";
import type { ServiceCallAutosaveInput } from "@/modules/calls/service-call-schema";
import type { ServiceCallRowDto } from "@/modules/calls/service-call-service";

/** 원장 행의 입력. 저장할 때는 이 화면이 마지막으로 받은 행의 updatedAt(expectedUpdatedAt)을 붙인다. */
export type CallRowDraft = Omit<ServiceCallAutosaveInput, "expectedUpdatedAt">;

/**
 * idle: 이 화면에서 아직 저장하지 않았다. 불러온 행 그대로라 저장된 상태로 보인다.
 * conflict: 다른 화면이 먼저 저장했다(STALE_CALL). 최신 내용으로 다시 불러오기 전에는 저장하지 않는다.
 */
export type RowSaveStatus = "idle" | "saving" | "saved" | "failed" | "conflict";

export type CallRowSaveRequest = CallRowDraft & { expectedUpdatedAt: string };

export type CallRowSave = {
  draft: CallRowDraft;
  /** 이 화면이 마지막으로 받은 저장 결과. 다음 저장은 이 행의 updatedAt으로 버전 검사를 받는다. */
  savedRow: ServiceCallRowDto;
  status: RowSaveStatus;
  /** 응답을 기다리는 저장. 행마다 하나만 보낸다. */
  inFlight: CallRowSaveRequest | null;
  /** 응답을 기다리는 동안 저장 요청이 또 왔다. 응답을 받으면 그때의 초안을 받은 updatedAt으로 보낸다. */
  queued: boolean;
  /** 저장 실패나 충돌의 이유. 서버가 준 문장이다. */
  message: string | null;
  fieldErrors: Record<string, string[]>;
  /** STALE_CALL과 함께 받은, 거절 당시의 행. */
  latestRow: ServiceCallRowDto | null;
};

export type CallRowSaveEvent =
  | { type: "edit"; changes: Partial<CallRowDraft> }
  | { type: "commit"; changes?: Partial<CallRowDraft> }
  | { type: "saved"; row: ServiceCallRowDto }
  | { type: "failed"; message: string | null; fieldErrors?: Record<string, string[]> }
  | { type: "stale"; row: ServiceCallRowDto; message: string | null }
  | { type: "reload"; row: ServiceCallRowDto }
  | { type: "cancel" };

export function draftFromRow(row: ServiceCallRowDto): CallRowDraft {
  return {
    serviceCallId: row.id,
    operatingMonthId: row.operatingMonthId,
    serviceDate: row.serviceDate,
    startTime: row.startTime,
    actualEntryTime: row.actualEntryTime,
    roomId: row.roomId,
    courseId: row.courseId,
    customerMemo: row.customerMemo ?? null,
    customerId: row.customerId ?? null,
    therapist1Id: row.therapist1?.id ?? null,
    therapist2Id: row.therapist2?.id ?? null,
    earcareEmployeeId: row.earcare?.id ?? null,
    status: row.status,
    discountTypeCode: row.discountTypeCode ?? null,
    paymentMethodCode: row.paymentMethodCode ?? null,
    note: row.note ?? null,
    confirmationCode: row.confirmationCode ?? null
  };
}

function sameDraft(left: CallRowDraft, right: CallRowDraft) {
  const fields = new Set([...Object.keys(left), ...Object.keys(right)] as Array<keyof CallRowDraft>);
  return [...fields].every((field) => (left[field] ?? null) === (right[field] ?? null));
}

function draftOf(request: CallRowSaveRequest): CallRowDraft {
  const { expectedUpdatedAt, ...draft } = request;
  void expectedUpdatedAt;
  return draft;
}

export function initialCallRowSave(row: ServiceCallRowDto): CallRowSave {
  return {
    draft: draftFromRow(row),
    savedRow: row,
    status: "idle",
    inFlight: null,
    queued: false,
    message: null,
    fieldErrors: {},
    latestRow: null
  };
}

function send(state: CallRowSave, draft: CallRowDraft): CallRowSave {
  return {
    ...state,
    draft,
    status: "saving",
    inFlight: { ...draft, expectedUpdatedAt: state.savedRow.updatedAt },
    queued: false,
    message: null,
    fieldErrors: {}
  };
}

/**
 * 원장 행 하나의 저장 순서(스펙 B07). 저장은 행마다 하나씩만 보내고, 응답을 기다리는 동안의 수정은 모았다가
 * 응답에서 받은 updatedAt으로 다음 저장을 보낸다. 그래서 자기 자동 저장끼리 충돌하지 않고, 늦게 온 응답이
 * 최신 입력을 되돌리지 않는다. 보내는 일은 부르는 쪽이 `inFlight`를 보고 한다.
 */
export function callRowSaveReducer(state: CallRowSave, event: CallRowSaveEvent): CallRowSave {
  switch (event.type) {
    case "edit":
      return { ...state, draft: { ...state.draft, ...event.changes } };
    case "commit": {
      const draft = { ...state.draft, ...event.changes };
      const next = { ...state, draft };
      // 충돌이면 다시 불러오기 전에는 보내지 않는다. 보내도 다시 거절되고, 초안은 그대로 남는다.
      if (state.status === "conflict") return next;
      if (state.inFlight) return sameDraft(draft, draftOf(state.inFlight)) ? next : { ...next, queued: true };
      if (sameDraft(draft, draftFromRow(state.savedRow))) {
        // 고친 것이 없다. 실패한 초안을 저장된 값으로 되돌렸다면 실패도 끝난다.
        return state.status === "failed" ? { ...next, status: "idle", message: null, fieldErrors: {} } : next;
      }
      return send(next, draft);
    }
    case "saved": {
      if (!state.inFlight) return state;
      const sent = draftOf(state.inFlight);
      const next = { ...state, savedRow: event.row, inFlight: null, latestRow: null };
      if (sameDraft(state.draft, sent)) {
        return { ...next, draft: draftFromRow(event.row), status: "saved", queued: false };
      }
      // 응답을 기다리는 동안 입력이 바뀌었다. 그 입력을 남기고, 저장 요청이 있었으면 받은 updatedAt으로 이어서 보낸다.
      return state.queued ? send(next, state.draft) : { ...next, status: "saved" };
    }
    case "failed": {
      if (!state.inFlight) return state;
      const sent = draftOf(state.inFlight);
      const next = { ...state, inFlight: null };
      if (state.queued && !sameDraft(state.draft, sent)) return send(next, state.draft);
      return { ...next, queued: false, status: "failed", message: event.message, fieldErrors: event.fieldErrors ?? {} };
    }
    case "stale":
      if (!state.inFlight) return state;
      return { ...state, inFlight: null, queued: false, status: "conflict", message: event.message, fieldErrors: {}, latestRow: event.row };
    case "reload":
      // "최신 내용으로 다시 불러오기": 초안을 지금 저장된 행으로 바꾸고, 다음 저장은 그 행의 updatedAt으로 검사받는다.
      if (state.status !== "conflict") return state;
      return initialCallRowSave(event.row);
    case "cancel": {
      // Escape: 보내고 있는 저장이 있으면 그 값으로, 없으면 마지막으로 저장된 값으로 되돌린다.
      // 충돌이면 초안을 남긴다. 마지막으로 저장된 값은 이미 옛 값이고, 최신 값은 다시 불러오기로 받는다.
      if (state.status === "conflict") return state;
      const draft = cancelCellDraft(state.draft, state.inFlight ? draftOf(state.inFlight) : draftFromRow(state.savedRow));
      if (state.status === "failed") return { ...state, draft, queued: false, status: "idle", message: null, fieldErrors: {} };
      return { ...state, draft, queued: false };
    }
  }
}

/** 저장이 실패나 충돌로 막혀 화면의 초안이 서버에 없는 상태. 계산 칸은 서버의 옛 계산값 대신 대기 표시를 한다. */
export function isSaveHeld(status: RowSaveStatus) {
  return status === "failed" || status === "conflict";
}
