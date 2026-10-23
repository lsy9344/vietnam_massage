import Link from "next/link";
import type { ReactNode } from "react";
import { CallStatusChip, type CallStatusKey } from "@/components/domain/call-status-chip";
import { DetailRow } from "@/components/ui/detail-row";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { tableCellClassName, tableHeadCellClassName, tableNumberCellClassName } from "@/components/ui/table";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import type { DailyCourseSummaryDto } from "@/modules/calls/service-call-service";
import type { TodayDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";

type StatusCounts = TodayDashboardMetricsDto["statusCounts"];

// 예약건수는 상태가 아니라 원장에 등록된 전체 건수라 칩 없이 글자로 둔다(REQ-009).
const statusRows: Array<{ key: keyof StatusCounts; labelKey: MessageKey; status: CallStatusKey | null }> = [
  { key: "reservation", labelKey: "dashboard.status.reservationCount", status: null },
  { key: "inUse", labelKey: "dashboard.status.inUse", status: "inUse" },
  { key: "cleaning", labelKey: "dashboard.status.cleaning", status: "cleaning" },
  { key: "completed", labelKey: "dashboard.status.completed", status: "completed" },
  { key: "noShow", labelKey: "dashboard.status.noShow", status: "noShow" },
  { key: "canceled", labelKey: "dashboard.status.canceled", status: "canceled" }
];

const inProgress = new Set<keyof StatusCounts>(["inUse", "cleaning"]);

/** 상태별 건수 한 줄. 콜 상태는 객실 상태색 배지가 아니라 원장 머리와 같은 CallStatusChip으로 보인다(design.md 2.5, 6.8). */
export function DashboardStatusCounts({
  label,
  counts,
  inProgressFirst = false,
  locale
}: {
  label: string;
  counts: StatusCounts;
  /** 오늘 화면: 진행 중인 콜(사용중·청소중)을 맨 앞에 둔다. */
  inProgressFirst?: boolean;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const rows = inProgressFirst
    ? [...statusRows.filter((row) => inProgress.has(row.key)), ...statusRows.filter((row) => !inProgress.has(row.key))]
    : statusRows;
  return (
    <section aria-label={label}>
      <ul className="flex flex-wrap items-center gap-1.5">
        {rows.map((row) => {
          const count = t("dashboard.count", { count: formatNumber(locale, counts[row.key]) });
          return (
            <li className="inline-flex min-h-9 items-center gap-1.5" key={row.key}>
              {row.status ? (
                <CallStatusChip count={{ value: counts[row.key], text: count }} label={t(row.labelKey)} status={row.status} />
              ) : (
                <>
                  <span className="text-sm font-semibold text-foreground">{t(row.labelKey)}</span>{" "}
                  <span className="mr-1 text-sm font-semibold text-foreground">{count}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 정책·수당·D코스 문제로 집계에서 빠진 콜이 있을 때 본문 맨 위에 두는 경고. */
export function ExcludedCallsWarning({ title, summary, detail, locale }: { title: string; summary: string; detail: string; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ScreenState
      description={
        <>
          <p>{summary}</p>
          <p className="mt-2 font-semibold text-foreground">{detail}</p>
        </>
      }
      kind="warning"
      label={t("dashboard.warning.chip")}
      title={title}
    />
  );
}

/** 요약 카드 아래나 본문에 두는 카드(design.md 6.7·6.13): 18px 모서리, 1px 선, 그림자 없음. */
export function DashboardCard({
  title,
  label = title,
  aside,
  children,
  className
}: {
  title: string;
  /** 영역 이름이 제목과 다를 때. */
  label?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={cn("min-w-0 rounded-lg border border-border bg-surface p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
        {aside ? <p className="text-xs text-faint">{aside}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** 라벨과 금액 한 줄씩. 금액은 오른쪽 정렬이다. */
export function AmountRows({ rows, className }: { rows: Array<{ label: string; value: string }>; className?: string }) {
  return (
    <dl className={cn("mt-2", className)}>
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

/** 콜이 없는 날·운영월. 원장 링크는 그 역할이 원장에 들어갈 수 있을 때만 준다(명세 "탐색 셸"). */
export function NoCallsState({ title, description, ledgerHref, locale }: { title: string; description: string; ledgerHref: string | null; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ScreenState
      action={
        ledgerHref ? (
          <Link className="screen-step" href={ledgerHref}>
            {t("dashboard.goToCalls")}
          </Link>
        ) : null
      }
      description={description}
      kind="empty"
      label={t("dashboard.noData")}
      title={title}
    />
  );
}

// 카드 안의 표(design.md 6.6): 머리는 읽기 전용 바탕, 행은 아래 선만, 숫자 열은 오른쪽 정렬.
export const tableHeadClassName = "bg-readonly text-left text-xs font-semibold text-muted";
export const headCellClassName = tableHeadCellClassName;
export const cellClassName = tableCellClassName;
/** 금액·건수 칸: 오른쪽 정렬, 단위가 다음 줄로 넘어가지 않는다. */
export const numberCellClassName = tableNumberCellClassName;

/** 계산 근거가 없어 0 대신 비워 둔 자리(design.md 6.7). */
export function NoBasis({ message, locale }: { message: string; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <StatusIndicator label={t("dashboard.noBasis")} tone="neutral" />
      {message}
    </p>
  );
}

/** 코스별 방문완료 표. 서비스가 계산 가능한 완료 콜로 센 값이고, 하나도 없으면 0 표 대신 근거 없음을 보인다. */
export function CourseCompletionCard({
  title,
  label,
  basis,
  courses,
  rowLabel,
  locale
}: {
  title: string;
  /** 영역 이름이 제목과 다를 때. */
  label?: string;
  basis: string;
  courses: DailyCourseSummaryDto[];
  rowLabel: (courseCode: string) => string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const count = (value: number) => t("dashboard.count", { count: formatNumber(locale, value) });
  const hasBasis = courses.some((course) => course.completedCount > 0 || course.therapistAssignmentCount > 0);

  return (
    <DashboardCard aside={basis} label={label} title={title}>
      {hasBasis ? (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead className={tableHeadClassName}>
            <tr>
              <th className={headCellClassName} scope="col">
                {t("dashboard.course.column.course")}
              </th>
              <th className={cn(headCellClassName, "whitespace-nowrap text-right")} scope="col">
                {t("dashboard.course.column.completed")}
              </th>
              <th className={cn(headCellClassName, "whitespace-nowrap text-right")} scope="col">
                {t("dashboard.course.column.assignment")}
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr aria-label={rowLabel(course.courseCode)} key={course.courseCode}>
                <th className={cn(cellClassName, "text-left font-semibold text-foreground")} scope="row">
                  {course.courseCode}
                </th>
                <td className={numberCellClassName}>{count(course.completedCount)}</td>
                <td className={numberCellClassName}>{count(course.therapistAssignmentCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <NoBasis locale={locale} message={t("dashboard.course.empty")} />
      )}
    </DashboardCard>
  );
}
