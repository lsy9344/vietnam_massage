import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CallRowSaveStatus, NewCallRowSaveStatus } from "@/app/(erp)/calls/call-row-save-status";
import { CallEditPanel } from "@/app/(erp)/calls/call-edit-panel";
import { CallLedgerList } from "@/app/(erp)/calls/call-ledger-list";
import { initialCallRowSave } from "@/app/(erp)/calls/call-row-save";
import { LocaleProvider } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [{ value: "16:00", label: "16:00" }],
  courses: [{ value: "course-a", label: "A 누루60" }],
  statuses: [{ value: "예약", label: "예약" }],
  discountTypes: [],
  paymentMethods: [],
  confirmationCodes: [],
  bookingChannels: [],
  therapists: [{ value: "therapist-1", label: "Therapist 1" }],
  expenseHandlers: []
};

const row: ServiceCallRowDto = {
  id: "call-1",
  operatingMonthId: "month-2026-06",
  serviceDate: "2026-06-10",
  startTime: "16:00",
  actualEntryTime: null,
  actualEndTime: null,
  displayEnd: "17:00",
  reservedEnd: "17:00",
  warningTime: "17:00",
  warnings: [{ code: "yield_to_reservation", relatedTime: "17:00", relatedCallIds: ["after"] }],
  roomId: "room-101",
  roomLabel: "101 호실",
  courseId: "course-a",
  courseCode: "A",
  courseLabel: "A 누루60",
  customerId: null,
  customerMemo: "지윤",
  therapist1: { id: "therapist-1", displayName: "Therapist 1", staffCode: "THR-001" },
  therapist2: null,
  status: "예약",
  discountTypeCode: null,
  paymentMethodCode: null,
  note: null,
  visitRequest: null,
  bookingChannelCode: null,
  bookerName: null,
  confirmationCode: null,
  partyId: null,
  partyPosition: null,
  basePrice: 0,
  paymentAmount: 0,
  discountAmount: 0,
  therapist1Commission: 0,
  therapist2Commission: 0,
  calculationStatus: "not_completed",
  calculationErrorCode: null,
  calculationErrorMessage: null,
  createdAt: "2026-06-10T06:00:00.000Z",
  // 베트남 시각 14:28
  updatedAt: "2026-06-10T07:28:00.000Z",
  savedAt: "2026-06-10T07:28:00.000Z"
};

const staleMessage = "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.";

function render(locale: "ko" | "vi", child: ReturnType<typeof createElement>) {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(LocaleProvider, { locale, children: child }));
}

function saveStatus(locale: "ko" | "vi", props: Partial<Parameters<typeof CallRowSaveStatus>[0]>) {
  return render(
    locale,
    createElement(CallRowSaveStatus, {
      state: "saved",
      savedAt: row.savedAt,
      message: null,
      onRetry: () => {},
      onReload: () => {},
      ...props
    })
  );
}

function buttons(markup: string) {
  return [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
}

describe("call row save status", () => {
  it("shows a call nobody has edited yet as saved with its save time in the panel, and keeps the line's warnings apart", () => {
    const panel = render(
      "ko",
      createElement(CallEditPanel, {
        conflict: null,
        customers: [],
        focusRequest: null,
        isLocked: false,
        onCancel: () => {},
        onCommit: () => {},
        onEdit: () => {},
        onReload: () => {},
        onRetry: () => {},
        onSelectCall: () => {},
        options,
        readOnly: false,
        row,
        rows: [row],
        save: initialCallRowSave(row),
        showSettlementAmounts: false,
        warningsRow: row
      })
    );
    const saveState = panel.slice(panel.indexOf("data-save-state"), panel.indexOf("data-save-state") + 600);
    assert.match(saveState, /data-save-state="idle"/);
    assert.match(saveState, /저장됨/);
    assert.match(saveState, /14:28/);

    const list = render("ko", createElement(CallLedgerList, { isLocked: false, options, rows: [row], showSettlementAmounts: false }));
    const warning = list.match(/<button aria-label="경고 1건:[^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    assert.match(warning, /5:00 예약/);
    assert.doesNotMatch(warning, /저장/);
  });

  it("tells saving, saved, failed, and conflict apart by words and by tone", () => {
    const saving = saveStatus("ko", { state: "saving" });
    const failed = saveStatus("ko", { state: "failed", message: "활성 코드값을 선택하세요." });
    const conflict = saveStatus("ko", { state: "conflict", message: staleMessage });
    const saved = saveStatus("ko", { state: "saved" });

    assert.match(saving, /저장 중/);
    assert.match(saving, /text-info/);
    assert.match(saved, /저장됨/);
    assert.match(saved, /14:28/);
    assert.match(saved, /text-success/);
    assert.match(failed, /저장 실패/);
    assert.match(failed, /text-danger/);
    assert.match(failed, /활성 코드값을 선택하세요\./);
    assert.match(conflict, /충돌 확인 필요/);
    assert.match(conflict, /text-warning/);
    assert.match(conflict, new RegExp(staleMessage.replace(/\./g, "\\.")));
  });

  it("offers a retry after a failed save, and only reloading the latest row after a conflict", () => {
    assert.deepEqual(buttons(saveStatus("ko", { state: "failed", message: "저장 실패 이유" })), ["재시도"]);
    assert.deepEqual(buttons(saveStatus("ko", { state: "conflict", message: staleMessage })), ["최신 내용으로 다시 불러오기"]);
    assert.deepEqual(buttons(saveStatus("ko", { state: "saving" })), []);
    assert.deepEqual(buttons(saveStatus("ko", { state: "saved" })), []);
  });

  it("speaks Vietnamese by default", () => {
    const conflict = saveStatus("vi", { state: "conflict", message: "Cuộc gọi này đã được thay đổi ở màn hình khác. Hãy tải lại rồi mới lưu." });

    assert.match(conflict, /Cần kiểm tra xung đột/);
    assert.deepEqual(buttons(conflict), ["Tải lại nội dung mới nhất"]);
  });
});

describe("new call row save status", () => {
  function newRowStatus(locale: "ko" | "vi", props: Partial<Parameters<typeof NewCallRowSaveStatus>[0]>) {
    return render(locale, createElement(NewCallRowSaveStatus, { state: "idle", notice: null, message: null, onRetry: () => {}, ...props }));
  }

  it("shows a new row whose response was lost as not yet known to be saved, with a retry, in both languages", () => {
    const ko = newRowStatus("ko", { state: "checking" });
    assert.match(ko, /저장 여부 확인 중/);
    assert.match(ko, /응답을 받지 못했습니다/);
    assert.deepEqual(buttons(ko), ["재시도"]);

    const vi = newRowStatus("vi", { state: "checking" });
    assert.match(vi, /Đang kiểm tra đã lưu chưa/);
    assert.match(vi, /Không nhận được phản hồi/);
    assert.deepEqual(buttons(vi), ["Thử lại"]);
  });

  it("says when the new row came back as a call saved before, and why a new row was turned down", () => {
    const already = newRowStatus("ko", { state: "saved", notice: "이미 저장된 콜입니다." });
    assert.match(already, /저장됨/);
    assert.match(already, /이미 저장된 콜입니다\./);
    assert.deepEqual(buttons(already), []);

    const failed = newRowStatus("ko", { state: "failed", message: "코스를 선택하세요." });
    assert.match(failed, /저장 실패/);
    assert.match(failed, /코스를 선택하세요\./);
    assert.deepEqual(buttons(failed), []);

    assert.doesNotMatch(newRowStatus("ko", { state: "idle" }), /저장/);
  });
});
