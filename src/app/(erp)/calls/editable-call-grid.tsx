"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { saveBasicServiceCallRowAction, type ServiceCallActionState } from "@/app/(erp)/calls/actions";

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

  return <span className="text-xs text-danger">{message}</span>;
}

function SelectCell({
  disabled,
  label,
  name,
  options,
  required,
  value
}: {
  disabled: boolean;
  label: string;
  name: string;
  options: ServiceCallOption[];
  required?: boolean;
  value?: string;
}) {
  return (
    <label className="grid min-w-28 gap-1">
      <span className="sr-only">{label}</span>
      <select
        className="h-8 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
        defaultValue={value ?? ""}
        disabled={disabled}
        name={name}
        required={required}
      >
        <option value="">{required ? "선택" : "-"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextCell({
  disabled,
  label,
  maxLength,
  name,
  placeholder
}: {
  disabled: boolean;
  label: string;
  maxLength?: number;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="grid min-w-36 gap-1">
      <span className="sr-only">{label}</span>
      <input
        className="h-8 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
        disabled={disabled}
        maxLength={maxLength ?? 500}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function labelFor(options: ServiceCallOption[], value: string | null) {
  if (!value) {
    return "-";
  }
  return options.find((option) => option.value === value)?.label ?? value;
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
                <SelectCell disabled={disabled} label="마사지사2" name="therapist2Id" options={options.therapists} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="귀케어 담당" name="earcareEmployeeId" options={options.earcareEmployees} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell disabled={disabled} label="상태" name="status" options={options.statuses} required value="예약" />
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
          <table className="w-full min-w-[1540px] border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-muted">
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
                  "계산 필드"
                ].map((header) => (
                  <th className="border-b border-border px-2 py-2" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="align-top" key={row.id}>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.serviceDate}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.startTime}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.roomLabel}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.courseLabel}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.customerMemo || "-"}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.therapist1?.displayName ?? "-"}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.therapist2?.displayName ?? "-"}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.earcare?.displayName ?? "-"}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{labelFor(options.statuses, row.status)}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{labelFor(options.discountTypes, row.discountTypeCode)}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{labelFor(options.paymentMethods, row.paymentMethodCode)}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{row.note || "-"}</td>
                  <td className="border-b border-border px-2 py-2 text-xs">{labelFor(options.confirmationCodes, row.confirmationCode)}</td>
                  <td className="border-b border-border px-2 py-2 text-xs text-muted">결제/수당/콜인정 -</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddRowForm isLocked={isLocked} operatingMonthId={operatingMonthId} options={options} serviceDate={serviceDate} />
    </section>
  );
}
