"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ListboxSelect } from "@/components/ui/listbox-select";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * 기준정보 패널·서랍의 입력칸(design.md 6.4). 라벨은 칸 위에 두고, 오류는 칸 아래 문장을 aria-describedby로 잇는다.
 */

type FormState = ActionResult<unknown> | null;

function fieldErrors(state: FormState, name: string) {
  return state && !state.ok ? (state.fieldErrors?.[name] ?? []) : [];
}

// 라벨에는 라벨 글자만 둔다. 안내와 오류는 aria-describedby로 이어 칸의 이름이 길어지지 않게 한다.
function FieldFrame({
  label,
  inputId,
  hint,
  hintId,
  errors,
  errorId,
  children
}: {
  label: string;
  inputId: string;
  hint?: ReactNode;
  hintId: string;
  errors: string[];
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-semibold text-foreground" htmlFor={inputId}>
        {label}
      </label>
      {children}
      {hint ? (
        <span className="text-xs text-muted" id={hintId}>
          {hint}
        </span>
      ) : null}
      {errors.length > 0 ? (
        <span className="text-sm text-danger" id={errorId}>
          {errors.join(" ")}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(hint: ReactNode, hintId: string, errors: string[], errorId: string) {
  const ids = [hint ? hintId : null, errors.length > 0 ? errorId : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function TextField({
  label,
  name,
  state,
  hint,
  className,
  id,
  ...inputProps
}: { label: string; name: string; state: FormState; hint?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "name">) {
  const autoId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputId = id ?? autoId;
  const errors = fieldErrors(state, name);
  return (
    <FieldFrame errorId={errorId} errors={errors} hint={hint} hintId={hintId} inputId={inputId} label={label}>
      <input
        id={inputId}
        aria-describedby={describedBy(hint, hintId, errors, errorId)}
        aria-invalid={errors.length > 0 ? true : undefined}
        className={inputFieldClassName({ invalid: errors.length > 0, className: cn("w-full", className) })}
        name={name}
        {...inputProps}
      />
    </FieldFrame>
  );
}

export function SelectField({
  label,
  name,
  state,
  hint,
  className,
  options,
  id,
  defaultValue,
  disabled,
  required
}: {
  label: string;
  name: string;
  state: FormState;
  hint?: ReactNode;
  className?: string;
  options: Array<{ value: string; label: string }>;
  id?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const autoId = useId();
  const hintId = useId();
  const errorId = useId();
  const selectId = id ?? autoId;
  const errors = fieldErrors(state, name);
  return (
    <FieldFrame errorId={errorId} errors={errors} hint={hint} hintId={hintId} inputId={selectId} label={label}>
      <ListboxSelect
        ariaDescribedBy={describedBy(hint, hintId, errors, errorId)}
        className={cn("w-full", className)}
        defaultValue={defaultValue}
        disabled={disabled}
        id={selectId}
        invalid={errors.length > 0}
        name={name}
        options={options}
        required={required}
      />
    </FieldFrame>
  );
}

/** 폼 전체의 결과: 저장 거절 이유(오류) 또는 저장됨 안내. 필드 오류는 각 칸 아래에 있다. */
export function FormResult({ state, savedMessage }: { state: FormState; savedMessage?: string }) {
  if (!state) return null;
  if (state.ok) {
    const message = state.notice ?? savedMessage;
    return message ? (
      <span className="text-sm font-semibold text-success" role="status">
        {message}
      </span>
    ) : null;
  }
  return state.formError ? (
    <span className="text-sm text-danger" role="alert">
      {state.formError}
    </span>
  ) : null;
}

/** 폼 끝의 제출 버튼과 결과 한 줄. 생성 서랍의 제출만 주 버튼(검정)이고, 패널 안 저장은 보조 버튼이다. */
export function SaveRow({
  pending,
  label,
  state,
  savedMessage,
  primary
}: {
  pending: boolean;
  label: string;
  state: FormState;
  savedMessage?: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={pending} type="submit" variant={primary ? "default" : "secondary"}>
        {label}
      </Button>
      <FormResult savedMessage={savedMessage} state={state} />
    </div>
  );
}
