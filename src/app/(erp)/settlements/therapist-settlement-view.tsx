"use client";

import { DetailRow } from "@/components/ui/detail-row";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { EmployeeWorkspace, type ComparisonColumn } from "@/app/(erp)/settlements/employee-workspace";
import { AmountText, EvidenceCallItem, EvidenceCallList, PanelSection } from "@/app/(erp)/settlements/settlement-parts";
import {
  therapistCourseAmount,
  therapistEvidenceAmount,
  therapistSettlementAmount,
  type SettlementCourseCode,
  type TherapistComparisonRow
} from "@/app/(erp)/settlements/settlement-view-model";
import { AttendanceRecognition, TherapistAttendanceForm } from "@/app/(erp)/settlements/therapist-attendance-form";
import { TherapistDailySettlementPaymentForm } from "@/app/(erp)/settlements/therapist-daily-settlement-payment-form";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { TherapistDailySettlementDto } from "@/modules/settlements/therapist-daily-settlement-service";

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

type PaymentStatus = TherapistDailySettlementDto["paymentStatus"];

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

function paymentActorAccountId(paymentStatus: PaymentStatus) {
  return paymentStatus.paidBy?.accountId ?? paymentStatus.paidByAccountId;
}

function paymentActorEmployeeLabel(paymentStatus: PaymentStatus) {
  if (!paymentStatus.paidBy?.employeeDisplayName) return null;
  return paymentStatus.paidBy.employeeStaffCode
    ? `${paymentStatus.paidBy.employeeDisplayName} (${paymentStatus.paidBy.employeeStaffCode})`
    : paymentStatus.paidBy.employeeDisplayName;
}

function paymentHistoryActorLabel(history: PaymentStatus["history"][number]) {
  const accountId = history.changedBy?.accountId ?? history.changedByAccountId;
  const employeeName = history.changedBy?.employeeDisplayName;
  return employeeName ? `${accountId} / ${employeeName}` : accountId;
}

function paymentStateLabel(t: Translator, value: boolean | null) {
  return value ? t("settlements.therapist.state.paid") : t("settlements.therapist.state.unpaid");
}

function PaymentIndicator({ isPaid, t }: { isPaid: boolean; t: Translator }) {
  return <StatusIndicator label={paymentStateLabel(t, isPaid)} tone={isPaid ? "success" : "neutral"} />;
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
 * 정책 상태, 지급완료와 이력을 본다. 금액은 서비스 값을 그대로 그린다.
 */
export function TherapistSettlementView({
  operatingMonthId,
  serviceDate,
  rows,
  attendanceAvailable,
  attendanceDisabled,
  paymentLocked,
  canOpenLedger,
  initialEmployeeId
}: {
  operatingMonthId: string;
  serviceDate: string;
  rows: TherapistComparisonRow[];
  /** 출퇴근 조회가 실패했으면 false. */
  attendanceAvailable: boolean;
  attendanceDisabled: boolean;
  /** 잠긴 운영월에서는 지급완료를 바꾸지 않는다. */
  paymentLocked: boolean;
  /** 원장에 들어갈 수 있는 역할(관리자)이면 근거 콜이 원장 링크다. */
  canOpenLedger: boolean;
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
      key: "paid",
      header: t("settlements.therapist.column.paid"),
      cell: (row) => (row.settlement ? <PaymentIndicator isPaid={row.settlement.paymentStatus.isPaid} t={t} /> : "—")
    }
  ];

  return (
    <EmployeeWorkspace
      columns={columns}
      employeeHeader={t("settlements.therapist.column.therapist")}
      initialEmployeeId={initialEmployeeId}
      minTableWidth="min-w-[52rem]"
      renderPanel={(row) => (
        <div className="grid gap-6">
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
            <PaymentSection
              locale={locale}
              operatingMonthId={operatingMonthId}
              paymentLocked={paymentLocked}
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

function PaymentSection({
  settlement,
  operatingMonthId,
  serviceDate,
  paymentLocked,
  locale,
  t
}: {
  settlement: TherapistDailySettlementDto;
  operatingMonthId: string;
  serviceDate: string;
  paymentLocked: boolean;
  locale: Locale;
  t: Translator;
}) {
  const payment = settlement.paymentStatus;
  const actor = paymentActorAccountId(payment);
  const actorEmployee = paymentActorEmployeeLabel(payment);
  return (
    <PanelSection title={t("settlements.therapist.column.paid")}>
      <div className="grid gap-1 text-sm text-muted">
        <div>
          <PaymentIndicator isPaid={payment.isPaid} t={t} />
        </div>
        {payment.isPaid ? (
          <>
            <div>{formatBusinessDateTime(locale, payment.paidAt)}</div>
            {actor ? <div>{t("settlements.therapist.handler", { actor })}</div> : null}
            {actorEmployee ? <div>{actorEmployee}</div> : null}
          </>
        ) : null}
      </div>
      {paymentLocked ? null : (
        <TherapistDailySettlementPaymentForm
          employeeId={settlement.employeeId}
          isPaid={payment.isPaid}
          operatingMonthId={operatingMonthId}
          serviceDate={serviceDate}
        />
      )}
      {payment.history.length > 0 ? (
        <div className="border-l border-border pl-3 text-sm text-muted">
          <div className="font-semibold text-foreground">{t("settlements.therapist.history.title", { count: payment.history.length })}</div>
          <ol className="mt-1 grid gap-2">
            {payment.history.slice(0, 3).map((history) => (
              <li key={`${history.changedAt}-${history.changedByAccountId}`}>
                <div>
                  {paymentStateLabel(t, history.previousIsPaid)} -&gt; {paymentStateLabel(t, history.newIsPaid)}
                </div>
                <div>{formatBusinessDateTime(locale, history.changedAt)}</div>
                <div>{t("settlements.therapist.handler", { actor: paymentHistoryActorLabel(history) ?? "" })}</div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </PanelSection>
  );
}
