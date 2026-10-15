"use client";

import { DetailRow } from "@/components/ui/detail-row";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import {
  confirmTherapistDailySettlementPayoutAction,
  reconfirmTherapistDailySettlementPayoutAction,
  releaseTherapistDailySettlementPayoutAction
} from "@/app/(erp)/settlements/actions";
import { EmployeeWorkspace, type ComparisonColumn } from "@/app/(erp)/settlements/employee-workspace";
import { ConfirmPayoutButton, ReasonPayoutForm } from "@/app/(erp)/settlements/payout-confirmation-form";
import { AmountText, EvidenceCallItem, EvidenceCallList, PanelSection, StatementLink, vnd } from "@/app/(erp)/settlements/settlement-parts";
import {
  monthlyStatementHref,
  therapistCourseAmount,
  therapistEvidenceAmount,
  therapistSettlementAmount,
  type SettlementCourseCode,
  type TherapistComparisonRow
} from "@/app/(erp)/settlements/settlement-view-model";
import { AttendanceRecognition, TherapistAttendanceForm } from "@/app/(erp)/settlements/therapist-attendance-form";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { TherapistDailySettlementDto } from "@/modules/settlements/therapist-daily-settlement-service";
import type { PayoutConfirmationDto, PayoutConfirmationEventDto } from "@/modules/settlements/payout-confirmation-service";

const courseCodes: SettlementCourseCode[] = ["A", "B", "C", "D", "E"];

const rateStatus: Record<TherapistDailySettlementDto["assignmentEvidence"][number]["rateStatus"], { key: MessageKey; tone: StatusTone }> = {
  applied: { key: "settlements.therapist.rateStatus.applied", tone: "success" },
  zero_policy: { key: "settlements.therapist.rateStatus.zeroPolicy", tone: "neutral" },
  missing_policy: { key: "settlements.therapist.rateStatus.missingPolicy", tone: "warning" }
};

const roleKey = {
  THERAPIST_1: "settlements.therapist.role.therapist1",
  THERAPIST_2: "settlements.therapist.role.therapist2"
} as const;

/** 지급 확인 네 상태(미확인/확인됨/지급 재확인 필요/확인 금액 미기록)의 문구와 톤. 송금이 아니라 확인 사실만 보인다. */
const payoutStatusKey: Record<PayoutConfirmationDto["status"], { key: MessageKey; tone: StatusTone }> = {
  unconfirmed: { key: "settlements.payout.status.unconfirmed", tone: "neutral" },
  confirmed: { key: "settlements.payout.status.confirmed", tone: "success" },
  needs_reconfirmation: { key: "settlements.payout.status.needsReconfirmation", tone: "warning" },
  confirmed_amount_unrecorded: { key: "settlements.payout.status.amountUnrecorded", tone: "neutral" }
};

function payoutHistoryEventLabel(t: Translator, eventType: PayoutConfirmationEventDto["eventType"]) {
  if (eventType === "confirm") return t("settlements.payout.history.event.confirm");
  if (eventType === "reconfirm") return t("settlements.payout.history.event.reconfirm");
  return t("settlements.payout.history.event.release");
}

function payoutActorLabel(event: PayoutConfirmationEventDto) {
  const accountId = event.actor?.accountId ?? event.actorAccountId;
  const employeeName = event.actor?.employeeDisplayName;
  return employeeName ? `${accountId} / ${employeeName}` : accountId;
}

function formatBusinessDateTime(locale: Locale, value: string | null) {
  if (!value) return null;
  return formatDateTime(locale, value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function PayoutStatusIndicator({ status, t }: { status: PayoutConfirmationDto["status"]; t: Translator }) {
  const mapped = payoutStatusKey[status];
  return <StatusIndicator label={t(mapped.key)} tone={mapped.tone} />;
}

function policyStatus(settlement: TherapistDailySettlementDto, t: Translator) {
  const { missingPolicy, zeroPolicy } = settlement.warningCounts;
  if (missingPolicy === 0 && zeroPolicy === 0) return null;
  return (
    <StatusIndicator
      label={t("settlements.therapist.policyStatusCell", { missing: missingPolicy, zero: zeroPolicy })}
      tone={missingPolicy > 0 ? "warning" : "neutral"}
    />
  );
}

/**
 * 마사지사 일일정산의 작업면(티켓 05): 직원 비교 표와 직원 패널. 패널에서 출퇴근을 정정하고, 근거 콜, 코스별 수당과
 * 정책 상태, 지급 확인과 이력을 본다(티켓 30, ADR 0004). 금액은 서비스 값을 그대로 그린다.
 */
export function TherapistSettlementView({
  operatingMonthId,
  serviceDate,
  rows,
  attendanceAvailable,
  attendanceDisabled,
  paymentLocked,
  canOpenLedger,
  canOpenStatement,
  initialEmployeeId
}: {
  operatingMonthId: string;
  serviceDate: string;
  rows: TherapistComparisonRow[];
  /** 출퇴근 조회가 실패했으면 false. */
  attendanceAvailable: boolean;
  attendanceDisabled: boolean;
  /** 잠긴 운영월에서는 지급 확인 사건을 쓰지 않는다. */
  paymentLocked: boolean;
  /** 원장에 들어갈 수 있는 역할(관리자)이면 근거 콜이 원장 링크다. */
  canOpenLedger: boolean;
  /** 월 명세서 화면에 들어갈 수 있는 역할(관리자·정산 담당)이면 패널에 그 링크를 둔다(티켓 32). */
  canOpenStatement: boolean;
  initialEmployeeId: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const countSuffix = t("settlements.countSuffix");

  const columns: ComparisonColumn<TherapistComparisonRow>[] = [
    {
      key: "attendance",
      header: t("settlements.therapist.column.attendance"),
      cell: (row) => (row.attendance?.checkInTime ? `${row.attendance.checkInTime}–${row.attendance.checkOutTime ?? ""}` : "—")
    },
    {
      key: "recognition",
      header: t("settlements.therapist.attendance.column.recognition"),
      cell: (row) => (row.attendance ? <AttendanceRecognition row={row.attendance} /> : "—")
    },
    {
      key: "calls",
      header: t("settlements.therapist.column.assignedCalls"),
      numeric: true,
      cell: (row) => `${row.settlement?.totalCallCount ?? 0}${countSuffix}`
    },
    {
      key: "amount",
      header: t("settlements.therapist.column.dailySettlement"),
      numeric: true,
      cell: (row) => (
        <span className="font-semibold">
          <AmountText amount={therapistSettlementAmount(row.settlement)} locale={locale} />
        </span>
      )
    },
    {
      key: "policy",
      header: t("settlements.therapist.column.policyStatus"),
      cell: (row) => (row.settlement ? policyStatus(row.settlement, t) : null) ?? "—"
    },
    {
      key: "payout",
      header: t("settlements.therapist.column.payoutConfirmation"),
      cell: (row) => (row.settlement ? <PayoutStatusIndicator status={row.settlement.payoutConfirmation.status} t={t} /> : "—")
    }
  ];

  return (
    <EmployeeWorkspace
      columns={columns}
      employeeHeader={t("settlements.therapist.column.therapist")}
      initialEmployeeId={initialEmployeeId}
      minTableWidth="min-w-[56rem]"
      renderPanel={(row) => (
        <div className="grid gap-6">
          <StatementLink href={canOpenStatement ? monthlyStatementHref(operatingMonthId, row.employeeId) : null} locale={locale} />

          <PanelSection title={t("settlements.therapist.attendance.title")}>
            <p className="text-sm text-muted">{t("settlements.therapist.attendance.description")}</p>
            {row.attendance ? (
              <TherapistAttendanceForm
                // Key on the persisted state so a successful save/clear + revalidation
                // remounts the form, clearing useActionState and resetting time inputs.
                attendanceDate={serviceDate}
                disabled={attendanceDisabled}
                key={`${row.employeeId}:${serviceDate}:${row.attendance.id ?? "none"}:${row.attendance.checkInTime ?? ""}:${row.attendance.checkOutTime ?? ""}`}
                operatingMonthId={operatingMonthId}
                row={row.attendance}
              />
            ) : (
              <p className="text-sm text-muted">
                {attendanceAvailable ? t("settlements.therapist.panel.noAttendance") : t("settlements.therapist.attendanceError.title")}
              </p>
            )}
          </PanelSection>

          <PanelSection title={t("settlements.therapist.evidence.title")}>
            {row.settlement && row.settlement.assignmentEvidence.length > 0 ? (
              <EvidenceCallList label={t("settlements.therapist.evidence.title")}>
                {row.settlement.assignmentEvidence.map((evidence) => {
                  const status = rateStatus[evidence.rateStatus];
                  return (
                    <li key={`${evidence.serviceCallId}-${evidence.role}`}>
                      <EvidenceCallItem
                        amount={<AmountText amount={therapistEvidenceAmount(evidence)} locale={locale} />}
                        call={evidence.call}
                        canOpenLedger={canOpenLedger}
                        detail={
                          <>
                            <span>
                              {t("settlements.therapist.evidence.role")}: {t(roleKey[evidence.role])}
                            </span>
                            <StatusIndicator label={t(status.key)} tone={status.tone} />
                          </>
                        }
                        locale={locale}
                        serviceDate={serviceDate}
                      />
                    </li>
                  );
                })}
              </EvidenceCallList>
            ) : (
              <p className="text-sm text-muted">{t("settlements.therapist.empty.title")}</p>
            )}
          </PanelSection>

          {row.settlement ? <CourseSection locale={locale} settlement={row.settlement} t={t} /> : null}

          {row.settlement ? (
            <PayoutConfirmationSection
              locale={locale}
              operatingMonthId={operatingMonthId}
              payoutLocked={paymentLocked}
              serviceDate={serviceDate}
              settlement={row.settlement}
              t={t}
            />
          ) : null}
        </div>
      )}
      rows={rows}
      tableLabel={t("settlements.therapist.table.title")}
    />
  );
}

function CourseSection({ settlement, locale, t }: { settlement: TherapistDailySettlementDto; locale: Locale; t: Translator }) {
  const countSuffix = t("settlements.countSuffix");
  return (
    <PanelSection title={t("settlements.therapist.panel.courses")}>
      <dl>
        {courseCodes
          .filter((courseCode) => settlement.courseBreakdown[courseCode].callCount > 0)
          .map((courseCode) => (
            <DetailRow
              key={courseCode}
              label={t("settlements.therapist.column.courseQtyAmount", { course: courseCode })}
              value={
                <>
                  {settlement.courseBreakdown[courseCode].callCount}
                  {countSuffix} · <AmountText amount={therapistCourseAmount(settlement, courseCode)} locale={locale} />
                </>
              }
            />
          ))}
        <DetailRow label={t("settlements.therapist.column.policyStatus")} value={policyStatus(settlement, t) ?? "—"} />
      </dl>
    </PanelSection>
  );
}

function PayoutConfirmationSection({
  settlement,
  operatingMonthId,
  serviceDate,
  payoutLocked,
  locale,
  t
}: {
  settlement: TherapistDailySettlementDto;
  operatingMonthId: string;
  serviceDate: string;
  /** 잠긴 운영월에서는 폼을 보이지 않는다. */
  payoutLocked: boolean;
  locale: Locale;
  t: Translator;
}) {
  const payout = settlement.payoutConfirmation;
  // 미확인일 때만 "확인"을 쓸 수 있다. 그 밖(확인됨/지급 재확인 필요/확인 금액 미기록)은 재확인·해제를 쓸 수 있다.
  const hasActiveConfirmation = payout.status !== "unconfirmed";
  const unit = { operatingMonthId, serviceDate, employeeId: settlement.employeeId };

  return (
    <PanelSection title={t("settlements.therapist.column.payoutConfirmation")}>
      <div className="grid gap-1 text-sm text-muted">
        <div>
          <PayoutStatusIndicator status={payout.status} t={t} />
        </div>
        <div>
          {t("settlements.payout.currentAmount")}: {vnd(locale, payout.currentAmount)}
        </div>
        {payout.lastConfirmedAmount !== null ? (
          <div>
            {t("settlements.payout.lastConfirmedAmount")}: {vnd(locale, payout.lastConfirmedAmount)}
          </div>
        ) : null}
        {payout.difference !== null && payout.difference !== 0 ? (
          <div>
            {t("settlements.payout.difference")}: {vnd(locale, payout.difference)}
          </div>
        ) : null}
      </div>

      {payoutLocked ? null : hasActiveConfirmation ? (
        <div className="grid gap-3">
          <ReasonPayoutForm
            action={reconfirmTherapistDailySettlementPayoutAction}
            pendingLabel={t("settlements.payout.action.reconfirming")}
            placeholder={t("settlements.payout.reason.reconfirmPlaceholder")}
            submitLabel={t("settlements.payout.action.reconfirm")}
            {...unit}
          />
          <ReasonPayoutForm
            action={releaseTherapistDailySettlementPayoutAction}
            pendingLabel={t("settlements.payout.action.releasing")}
            placeholder={t("settlements.payout.reason.releasePlaceholder")}
            submitLabel={t("settlements.payout.action.release")}
            {...unit}
          />
        </div>
      ) : (
        <ConfirmPayoutButton action={confirmTherapistDailySettlementPayoutAction} {...unit} />
      )}

      {payout.history.length > 0 ? (
        <div className="border-l border-border pl-3 text-sm text-muted">
          <div className="font-semibold text-foreground">{t("settlements.payout.history.title", { count: payout.history.length })}</div>
          <ol className="mt-1 grid gap-2">
            {payout.history.slice(0, 5).map((event) => (
              <li key={event.id}>
                <div>
                  {payoutHistoryEventLabel(t, event.eventType)} ·{" "}
                  {event.amount !== null ? vnd(locale, event.amount) : t("settlements.payout.history.amount.unrecorded")}
                </div>
                <div>{formatBusinessDateTime(locale, event.occurredAt)}</div>
                <div>{t("settlements.therapist.handler", { actor: payoutActorLabel(event) })}</div>
                {event.reason ? <div>{event.reason}</div> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </PanelSection>
  );
}
