"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PanelSection } from "@/app/(erp)/settlements/settlement-parts";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/types";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { EDITABLE_CALL_FIELDS, type EditableCallField } from "@/app/(erp)/calls/call-ledger-keyboard";
import { draftFromRow, type CallRowDraft } from "@/app/(erp)/calls/call-row-save";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** 원장의 열 순서(CALL_GRID_COLUMNS, editable-call-grid.tsx)와 같은 표시 라벨 key. */
const FIELD_LABEL_KEY: Record<EditableCallField, MessageKey> = {
  startTime: "calls.column.time",
  actualEntryTime: "calls.column.actualEntry",
  roomId: "calls.column.room",
  courseId: "calls.column.course",
  customerMemo: "calls.column.customerMemo",
  customerId: "calls.column.customer",
  therapist1Id: "calls.column.therapist1",
  therapist2Id: "calls.column.therapist2",
  earcareEmployeeId: "calls.column.earcare",
  status: "calls.column.reservationStatus",
  discountTypeCode: "calls.column.discountType",
  paymentMethodCode: "calls.column.paymentMethod",
  note: "calls.column.note",
  visitRequest: "calls.column.visitRequest",
  confirmationCode: "calls.column.confirmation"
};

function optionLabel(options: ServiceCallOption[], value: string | null | undefined) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

function customerLabel(customers: CustomerDto[], customerId: string | null | undefined, t: Translate) {
  if (!customerId) return t("calls.detail.customerLink.unlinked");
  const customer = customers.find((candidate) => candidate.id === customerId);
  if (!customer) return customerId;
  return [customer.name, customer.phone].filter((part) => part && part.trim() !== "").join(" · ");
}

function fieldValue(
  field: EditableCallField,
  draft: CallRowDraft,
  options: ServiceCallFormOptions,
  customers: CustomerDto[],
  t: Translate
): string {
  switch (field) {
    case "startTime":
      return draft.startTime;
    case "actualEntryTime":
      return draft.actualEntryTime ?? "-";
    case "roomId":
      return optionLabel(options.rooms, draft.roomId) ?? "-";
    case "courseId":
      return optionLabel(options.courses, draft.courseId) ?? "-";
    case "customerMemo":
      return draft.customerMemo ?? "-";
    case "customerId":
      return customerLabel(customers, draft.customerId, t);
    case "therapist1Id":
      return optionLabel(options.therapists, draft.therapist1Id) ?? "-";
    case "therapist2Id":
      return optionLabel(options.therapists, draft.therapist2Id) ?? "-";
    case "earcareEmployeeId":
      return optionLabel(options.earcareEmployees, draft.earcareEmployeeId) ?? "-";
    case "status":
      return optionLabel(options.statuses, draft.status) ?? draft.status;
    case "discountTypeCode":
      return optionLabel(options.discountTypes, draft.discountTypeCode) ?? "-";
    case "paymentMethodCode":
      return optionLabel(options.paymentMethods, draft.paymentMethodCode) ?? "-";
    case "note":
      return draft.note ?? "-";
    case "visitRequest":
      return draft.visitRequest ?? "-";
    case "confirmationCode":
      return optionLabel(options.confirmationCodes, draft.confirmationCode) ?? "-";
  }
}

export type CallConflictFieldRow = {
  field: EditableCallField;
  label: string;
  mine: string;
  latest: string;
  differs: boolean;
};

/**
 * 비교 화면의 행 하나하나(스펙 B07, 티켓 17). 원장 필드 순서(EDITABLE_CALL_FIELDS) 그대로, 내 초안과
 * 최신 저장 행을 같은 라벨 로직(원장 칸이 쓰는 options·customers)으로 나란히 보인다. `differs`는 화면
 * 표시가 아니라 원래 값(코드·id)으로 가린다 — 두 표시 라벨이 우연히 같아 보이는 경우는 없다.
 */
export function callConflictFieldRows(
  mine: CallRowDraft,
  latest: CallRowDraft,
  options: ServiceCallFormOptions,
  customers: CustomerDto[],
  t: Translate
): CallConflictFieldRow[] {
  return EDITABLE_CALL_FIELDS.map((field) => ({
    field,
    label: t(FIELD_LABEL_KEY[field]),
    mine: fieldValue(field, mine, options, customers, t),
    latest: fieldValue(field, latest, options, customers, t),
    differs: (mine[field] ?? null) !== (latest[field] ?? null)
  }));
}

export type CallConflictCompareData = {
  rowId: string;
  /** 지금 이 화면의 초안(원장 행이 계속 고쳐지는 동안도 그대로 따라온다). */
  draft: CallRowDraft;
  /** STALE_CALL로 받은 최신 저장 행. 다시 반영·저장의 기준이 된다. */
  latestRow: ServiceCallRowDto;
  message: string | null;
  /** 고른 필드만 최신 행 위에 얹어 다시 저장한다(다시 버전 검사를 받는다). */
  onReapply: (changes: Partial<CallRowDraft>) => void;
  /** "최신 내용으로 다시 불러오기": 초안을 최신 행으로 바꾼다. */
  onReloadLatest: () => void;
};

type CallConflictRegistry = Record<string, CallConflictCompareData>;

const CallConflictWriterContext = createContext<{
  register: (compare: CallConflictCompareData) => void;
  unregister: (rowId: string) => void;
} | null>(null);

const CallConflictReaderContext = createContext<CallConflictRegistry>({});

/**
 * 원장 행(editable-call-grid.tsx)이 저장 충돌 상태(conflict)인 동안 자기 비교 데이터를 등록한다.
 * 콜 상세 패널은 같은 콜 id로 이 등록을 읽어 비교 화면을 그린다(useUnsavedGuard와 같은 등록 방식,
 * 티켓 18). conflict가 null이면(충돌이 아니면) 등록을 지운다.
 */
export function useRegisterCallConflict(compare: CallConflictCompareData | null) {
  const api = useContext(CallConflictWriterContext);
  useEffect(() => {
    if (!api || !compare) return;
    api.register(compare);
    return () => api.unregister(compare.rowId);
  }, [api, compare]);
}

/** 원장 화면을 감싼다(call-ledger-workspace.tsx). 등록된 비교 데이터를 콜 id로 읽을 수 있게 한다. */
export function CallConflictProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<CallConflictRegistry>({});

  const register = useCallback((compare: CallConflictCompareData) => {
    setRegistry((current) => (current[compare.rowId] === compare ? current : { ...current, [compare.rowId]: compare }));
  }, []);
  const unregister = useCallback((rowId: string) => {
    setRegistry((current) => {
      if (!(rowId in current)) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }, []);
  // register/unregister는 이미 안정적이지만(useCallback([])), 이 객체 리터럴은 렌더마다 새로 생겨
  // Context 소비자(useRegisterCallConflict)의 effect가 "api"가 바뀐 걸로 보고 매 렌더 다시 돌아
  // register를 또 부르고 → setRegistry → 다시 렌더 → ... 무한 루프가 났었다. useMemo로 참조를 고정한다.
  const api = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <CallConflictWriterContext.Provider value={api}>
      <CallConflictReaderContext.Provider value={registry}>{children}</CallConflictReaderContext.Provider>
    </CallConflictWriterContext.Provider>
  );
}

/** 지금 콜 상세 패널에 열린 콜의 비교 데이터. 그 콜이 충돌 상태가 아니면 null이다. */
export function useCallConflict(rowId: string | null): CallConflictCompareData | null {
  const registry = useContext(CallConflictReaderContext);
  if (!rowId) return null;
  return registry[rowId] ?? null;
}

const cellClassName = "border-b border-border px-3 py-2 align-top";

/**
 * 비교 표와 "다시 반영하고 저장"·"최신 내용으로 다시 불러오기" 버튼. CallConflictCompare(비모달 구역)의
 * 본문이고, 정적 렌더 테스트에서도 그대로 확인할 수 있다.
 */
export function CallConflictCompareFields({
  compare,
  customers,
  options
}: {
  compare: CallConflictCompareData;
  customers: CustomerDto[];
  options: ServiceCallFormOptions;
}) {
  const t = useT();
  const [chosen, setChosen] = useState<ReadonlySet<EditableCallField>>(new Set());
  const rows = callConflictFieldRows(compare.draft, draftFromRow(compare.latestRow), options, customers, t);

  function toggle(field: EditableCallField) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function reapply() {
    const changes: Partial<CallRowDraft> = {};
    for (const field of chosen) {
      (changes as Record<string, unknown>)[field] = compare.draft[field];
    }
    compare.onReapply(changes);
  }

  return (
    <div className="grid gap-4">
      {compare.message ? (
        <p className="text-sm text-warning" role="alert">
          {compare.message}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className={cellClassName} scope="col">
                {t("calls.conflict.columnField")}
              </th>
              <th className={cellClassName} scope="col">
                {t("calls.conflict.columnMine")}
              </th>
              <th className={cellClassName} scope="col">
                {t("calls.conflict.columnLatest")}
              </th>
              <th className={`${cellClassName} text-center`} scope="col">
                {t("calls.conflict.useMine")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.differs ? "bg-readonly [box-shadow:inset_3px_0_0_var(--warning)]" : undefined} key={row.field}>
                <th className={`${cellClassName} font-semibold text-foreground`} scope="row">
                  {row.label}
                </th>
                <td className={cellClassName}>{row.mine}</td>
                <td className={cellClassName}>{row.latest}</td>
                <td className={`${cellClassName} text-center`}>
                  {row.differs ? (
                    <label className="inline-flex min-h-11 items-center justify-center gap-2">
                      <span className="sr-only">{t("calls.conflict.useMineAria", { field: row.label })}</span>
                      <input
                        checked={chosen.has(row.field)}
                        className="h-5 w-5 accent-brand"
                        data-conflict-field={row.field}
                        onChange={() => toggle(row.field)}
                        type="checkbox"
                      />
                    </label>
                  ) : (
                    <span aria-hidden="true" className="text-muted">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={compare.onReloadLatest} type="button" variant="secondary">
          {t("calls.save.reloadLatest")}
        </Button>
        <Button disabled={chosen.size === 0} onClick={reapply} type="button">
          {t("calls.conflict.reapply")}
        </Button>
      </div>
    </div>
  );
}

/**
 * 저장 충돌 비교(스펙 B07, 스토리 39-43, 티켓 17, S2로 교정). 스펙 321줄 "저장 충돌 비교 | 콜 상세
 * 패널의 충돌 상태 | 패널"대로, 이미 비모달로 열려 있는 콜 상세 패널(SidePanel) 안의 한 구역일 뿐이다.
 * 포커스를 가두거나 배경을 비활성화하지 않는다(design.md 6.11: ModalPanel은 빠른 예약 같은 생성
 * 흐름에만 쓴다) — 그래서 이 구역이 열려 있는 동안에도 원장의 다른 행을 그대로 다룰 수 있다. 성공
 * (다시 반영/다시 불러오기)하면 이 콜이 더 이상 충돌 상태가 아니게 되어 부르는 쪽(CallDetailPanel)이
 * 이 구역을 치운다. 패널 전체를 닫는 것은 그 패널 자신의 닫기 버튼이 하므로 여기에는 없다.
 */
export function CallConflictCompare({
  compare,
  customers,
  options
}: {
  compare: CallConflictCompareData;
  customers: CustomerDto[];
  options: ServiceCallFormOptions;
}) {
  const t = useT();

  return (
    <PanelSection title={t("calls.conflict.title")}>
      <p className="text-sm text-muted">{t("calls.conflict.description")}</p>
      <CallConflictCompareFields compare={compare} customers={customers} options={options} />
    </PanelSection>
  );
}
