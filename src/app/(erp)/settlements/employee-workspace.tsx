"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidePanel } from "@/components/ui/panel";
import { tableCellClassName, tableShrinkClassName } from "@/components/ui/table";
import { EMPLOYEE_PARAM } from "@/app/(erp)/settlements/settlement-view-model";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type EmployeeRow = {
  employeeId: string;
  displayName: string;
  staffCode: string;
};

export type ComparisonColumn<Row> = {
  key: string;
  header: string;
  /** 숫자·금액 열은 오른쪽 정렬이고 내용 폭대로 줄어든다(남는 폭은 글자 열들이 나눠 갖는다, design.md 6.6). */
  numeric?: boolean;
  /** 바로 앞 열이 오른쪽 정렬 숫자라, 숫자와 이 글자가 한 칸처럼 붙어 보이지 않게 왼쪽을 더 띈다. */
  padStart?: boolean;
  cell: (row: Row) => ReactNode;
};

const cellClassName = cn(tableCellClassName, "align-middle");

/**
 * 고른 직원을 화면 상태로 들고, 주소는 history.replaceState로만 맞춘다. 행을 옮겨 다닐 때마다
 * 서버를 다시 부르지 않는다. 좁은 폭에서는 패널이 표 아래에 쌓이므로 고르면 패널로 내려간다.
 */
function useEmployeeSelection(initialEmployeeId: string | null) {
  const [selectedId, setSelectedId] = useState(initialEmployeeId);
  const panelRef = useRef<HTMLDivElement>(null);
  const revealPanel = useRef(false);

  useEffect(() => {
    if (!revealPanel.current) return;
    revealPanel.current = false;
    if (selectedId && !window.matchMedia("(min-width: 840px)").matches) {
      panelRef.current?.scrollIntoView({ block: "start" });
    }
  }, [selectedId]);

  function select(employeeId: string | null) {
    revealPanel.current = employeeId !== null;
    setSelectedId(employeeId);
    const url = new URL(window.location.href);
    if (employeeId) url.searchParams.set(EMPLOYEE_PARAM, employeeId);
    else url.searchParams.delete(EMPLOYEE_PARAM);
    window.history.replaceState(null, "", url);
  }

  return { selectedId, select, panelRef };
}

/**
 * 정산 화면의 작업면: 직원 비교 표와, 고른 직원의 근거를 보이는 비모달 패널(정보구조 9절, design.md 6.6·6.11).
 * 840px 이상에서는 표 옆에 패널을 두고, 미만에서는 표 아래에 쌓는다.
 */
export function EmployeeWorkspace<Row extends EmployeeRow>({
  tableLabel,
  employeeHeader,
  columns,
  rows,
  minTableWidth,
  initialEmployeeId,
  renderPanel
}: {
  tableLabel: string;
  employeeHeader: string;
  columns: ComparisonColumn<Row>[];
  rows: Row[];
  /** 표가 좁아지지 않을 최소 폭(Tailwind 클래스). 넘치면 표 상자만 가로로 스크롤한다. */
  minTableWidth: string;
  initialEmployeeId: string | null;
  renderPanel: (row: Row) => ReactNode;
}) {
  const t = useT();
  const { selectedId, select, panelRef } = useEmployeeSelection(initialEmployeeId);
  const selectedRow = rows.find((row) => row.employeeId === selectedId) ?? null;

  return (
    <div className={selectedRow ? "grid grid-cols-1 items-start gap-6 min-[840px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid gap-6"}>
      <div className="grid min-w-0 gap-3">
        {selectedRow ? null : <p className="text-sm text-muted">{t("settlements.panel.hint")}</p>}
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table aria-label={tableLabel} className={cn("w-full border-collapse text-left text-sm", minTableWidth)}>
            <thead className="bg-readonly text-xs font-semibold text-muted">
              <tr>
                <th className={cellClassName} scope="col">
                  {employeeHeader}
                </th>
                {columns.map((column) => (
                  <th
                    className={cn(
                      cellClassName,
                      column.numeric && tableShrinkClassName,
                      column.numeric && "text-right",
                      column.padStart && "pl-8"
                    )}
                    key={column.key}
                    scope="col"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selected = row.employeeId === selectedRow?.employeeId;
                return (
                  <tr
                    className={cn("cursor-pointer transition-colors hover:bg-readonly", selected && "bg-readonly")}
                    key={row.employeeId}
                    onClick={() => select(row.employeeId)}
                  >
                    {/* 선택된 행의 왼쪽 검정 막대(design.md 6.6). 표 행에는 그림자가 그려지지 않는 브라우저가 있어 첫 칸에 둔다. */}
                    <th className={cn(cellClassName, selected && "[box-shadow:inset_3px_0_0_var(--brand)]")} scope="row">
                      <button
                        aria-pressed={selected}
                        className="flex min-h-11 flex-col items-start justify-center rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          select(row.employeeId);
                        }}
                        type="button"
                      >
                        <span className="font-semibold text-foreground">{row.displayName}</span>
                        <span className="text-xs font-normal text-muted">{row.staffCode}</span>
                      </button>
                    </th>
                    {columns.map((column) => (
                      <td
                        className={cn(
                          cellClassName,
                          column.numeric && "whitespace-nowrap text-right tabular-nums",
                          column.padStart && "pl-8"
                        )}
                        key={column.key}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {selectedRow ? (
        <div className="min-w-0 min-[840px]:sticky min-[840px]:top-4" ref={panelRef}>
          <SidePanel onClose={() => select(null)} title={`${selectedRow.displayName} (${selectedRow.staffCode})`}>
            {renderPanel(selectedRow)}
          </SidePanel>
        </div>
      ) : null}
    </div>
  );
}
