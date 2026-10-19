"use client";

import { useActionState, useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { StatusIndicator } from "@/components/ui/status-indicator";
import {
  issueTherapistAccountAction,
  resetTherapistAccountPasswordAction,
  suspendTherapistAccountAction,
  unlockTherapistAccountAction,
  type TherapistAccountNoticeActionState,
  type TherapistAccountNoticeDto,
  type TherapistAccountStatusActionState
} from "@/app/(erp)/masters/employees/therapist-account-actions";
import { SaveRow, TextField } from "@/app/(erp)/masters/master-fields";
import { PanelSection } from "@/app/(erp)/masters/master-parts";
import type { EmployeeDto } from "@/modules/masters/employee-service";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/i18n/format";

/**
 * Therapist 패널의 전용 발급·초기화·정지·잠금 해제 UI(티켓 02). employee-forms.tsx의 linkedAccount
 * 자리를 THERAPIST 구분 직원일 때만 이 컴포넌트로 바꾼다(D26 — 역할 선택 칸이 있는 기존 AccountLinkForm을
 * Therapist에게는 보이지 않는다). 내부 메모(티켓 12)는 이 파일을 건드리지 않고 details 앞에 자기
 * PanelSection을 끼워 넣는다.
 */

function formatFullDateTime(locale: Locale, value: string) {
  return formatDateTime(locale, value, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function TherapistAccountQrCode({ value, label }: { value: string; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const markup = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  // eslint-disable-next-line react/no-danger -- qrcode-generator가 만든 정적 SVG 마크업(신뢰 입력: 배포 주소)이다.
  return <div aria-label={label} className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: markup }} role="img" />;
}

/** 발급·초기화 직후 뜨는 인쇄용 안내 쪽지. print:hidden 밖(이 섹션 자체)만 인쇄되고 나머지 패널은 숨긴다. */
function TherapistAccountNoticeView({ notice, onClose }: { notice: TherapistAccountNoticeDto; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  // 출력 시각: beforeprint에서 그 순간의 시각으로 갱신한다(월 명세서 인쇄와 같은 모양).
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    function handleBeforePrint() {
      setPrintedAt(new Date().toISOString());
    }
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Button onClick={() => window.print()} type="button">
          {t("masters.employees.therapist.notice.print")}
        </Button>
        <Button onClick={onClose} type="button" variant="secondary">
          {t("masters.employees.therapist.notice.close")}
        </Button>
      </div>
      <section
        aria-label={t("masters.employees.therapist.notice.title")}
        className="grid gap-4 rounded-lg border border-border bg-surface p-4 print:border-0 print:p-0"
      >
        <h3 className="text-base font-semibold text-foreground">{t("masters.employees.therapist.notice.title")}</h3>
        <p className="text-sm text-muted">{t("masters.employees.therapist.notice.intro")}</p>
        <TherapistAccountQrCode label={t("masters.employees.therapist.notice.qrAlt")} value={notice.loginUrl} />
        <dl>
          <DetailRow label={t("masters.employees.therapist.notice.accountIdLabel")} value={notice.accountId} />
          <DetailRow label={t("masters.employees.therapist.notice.loginUrlLabel")} value={notice.loginUrl} />
        </dl>
        <div className="grid gap-1 rounded-md bg-warning-soft px-3 py-3">
          <p className="text-xs font-semibold text-warning">{t("masters.employees.therapist.notice.temporaryPasswordLabel")}</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{notice.temporaryPassword}</p>
          <p className="text-xs text-warning">{t("masters.employees.therapist.notice.temporaryPasswordOnce")}</p>
        </div>
        <div className="grid gap-1 border-t border-border pt-3 text-xs text-muted">
          <p>{t("masters.employees.therapist.notice.printedAt", { timestamp: formatFullDateTime(locale, printedAt) })}</p>
          <p>{t("masters.employees.therapist.notice.disclaimer")}</p>
        </div>
      </section>
    </div>
  );
}

function IssueForm({ employee, onIssued }: { employee: EmployeeDto; onIssued: (notice: TherapistAccountNoticeDto) => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistAccountNoticeActionState, FormData>(async (previous, formData) => {
    const result = await issueTherapistAccountAction(previous, formData);
    if (result?.ok) onIssued(result.data);
    return result;
  }, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="employeeId" type="hidden" value={employee.id} />
      <p className="text-sm text-muted">{t("masters.employees.therapist.notLinkedNote")}</p>
      <TextField
        hint={t("masters.employees.therapist.accountIdHint", { staffCode: employee.staffCode })}
        label={t("masters.employees.therapist.accountIdField")}
        name="accountId"
        placeholder={employee.staffCode}
        state={state}
      />
      <SaveRow label={t("masters.employees.therapist.issue")} pending={pending} primary state={state} />
      <p className="text-xs text-muted">{t("masters.employees.therapist.issueDescription")}</p>
    </form>
  );
}

function ResetForm({ employee, onReset }: { employee: EmployeeDto; onReset: (notice: TherapistAccountNoticeDto) => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistAccountNoticeActionState, FormData>(async (previous, formData) => {
    const result = await resetTherapistAccountPasswordAction(previous, formData);
    if (result?.ok) onReset(result.data);
    return result;
  }, null);

  return (
    <form action={formAction} className="grid gap-2">
      <input name="userAccountId" type="hidden" value={employee.account?.id ?? ""} />
      <p className="text-xs text-muted">{t("masters.employees.therapist.resetDescription")}</p>
      <SaveRow label={t("masters.employees.therapist.reset")} pending={pending} state={state} />
    </form>
  );
}

function SuspendForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistAccountStatusActionState, FormData>(suspendTherapistAccountAction, null);

  return (
    <form action={formAction} className="grid gap-2">
      <input name="userAccountId" type="hidden" value={employee.account?.id ?? ""} />
      <p className="text-xs text-muted">{t("masters.employees.therapist.suspendDescription")}</p>
      <SaveRow label={t("masters.employees.therapist.suspend")} pending={pending} state={state} />
    </form>
  );
}

function UnlockForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistAccountStatusActionState, FormData>(unlockTherapistAccountAction, null);

  return (
    <form action={formAction} className="grid gap-2">
      <input name="userAccountId" type="hidden" value={employee.account?.id ?? ""} />
      <SaveRow label={t("masters.employees.therapist.unlock")} pending={pending} state={state} />
    </form>
  );
}

export function TherapistAccountPanel({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const locale = useLocale();
  const [notice, setNotice] = useState<TherapistAccountNoticeDto | null>(null);

  // 안내 쪽지는 패널의 다른 내용(프로필, 비활성 처리 등)과 겹치지 않는 자리에 그 자체로 뜬다 — 인쇄할 때
  // PanelSection 제목이나 다른 섹션이 같이 찍히지 않도록, 쪽지일 때는 그 섹션만 그대로 돌려준다.
  if (notice) {
    return <TherapistAccountNoticeView notice={notice} onClose={() => setNotice(null)} />;
  }

  const account = employee.account;
  const isLocked = Boolean(account?.lockedUntil && new Date(account.lockedUntil) > new Date());

  return (
    <PanelSection title={t("masters.employees.therapist.panelTitle")}>
      <div className="grid gap-3 print:hidden">
        {!account ? (
          <IssueForm employee={employee} onIssued={setNotice} />
        ) : (
          <>
            <DetailRow label={t("masters.employees.therapist.accountIdLabel")} value={account.accountId} />
            <div className="flex flex-wrap items-center gap-2">
              <StatusIndicator
                label={account.isActive ? t("masters.employees.therapist.status.active") : t("masters.employees.therapist.status.suspended")}
                tone={account.isActive ? "success" : "neutral"}
              />
              {account.passwordChangeRequired ? (
                <StatusIndicator label={t("masters.employees.therapist.passwordChangeRequired")} tone="warning" />
              ) : null}
              {isLocked ? (
                <StatusIndicator label={t("masters.employees.therapist.lockedUntil", { timestamp: formatFullDateTime(locale, account.lockedUntil as string) })} tone="danger" />
              ) : null}
            </div>
            <ResetForm employee={employee} onReset={setNotice} />
            {isLocked ? <UnlockForm employee={employee} /> : null}
            {account.isActive ? (
              <SuspendForm employee={employee} />
            ) : (
              <p className="text-sm text-muted">{t("masters.employees.therapist.alreadySuspended")}</p>
            )}
          </>
        )}
      </div>
    </PanelSection>
  );
}
