import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { ScheduleView } from "@/app/(erp)/settlements/schedule/schedule-view";
import type { PlannedWorkingDayWeekDto } from "@/modules/settlements/schedule-service";

function render(element: ReactElement, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(renderInShell(element, locale));
}

const dates = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

function emptyDays() {
  return dates.map((date) => ({ date, status: "미입력" as const }));
}

function week(overrides: Partial<PlannedWorkingDayWeekDto> = {}): PlannedWorkingDayWeekDto {
  return {
    weekStartDate: "2026-10-12",
    weekEndDate: "2026-10-18",
    dates,
    groups: [
      { employeeGroup: "OPERATIONS", employees: [] },
      { employeeGroup: "EARCARE", employees: [] },
      {
        employeeGroup: "THERAPIST",
        employees: [
          {
            employeeId: "thr-1",
            staffCode: "THR-001",
            displayName: "Mai",
            employeeGroup: "THERAPIST",
            sortOrder: 10,
            days: emptyDays().map((day, index) => (index === 0 ? { ...day, status: "근무 예정" } : index === 2 ? { ...day, status: "휴무" } : day))
          }
        ]
      }
    ],
    ...overrides
  };
}

describe("schedule view", () => {
  it("직군별 표에 근무 예정·휴무·미입력 칸을 그대로 그린다", () => {
    const html = render(<ScheduleView initialEmployeeId={null} week={week()} />);

    assert.match(html, /Mai/);
    assert.match(html, /THR-001/);
    // 10-12는 근무 예정, 10-14는 휴무, 나머지는 미입력
    const plannedCount = html.match(/근무 예정/g)?.length ?? 0;
    const dayOffCount = html.match(/휴무/g)?.length ?? 0;
    const unsetCount = html.match(/미입력/g)?.length ?? 0;
    assert.ok(plannedCount >= 1);
    assert.ok(dayOffCount >= 1);
    assert.ok(unsetCount >= 1);
  });

  it("요일 범례를 세 상태 모두 보여 준다", () => {
    const html = render(<ScheduleView initialEmployeeId={null} week={week()} />);

    assert.match(html, /근무 예정/);
    assert.match(html, /휴무/);
    assert.match(html, /미입력/);
  });

  it("직원을 고르면 요일마다 편집 칸이 있는 패널이 보인다", () => {
    const html = render(<ScheduleView initialEmployeeId="thr-1" week={week()} />);

    assert.match(html, /Mai \(THR-001\)/);
    assert.match(html, /근무 예정은 특정 시각까지/);
    // 요일 7개의 select가 모두 그려졌는지(옵션 3개 x 7)
    const options = html.match(/<option/g)?.length ?? 0;
    assert.equal(options, 21);
  });

  it("활성 직원이 없는 직군은 표를 그리지 않는다", () => {
    const html = render(<ScheduleView initialEmployeeId={null} week={week()} />);

    assert.doesNotMatch(html, /운영팀/);
    assert.doesNotMatch(html, /귀케어팀/);
    assert.match(html, /마사지사/);
  });

  it("베트남어 locale에서는 번역된 상태 문구로 그린다", () => {
    const html = render(<ScheduleView initialEmployeeId={null} week={week()} />, "vi");

    assert.match(html, /Dự kiến làm việc/);
    assert.match(html, /Nghỉ/);
    assert.match(html, /Chưa nhập/);
  });
});
