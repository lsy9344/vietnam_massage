"use client";

import { useActionState, useState, useTransition, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import type { ServiceCallAutosaveInput } from "@/modules/calls/service-call-schema";
import { autosaveServiceCallRowAction, saveBasicServiceCallRowAction, type ServiceCallActionState } from "@/app/(erp)/calls/actions";

type RowSaveState = "idle" | "saving" | "saved" | "error";
type FieldErrors = Record<string, string[]>;

function fieldError(state: ServiceCallActionState, field: string) {
  if (!state || state.ok) {
    return null;
  }
  return state.fieldErrors?.[field]?.[0] ?? null;
}

function InlineError({ state, field }: { state: ServiceCallActionState; field?: string }) {
  if (!state || state.ok) {
    return null;
  }

  const message = field ? fieldError(state, field) : state.formError;
  if (!message) {
    return null;
  }

  return (
    <span className="text-xs text-danger" role="alert">
      {message}
    </span>
  );
}

function FieldErrorMessage({ id, message }: { id: string; message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <span className="flex items-start gap-1 text-xs font-medium text-danger" id={id} role="alert">
      <span aria-hidden="true" className="font-bold">
        !
      </span>
      <span>{message}</span>
    </span>
  );
}

function SelectCell({
  disabled,
  defaultValue,
  label,
  name,
  onBlur,
  onChange,
  options,
  required,
  value,
  errorId,
  errorMessage
}: {
  disabled: boolean;
  defaultValue?: string;
  errorId?: string;
  errorMessage?: string | null;
  label: string;
  name: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  options: ServiceCallOption[];
  required?: boolean;
  value?: string;
}) {
  const invalid = Boolean(errorMessage);
  return (
    <label className="grid min-w-28 gap-1">
      <span className="sr-only">{label}</span>
      <select
        aria-describedby={invalid && errorId ? errorId : undefined}
        aria-invalid={invalid ? "true" : undefined}
        className={`h-8 border bg-background px-2 text-xs text-foreground outline-none disabled:bg-readonly ${
          invalid ? "border-danger ring-1 ring-danger focus:border-danger" : "border-border focus:border-brand"
        }`}
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onChange?.(event.target.value)}
        required={required}
        {...(value === undefined ? { defaultValue: defaultValue ?? "" } : { value })}
      >
        <option value="">{required ? "선택" : "-"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errorId ? <FieldErrorMessage id={errorId} message={errorMessage ?? null} /> : null}
    </label>
  );
}

function TextCell({
  disabled,
  label,
  maxLength,
  name,
  onBlur,
  onChange,
  onKeyDown,
  placeholder,
  value
}: {
  disabled: boolean;
  label: string;
  maxLength?: number;
  name: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  value?: string;
}) {
  return (
    <label className="grid min-w-36 gap-1">
      <span className="sr-only">{label}</span>
      <input
        className="h-8 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
        disabled={disabled}
        maxLength={maxLength ?? 500}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        {...(value === undefined ? {} : { value })}
      />
    </label>
  );
}

function AddRowForm({
  isLocked,
  operatingMonthId,
  options,
  serviceDate
}: {
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  serviceDate: string;
}) {
  const [state, formAction, pending] = useActionState<ServiceCallActionState, FormData>(saveBasicServiceCallRowAction, null);
  const disabled = isLocked || pending;

  return (
    <form action={formAction} className="border-t border-border bg-surface">
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="serviceDate" type="hidden" value={serviceDate} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1540px] border-collapse text-left text-sm">
          <tbody>
            <tr className="align-top">
              <td className="border-b border-border px-2 py-2 text-xs text-muted">{serviceDate}</td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="시간" name="startTime" options={options.timeSlots} required />
                <InlineError field="startTime" state={state} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="객실" name="roomId" options={options.rooms} required />
                <InlineError field="roomId" state={state} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="코스" name="courseId" options={options.courses} required />
                <InlineError field="courseId" state={state} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <TextCell disabled={disabled} label="고객/메모" name="customerMemo" placeholder="고객/메모" />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="마사지사1" name="therapist1Id" options={options.therapists} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  disabled={disabled}
                  errorId="add-call-therapist2-error"
                  errorMessage={fieldError(state, "therapist2Id")}
                  label="마사지사2"
                  name="therapist2Id"
                  options={options.therapists}
                />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="귀케어 담당" name="earcareEmployeeId" options={options.earcareEmployees} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} defaultValue="예약" label="상태" name="status" options={options.statuses} required />
                <InlineError field="status" state={state} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="할인구분" name="discountTypeCode" options={options.discountTypes} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="결제수단" name="paymentMethodCode" options={options.paymentMethods} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <TextCell disabled={disabled} label="비고" name="note" placeholder="비고" />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="확인값" name="confirmationCode" options={options.confirmationCodes} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <Button className="h-8 whitespace-nowrap px-2 text-xs" disabled={disabled} type="submit">
                  새 콜 행 추가
                </Button>
                <InlineError state={state} />
                {state?.ok ? <span className="block text-xs text-muted">저장됨</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}

function draftFromRow(row: ServiceCallRowDto): ServiceCallAutosaveInput {
  return {
    serviceCallId: row.id,
    operatingMonthId: row.operatingMonthId,
    serviceDate: row.serviceDate,
    startTime: row.startTime,
    roomId: row.roomId,
    courseId: row.courseId,
    customerMemo: row.customerMemo ?? null,
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

function nullableValue(value: string) {
  return value.trim() === "" ? null : value;
}

function saveStateLabel(state: RowSaveState) {
  if (state === "saving") return "저장중";
  if (state === "saved") return "저장됨";
  if (state === "error") return "저장 보류";
  return "idle";
}

function saveStateClassName(state: RowSaveState) {
  if (state === "saving") return "text-brand";
  if (state === "saved") return "text-muted";
  if (state === "error") return "text-danger";
  return "text-muted";
}

function firstFieldError(fieldErrors: FieldErrors, field: string) {
  return fieldErrors[field]?.[0] ?? null;
}

function formatVnd(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function ComputedCell({ label, row, saveStatus, value }: { label: string; row: ServiceCallRowDto; saveStatus: RowSaveState; value: number }) {
  const isStaleFailedDraft = saveStatus === "error";
  const displayValue = row.calculationStatus === "calculated" && !isStaleFailedDraft ? formatVnd(value) : "—";
  return (
    <td className="border-b border-border bg-readonly px-2 py-2 text-right text-xs font-medium text-foreground [font-variant-numeric:tabular-nums]">
      <span className="sr-only">{label}</span>
      <span title={isStaleFailedDraft ? "저장 보류 중인 draft는 재계산값으로 표시하지 않습니다." : row.calculationErrorMessage ?? undefined}>
        {displayValue}
      </span>
    </td>
  );
}

function EditableCallRow({
  isLocked,
  options,
  row
}: {
  isLocked: boolean;
  options: ServiceCallFormOptions;
  row: ServiceCallRowDto;
}) {
  const [draft, setDraft] = useState<ServiceCallAutosaveInput>(() => draftFromRow(row));
  const [serverRow, setServerRow] = useState<ServiceCallRowDto>(row);
  const [saveStatus, setSaveStatus] = useState<RowSaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAt, setSavedAt] = useState(row.savedAt);
  const [, startTransition] = useTransition();

  function updateDraft<Key extends keyof ServiceCallAutosaveInput>(key: Key, value: ServiceCallAutosaveInput[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function commit(nextDraft = draft) {
    if (isLocked || saveStatus === "saving") {
      return;
    }

    setSaveStatus("saving");
    setErrorMessage(null);
    setFieldErrors({});
    startTransition(() => {
      void (async () => {
        const result = await autosaveServiceCallRowAction(nextDraft);
        if (result.ok) {
          setDraft(draftFromRow(result.data));
          setServerRow(result.data);
          setSavedAt(result.data.savedAt);
          setSaveStatus("saved");
          setFieldErrors({});
          return;
        }

        setErrorMessage(result.formError ?? "콜 행 자동저장에 실패했습니다.");
        setFieldErrors(result.fieldErrors ?? {});
        setSaveStatus("error");
      })();
    });
  }

  function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <tr className="align-top" data-service-call-id={row.id}>
      <td className="border-b border-border px-2 py-2 text-xs">
        {draft.serviceDate}
        <input name="serviceCallId" type="hidden" value={draft.serviceCallId} />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="시간"
          name="startTime"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("startTime", value)}
          options={options.timeSlots}
          required
          value={draft.startTime}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="객실"
          name="roomId"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("roomId", value)}
          options={options.rooms}
          required
          value={draft.roomId}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="코스"
          name="courseId"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("courseId", value)}
          options={options.courses}
          required
          value={draft.courseId}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <TextCell
          disabled={isLocked || saveStatus === "saving"}
          label="고객/메모"
          name="customerMemo"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("customerMemo", nullableValue(value))}
          onKeyDown={commitOnEnter}
          placeholder="고객/메모"
          value={draft.customerMemo ?? ""}
        />
        <span className="sr-only">{draft.customerMemo ?? ""}</span>
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="마사지사1"
          name="therapist1Id"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("therapist1Id", nullableValue(value))}
          options={options.therapists}
          value={draft.therapist1Id ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          errorId={`call-${row.id}-therapist2-error`}
          errorMessage={firstFieldError(fieldErrors, "therapist2Id")}
          label="마사지사2"
          name="therapist2Id"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("therapist2Id", nullableValue(value))}
          options={options.therapists}
          value={draft.therapist2Id ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="귀케어 담당"
          name="earcareEmployeeId"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("earcareEmployeeId", nullableValue(value))}
          options={options.earcareEmployees}
          value={draft.earcareEmployeeId ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="상태"
          name="status"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("status", value)}
          options={options.statuses}
          required
          value={draft.status}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="할인구분"
          name="discountTypeCode"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("discountTypeCode", nullableValue(value))}
          options={options.discountTypes}
          value={draft.discountTypeCode ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="결제수단"
          name="paymentMethodCode"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("paymentMethodCode", nullableValue(value))}
          options={options.paymentMethods}
          value={draft.paymentMethodCode ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <TextCell
          disabled={isLocked || saveStatus === "saving"}
          label="비고"
          name="note"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("note", nullableValue(value))}
          onKeyDown={commitOnEnter}
          placeholder="비고"
          value={draft.note ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          disabled={isLocked || saveStatus === "saving"}
          label="확인값"
          name="confirmationCode"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("confirmationCode", nullableValue(value))}
          options={options.confirmationCodes}
          value={draft.confirmationCode ?? ""}
        />
      </td>
      <ComputedCell label="결제금액" row={serverRow} saveStatus={saveStatus} value={serverRow.paymentAmount} />
      <ComputedCell label="할인" row={serverRow} saveStatus={saveStatus} value={serverRow.discountAmount} />
      <ComputedCell label="마사지사1수당" row={serverRow} saveStatus={saveStatus} value={serverRow.therapist1Commission} />
      <ComputedCell label="마사지사2수당" row={serverRow} saveStatus={saveStatus} value={serverRow.therapist2Commission} />
      <ComputedCell label="귀케어풀" row={serverRow} saveStatus={saveStatus} value={serverRow.earcarePoolAmount} />
      <ComputedCell label="콜인정" row={serverRow} saveStatus={saveStatus} value={serverRow.opsCallCredit} />
      <td className="border-b border-border bg-readonly px-2 py-2 text-xs text-foreground">
        <div className="grid min-w-40 gap-1">
          {saveStatus === "error" ? <span className="text-danger">저장 보류 계산 대기</span> : null}
          {serverRow.calculationStatus === "calculated" && saveStatus !== "error" ? <span>계산됨</span> : null}
          {serverRow.calculationStatus === "not_completed" && saveStatus !== "error" ? <span>비완료 제외</span> : null}
          {(serverRow.calculationStatus === "course_policy_missing" ||
            serverRow.calculationStatus === "therapist_rate_missing" ||
            serverRow.calculationStatus === "second_therapist_required") &&
          saveStatus !== "error" ? (
            <span className="text-danger">{serverRow.calculationErrorMessage ?? "정책 없음"}</span>
          ) : null}
          <span aria-live="polite" className={saveStateClassName(saveStatus)}>
            {saveStateLabel(saveStatus)}
            {saveStatus === "saved" ? ` ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          {saveStatus === "error" ? (
            <span className="grid gap-1">
              <span className="text-danger">{errorMessage ?? "저장 보류"}</span>
              <Button className="h-7 justify-self-start px-2 text-xs" onClick={() => commit()} type="button" variant="secondary">
                재시도
              </Button>
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function EditableCallGrid({
  isLocked,
  operatingMonthId,
  options,
  rows,
  serviceDate
}: {
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  serviceDate: string;
}) {
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">콜 원장 그리드</h2>
          {isLocked ? <p className="mt-1 text-xs text-danger">잠긴 운영월입니다. 새 콜 행 추가와 수정이 차단됩니다.</p> : null}
        </div>
        <span className="text-xs text-muted">{rows.length}개 행</span>
      </div>

      {rows.length === 0 ? (
        <div className="grid gap-3 px-4 py-8">
          <div>
            <p className="text-sm font-medium text-foreground">이 날짜의 콜이 없습니다</p>
            <p className="mt-1 text-xs text-muted">아래 입력 행에서 원본 실시간콜입력 A:S 의미의 기본 필드를 기록한다.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2140px] border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-foreground">
              <tr>
                {[
                  "날짜",
                  "시간",
                  "객실",
                  "코스",
                  "고객/메모",
                  "마사지사1",
                  "마사지사2",
                  "귀케어 담당",
                  "예약상태",
                  "할인구분",
                  "결제수단",
                  "비고",
                  "확인값",
                  "결제금액",
                  "할인",
                  "마사지사1수당",
                  "마사지사2수당",
                  "귀케어풀",
                  "콜인정",
                  "저장상태"
                ].map((header) => (
                  <th className="border-b border-border px-2 py-2" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <EditableCallRow isLocked={isLocked} key={row.id} options={options} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddRowForm isLocked={isLocked} operatingMonthId={operatingMonthId} options={options} serviceDate={serviceDate} />
    </section>
  );
}
