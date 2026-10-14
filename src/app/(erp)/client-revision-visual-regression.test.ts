import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreateCustomerPanel, CustomerEditForm } from "@/app/(erp)/customers/customer-forms";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { LocaleProvider } from "@/lib/i18n/client";
import { renderInShell } from "@/components/shell/test-harness";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import type { ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function singleOption(value: string, label = value) {
  return [{ value, label }];
}

const callGridOptions: ServiceCallFormOptions = {
  rooms: singleOption("room-101", "101 호실"),
  timeSlots: singleOption("12:00"),
  courses: singleOption("course-a", "A 누루60"),
  statuses: singleOption("VISIT_COMPLETE", "방문완료"),
  discountTypes: singleOption("BIRTHDAY", "생일자"),
  paymentMethods: singleOption("CASH", "현금"),
  confirmationCodes: singleOption("Y"),
  therapists: singleOption("therapist-1", "마사지사1"),
  earcareEmployees: singleOption("earcare-1", "귀케어1"),
  expenseHandlers: singleOption("handler-1", "담당자1")
};

const discountedCallRow: ServiceCallRowDto = {
  id: "call-discounted",
  operatingMonthId: "month-1",
  serviceDate: "2026-06-20",
  startTime: "12:00",
  actualEntryTime: null,
  displayEnd: "13:00",
  warningTime: null,
  roomId: "room-101",
  roomLabel: "101 호실",
  courseId: "course-a",
  courseCode: "A",
  courseLabel: "A 누루60",
  customerId: null,
  customerMemo: "할인 표시 검증",
  therapist1: { id: "therapist-1", displayName: "마사지사1", staffCode: "THR-001" },
  therapist2: null,
  earcare: null,
  status: "VISIT_COMPLETE",
  discountTypeCode: "BIRTHDAY",
  paymentMethodCode: "CASH",
  note: null,
  confirmationCode: "Y",
  basePrice: 1500000,
  paymentAmount: 1400000,
  discountAmount: 100000,
  therapist1Commission: 700000,
  therapist2Commission: 0,
  earcarePoolAmount: 100000,
  opsCallCredit: 1,
  calculationStatus: "calculated",
  calculationErrorCode: null,
  calculationErrorMessage: null,
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
  savedAt: "2026-06-20T00:00:00.000Z"
};

describe("client revision visual regression guards", () => {
  it("keeps major page titles as the first heading of each screen toolbar", () => {
    const html = renderToStaticMarkup(
      createElement(ScreenToolbar, { locale: "ko", path: "/dashboard/today", title: "오늘 KPI 대시보드" })
    );

    assert.match(html, /<header class="screen-toolbar">/);
    assert.match(html, /<h1 class="[^"]*font-bold[^"]*">오늘 KPI 대시보드<\/h1>/);
    assert.match(source("src/app/globals.css"), /\.screen-toolbar\s*\{/);

    // i18n 전환된 화면(/live·/rooms·/calls·/settlements·/closing·/dashboard)은 제목을 t() key로 참조하고, 한국어 원문은 messages/ko.ts에 보존한다.
    const koMessages = source("src/lib/i18n/messages/ko.ts");
    for (const [path, titleKey, koTitle] of [
      ["src/app/(erp)/live/page.tsx", "nav.item.live", "첫화면 실시간 현황"],
      ["src/app/(erp)/rooms/page.tsx", "nav.item.rooms", "객실 현황"],
      ["src/app/(erp)/calls/page.tsx", "calls.title", "콜/예약 입력 원장"],
      ["src/app/(erp)/settlements/page.tsx", "settlements.therapist.title", "마사지사 일일정산"],
      ["src/app/(erp)/dashboard/today/page.tsx", "dashboard.today.title", "오늘 KPI 대시보드"],
      ["src/app/(erp)/dashboard/monthly/page.tsx", "dashboard.monthly.title", "월간 KPI 대시보드"],
      ["src/app/(erp)/dashboard/reports/page.tsx", "dashboard.reports.title", "그래프 리포트"]
    ] as const) {
      const page = source(path);
      assert.match(page, /<ScreenToolbar/);
      assert.match(page, new RegExp(`title=\\{t\\("${titleKey}"\\)\\}`));
      assert.ok(koMessages.includes(koTitle), `messages/ko.ts must keep ${koTitle}`);
    }
  });

  it("renders discounted call payment with base price strike-through and actual payment emphasis", () => {
    // i18n 전환: 그리드 금액 포맷은 locale 기반이므로 ko locale을 시드해 기존 천단위(,) 표기를 검증한다.
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: "ko",
        children: createElement(EditableCallGrid, {
          isLocked: true,
          operatingMonthId: "month-1",
          options: callGridOptions,
          rows: [discountedCallRow],
          serviceDate: "2026-06-20",
          showSettlementColumns: false
        })
      })
    );

    assert.match(html, /class="text-\[11px\] text-muted line-through">1,500,000<\/span>/);
    assert.match(html, /class="font-bold text-foreground">1,400,000<\/span>/);
    assert.match(html, /고객\/메모/);
    assert.match(html, /연결 안 함/);
    assert.match(html, /data-call-cell-column="customerId"/);
  });

  it("renders the customer record form and the register action in Korean and Vietnamese", () => {
    const customer = { id: "customer-1", name: "민아", phone: "090111", memo: "단골" };
    const render = (locale: "ko" | "vi") =>
      renderToStaticMarkup(
        renderInShell(
          createElement("div", null, createElement(CreateCustomerPanel), createElement(CustomerEditForm, { customer })),
          locale
        )
      );
    const korean = render("ko");
    const vietnamese = render("vi");

    assert.match(korean, />고객 등록</);
    assert.match(korean, />고치기</);
    assert.match(korean, /value="민아"/);
    assert.match(korean, />연락처</);
    assert.match(vietnamese, />Đăng ký khách</);
    assert.match(vietnamese, />Sửa</);
    assert.match(vietnamese, /value="민아"/);
    assert.match(vietnamese, />Số liên lạc</);
  });

  // 티켓 06: 매출(결제합계·순이익)은 라벤더, 비용 합계는 피치 요약 카드로 나눈다. 빨강(위험색)은 오류에만 쓴다(design.md 2.3·2.4).
  it("keeps today dashboard revenue and cost in separate summary-card families", () => {
    const todayView = source("src/app/(erp)/dashboard/today/today-dashboard-view.tsx");
    // i18n 전환: KPI 라벨은 t() key로 참조하고 한국어 원문은 messages/ko.ts에 보존한다.
    const koMessages = source("src/lib/i18n/messages/ko.ts");

    for (const [accent, labelKey] of [
      ["lavender", "dashboard.today.kpi.paymentTotal"],
      ["lavender", "dashboard.today.kpi.netProfit"],
      ["peach", "dashboard.today.kpi.dailyCostTotal"]
    ] as const) {
      assert.match(todayView, new RegExp(`accent="${accent}"\\s+label=\\{t\\("${labelKey.replace(/\./g, "\\.")}"\\)\\}`));
    }
    assert.doesNotMatch(todayView, /text-danger/);
    for (const ko of ["결제합계", "순이익", "결제합계 - 일일 비용"]) {
      assert.ok(koMessages.includes(ko), `messages/ko.ts must keep ${ko}`);
    }
    for (const [labelKey, ko] of [
      ["dashboard.today.kpi.opsDailyIncentiveTotal", "일일인센 합계"],
      ["dashboard.today.kpi.expenseTotal", "지출합계"],
      ["dashboard.today.kpi.therapistPayoutTotal", "마사지사 정산"],
      ["dashboard.today.kpi.earcarePayoutTotal", "귀케어 정산"],
      ["dashboard.today.kpi.dailyCostTotal", "일일비용 합계"]
    ] as const) {
      assert.ok(todayView.includes(`t("${labelKey}")`), `today dashboard must show ${labelKey}`);
      assert.ok(koMessages.includes(ko), `messages/ko.ts must keep ${ko}`);
    }
  });

  it("keeps monthly dashboard revenue and daily/monthly costs in separate summary-card families", () => {
    const monthlyView = source("src/app/(erp)/dashboard/monthly/monthly-dashboard-view.tsx");
    // i18n 전환: KPI 라벨은 t() key로 참조하고 한국어 원문은 messages/ko.ts에 보존한다.
    const koMessages = source("src/lib/i18n/messages/ko.ts");

    for (const [accent, labelKey] of [
      ["lavender", "dashboard.monthly.kpi.paymentTotal"],
      ["lavender", "dashboard.monthly.kpi.netProfit"],
      ["peach", "dashboard.monthly.kpi.dailyCostTotal"],
      ["peach", "dashboard.monthly.kpi.monthlyCostTotal"]
    ] as const) {
      assert.match(monthlyView, new RegExp(`accent="${accent}"\\s+label=\\{t\\("${labelKey.replace(/\./g, "\\.")}"\\)\\}`));
    }
    assert.doesNotMatch(monthlyView, /text-danger/);
    for (const ko of ["결제합계", "월간 순이익", "결제합계 - 일일비용 - 월간비용"]) {
      assert.ok(koMessages.includes(ko), `messages/ko.ts must keep ${ko}`);
    }
    for (const [labelKey, ko] of [
      ["dashboard.monthly.kpi.expenseTotal", "지출합계"],
      ["dashboard.monthly.kpi.dailyCostTotal", "일일비용 합계"],
      ["dashboard.monthly.kpi.monthlyCostTotal", "월간비용 합계"],
      ["dashboard.monthly.kpi.opsMonthlyIncentiveTotal", "운영팀 월인센"],
      ["dashboard.monthly.kpi.fullAttendanceAllowanceTotal", "만근수당"],
      ["dashboard.monthly.kpi.countKingBonusTotal", "갯수왕"],
      ["dashboard.monthly.settlement.grandPayout", "전체 지급 합계"]
    ] as const) {
      assert.ok(monthlyView.includes(`t("${labelKey}")`), `monthly dashboard must show ${labelKey}`);
      assert.ok(koMessages.includes(ko), `messages/ko.ts must keep ${ko}`);
    }
  });
});
