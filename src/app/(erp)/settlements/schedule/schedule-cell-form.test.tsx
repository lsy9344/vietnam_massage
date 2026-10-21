import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { DayOffImpactNotice } from "@/app/(erp)/settlements/schedule/schedule-cell-form";
import type { AssignedServiceCallSummaryDto } from "@/modules/calls/service-call-service";

function render(element: ReactElement, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(renderInShell(element, locale));
}

function call(overrides: Partial<AssignedServiceCallSummaryDto> = {}): AssignedServiceCallSummaryDto {
  return {
    serviceCallId: "call-1",
    operatingMonthId: "month-2026-10",
    serviceDate: "2026-10-14",
    startTime: "14:00",
    courseCode: "A",
    status: "예약",
    ...overrides
  };
}

describe("휴무 영향 콜 안내(DayOffImpactNotice, 티켓 28)", () => {
  it("영향받는 콜이 없으면 아무것도 그리지 않는다", () => {
    const html = render(<DayOffImpactNotice calls={[]} canOpenLedger={true} date="2026-10-14" employeeName="Mai" />);
    assert.equal(html, "");
  });

  it("관리자(canOpenLedger=true)에게는 항목이 원장 상세로 가는 링크다", () => {
    const html = render(
      <DayOffImpactNotice calls={[call()]} canOpenLedger={true} date="2026-10-14" employeeName="Mai" />
    );

    assert.match(html, /영향받는 콜 1건/);
    assert.match(html, /재배정/);
    assert.match(html, /<a[^>]*href="\/calls\?operatingMonthId=month-2026-10&amp;serviceDate=2026-10-14&amp;call=call-1"/);
    assert.match(html, /원장에서 보기/);
  });

  it("정산 담당(canOpenLedger=false)에게는 링크 없이 같은 자리의 콜 요약만 보인다", () => {
    const html = render(
      <DayOffImpactNotice calls={[call()]} canOpenLedger={false} date="2026-10-14" employeeName="Mai" />
    );

    assert.match(html, /영향받는 콜 1건/);
    assert.doesNotMatch(html, /<a[^>]*href="\/calls/);
    assert.doesNotMatch(html, /원장에서 보기/);
    // 날짜, 예약시각, 코스, 상태는 링크 없이도 그대로 보인다.
    assert.match(html, /2026-10-14 14:00/);
    assert.match(html, />A</);
  });

  it("노쇼·취소가 아닌 콜 여러 건의 건수를 센다", () => {
    const html = render(
      <DayOffImpactNotice
        calls={[call({ serviceCallId: "call-1" }), call({ serviceCallId: "call-2", startTime: "15:00", courseCode: "B" })]}
        canOpenLedger={false}
        date="2026-10-14"
        employeeName="Mai"
      />
    );

    assert.match(html, /영향받는 콜 2건/);
  });

  it("베트남어 locale에서는 번역된 안내 문구로 그린다", () => {
    const html = render(<DayOffImpactNotice calls={[call()]} canOpenLedger={true} date="2026-10-14" employeeName="Mai" />, "vi");

    assert.match(html, /cuộc gọi bị ảnh hưởng/);
    assert.match(html, /phân công lại/);
  });
});
