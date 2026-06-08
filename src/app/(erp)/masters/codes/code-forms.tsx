"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { CodeType } from "@/modules/masters/code-schema";
import type { CodeItemDto, TimeSlotDto } from "@/modules/masters/code-service";
import {
  createCodeItemAction,
  createTimeSlotAction,
  deactivateCodeItemAction,
  deactivateTimeSlotAction,
  updateCodeItemDisplayNameAction,
  updateCodeItemSortOrderAction,
  updateTimeSlotSortOrderAction,
  updateTimeSlotValueAction,
  type CodeActionState,
  type TimeSlotActionState
} from "@/app/(erp)/masters/codes/actions";

type CodeGroup = {
  codeType: CodeType;
  label: string;
  items: CodeItemDto[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function InlineError({ state, field }: { state: CodeActionState | TimeSlotActionState; field?: string }) {
  if (!state || state.ok) {
    return null;
  }

  const fieldMessages = field ? state.fieldErrors?.[field] : null;
  return (
    <span className="text-xs text-danger">
      {fieldMessages?.map((message) => <span key={message}>{message}</span>)}
      {state.formError ? <span>{state.formError}</span> : null}
    </span>
  );
}

function CodeCreateForm({ codeType }: { codeType: CodeType }) {
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(createCodeItemAction, null);

  return (
    <form action={formAction} className="grid gap-2 border-b border-border bg-readonly px-3 py-3 md:grid-cols-[120px_1fr_100px_auto]">
      <input name="codeType" type="hidden" value={codeType} />
      <label className="sr-only" htmlFor={`new-code-${codeType}`}>
        안정 코드
      </label>
      <input
        className="h-8 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
        id={`new-code-${codeType}`}
        name="code"
        placeholder="CUSTOM_CODE"
      />
      <label className="sr-only" htmlFor={`new-display-${codeType}`}>
        표시명
      </label>
      <input
        className="h-8 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
        id={`new-display-${codeType}`}
        name="displayName"
        placeholder="새 표시명"
      />
      <label className="sr-only" htmlFor={`new-sort-${codeType}`}>
        정렬 순서
      </label>
      <input
        className="h-8 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
        id={`new-sort-${codeType}`}
        min={1}
        name="sortOrder"
        placeholder="90"
        type="number"
      />
      <Button className="h-8 px-3 text-xs" disabled={pending} type="submit" variant="secondary">
        코드 추가
      </Button>
      <div className="md:col-span-4">
        <InlineError state={state} />
      </div>
    </form>
  );
}

function CodeDisplayNameForm({ item }: { item: CodeItemDto }) {
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(updateCodeItemDisplayNameAction, null);

  return (
    <form action={formAction} className="grid min-w-52 gap-1">
      <input name="codeItemId" type="hidden" value={item.id} />
      <label className="sr-only" htmlFor={`display-${item.id}`}>
        표시명
      </label>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-36 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
          defaultValue={item.displayName}
          id={`display-${item.id}`}
          maxLength={60}
          name="displayName"
          required
        />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          저장
        </Button>
      </div>
      <InlineError field="displayName" state={state} />
    </form>
  );
}

function CodeSortOrderForm({ item }: { item: CodeItemDto }) {
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(updateCodeItemSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-1">
      <input name="codeItemId" type="hidden" value={item.id} />
      <label className="sr-only" htmlFor={`sort-${item.id}`}>
        정렬 순서
      </label>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-20 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
          defaultValue={item.sortOrder}
          id={`sort-${item.id}`}
          max={9999}
          min={1}
          name="sortOrder"
          required
          type="number"
        />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          적용
        </Button>
      </div>
      <InlineError field="sortOrder" state={state} />
    </form>
  );
}

function CodeDeactivateForm({ item }: { item: CodeItemDto }) {
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(deactivateCodeItemAction, null);

  if (!item.isActive) {
    return <span className="text-xs text-muted">이미 비활성</span>;
  }

  return (
    <form action={formAction} className="grid gap-1">
      <input name="codeItemId" type="hidden" value={item.id} />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="ghost">
        비활성 처리
      </Button>
      <InlineError state={state} />
    </form>
  );
}

function CodeGroupSection({ group }: { group: CodeGroup }) {
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
        <span className="text-xs text-muted">{group.items.length}개 표시</span>
      </div>
      <CodeCreateForm codeType={group.codeType} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className="w-32 border-b border-border px-3 py-2">유형</th>
              <th className="w-40 border-b border-border px-3 py-2">안정 코드</th>
              <th className="w-56 border-b border-border px-3 py-2">표시명</th>
              <th className="w-40 border-b border-border px-3 py-2">정렬 순서</th>
              <th className="w-24 border-b border-border px-3 py-2">시스템 기본</th>
              <th className="w-24 border-b border-border px-3 py-2">활성 여부</th>
              <th className="w-40 border-b border-border px-3 py-2">생성 시각</th>
              <th className="w-40 border-b border-border px-3 py-2">수정 시각</th>
              <th className="border-b border-border px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((item) => (
              <tr className={item.isActive ? "align-top" : "bg-readonly align-top"} key={item.id}>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">{group.label}</td>
                <td className="border-b border-border px-3 py-2 font-mono text-xs text-foreground">{item.code}</td>
                <td className="border-b border-border px-3 py-2">
                  <CodeDisplayNameForm item={item} />
                  <div className="mt-1 text-xs text-muted">고유 ID: {item.id}</div>
                </td>
                <td className="border-b border-border px-3 py-2">
                  <CodeSortOrderForm item={item} />
                </td>
                <td className="border-b border-border px-3 py-2">{item.isSystemDefault ? "예" : "아니오"}</td>
                <td className="border-b border-border px-3 py-2">{item.isActive ? "활성" : "비활성"}</td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(item.createdAt)}</td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(item.updatedAt)}</td>
                <td className="border-b border-border px-3 py-2">
                  <CodeDeactivateForm item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TimeSlotCreateForm() {
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(createTimeSlotAction, null);

  return (
    <form action={formAction} className="grid gap-2 border-b border-border bg-readonly px-3 py-3 md:grid-cols-[120px_100px_auto]">
      <label className="sr-only" htmlFor="new-time-slot-value">
        시간 슬롯
      </label>
      <input
        className="h-8 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
        id="new-time-slot-value"
        name="value"
        placeholder="10:00"
      />
      <label className="sr-only" htmlFor="new-time-slot-sort">
        정렬 순서
      </label>
      <input
        className="h-8 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
        id="new-time-slot-sort"
        min={1}
        name="sortOrder"
        placeholder="5"
        type="number"
      />
      <Button className="h-8 px-3 text-xs" disabled={pending} type="submit" variant="secondary">
        슬롯 추가
      </Button>
      <div className="md:col-span-3">
        <InlineError state={state} />
      </div>
    </form>
  );
}

function TimeSlotValueForm({ slot }: { slot: TimeSlotDto }) {
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(updateTimeSlotValueAction, null);

  return (
    <form action={formAction} className="grid gap-1">
      <input name="timeSlotId" type="hidden" value={slot.id} />
      <label className="sr-only" htmlFor={`slot-value-${slot.id}`}>
        시간 슬롯
      </label>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-24 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
          defaultValue={slot.value}
          id={`slot-value-${slot.id}`}
          name="value"
          required
        />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          저장
        </Button>
      </div>
      <InlineError field="value" state={state} />
    </form>
  );
}

function TimeSlotSortOrderForm({ slot }: { slot: TimeSlotDto }) {
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(updateTimeSlotSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-1">
      <input name="timeSlotId" type="hidden" value={slot.id} />
      <label className="sr-only" htmlFor={`slot-sort-${slot.id}`}>
        정렬 순서
      </label>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-20 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
          defaultValue={slot.sortOrder}
          id={`slot-sort-${slot.id}`}
          max={9999}
          min={1}
          name="sortOrder"
          required
          type="number"
        />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          적용
        </Button>
      </div>
      <InlineError field="sortOrder" state={state} />
    </form>
  );
}

function TimeSlotDeactivateForm({ slot }: { slot: TimeSlotDto }) {
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(deactivateTimeSlotAction, null);

  if (!slot.isActive) {
    return <span className="text-xs text-muted">이미 비활성</span>;
  }

  return (
    <form action={formAction} className="grid gap-1">
      <input name="timeSlotId" type="hidden" value={slot.id} />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="ghost">
        비활성 처리
      </Button>
      <InlineError state={state} />
    </form>
  );
}

function TimeSlotSection({ timeSlots }: { timeSlots: TimeSlotDto[] }) {
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">시간 슬롯</h2>
        <span className="text-xs text-muted">{timeSlots.length}개 표시</span>
      </div>
      <TimeSlotCreateForm />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className="w-48 border-b border-border px-3 py-2">시간 슬롯</th>
              <th className="w-40 border-b border-border px-3 py-2">정렬 순서</th>
              <th className="w-24 border-b border-border px-3 py-2">활성 여부</th>
              <th className="w-40 border-b border-border px-3 py-2">생성 시각</th>
              <th className="w-40 border-b border-border px-3 py-2">수정 시각</th>
              <th className="border-b border-border px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot) => (
              <tr className={slot.isActive ? "align-top" : "bg-readonly align-top"} key={slot.id}>
                <td className="border-b border-border px-3 py-2">
                  <TimeSlotValueForm slot={slot} />
                  <div className="mt-1 text-xs text-muted">고유 ID: {slot.id}</div>
                </td>
                <td className="border-b border-border px-3 py-2">
                  <TimeSlotSortOrderForm slot={slot} />
                </td>
                <td className="border-b border-border px-3 py-2">{slot.isActive ? "활성" : "비활성"}</td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(slot.createdAt)}</td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(slot.updatedAt)}</td>
                <td className="border-b border-border px-3 py-2">
                  <TimeSlotDeactivateForm slot={slot} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CodeManager({ codeGroups, timeSlots }: { codeGroups: CodeGroup[]; timeSlots: TimeSlotDto[] }) {
  return (
    <div className="grid gap-5">
      {codeGroups.map((group) => (
        <CodeGroupSection group={group} key={group.codeType} />
      ))}
      <TimeSlotSection timeSlots={timeSlots} />
    </div>
  );
}
