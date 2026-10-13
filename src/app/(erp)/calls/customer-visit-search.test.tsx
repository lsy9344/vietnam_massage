import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeyboardEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerVisitSearchView } from "@/app/(erp)/calls/customer-visit-search-view";
import {
  CUSTOMER_SEARCH_DEBOUNCE_MS,
  customerVisitLedgerPath,
  customerVisitSearchPath,
  moveCandidateIndex
} from "@/app/(erp)/calls/customer-visit-search";
import type { CustomerVisitCandidateDto, CustomerVisitHistoryRowDto } from "@/modules/calls/service-call-service";

const ledger = { operatingMonthId: "month-2026-06", serviceDate: "2026-06-10" };

function paramsOf(path: string) {
  return new URLSearchParams(path.slice(path.indexOf("?") + 1));
}

function candidate(overrides: Partial<CustomerVisitCandidateDto> = {}): CustomerVisitCandidateDto {
  return {
    kind: "customer",
    customerId: "customer-1",
    label: "민아",
    phone: "090111",
    latestVisitDate: "2026-06-20",
    ...overrides
  };
}

function row(overrides: Partial<CustomerVisitHistoryRowDto> = {}): CustomerVisitHistoryRowDto {
  return {
    serviceCallId: "call-1",
    operatingMonthId: "month-locked",
    serviceDate: "2026-07-02",
    startTime: "11:00",
    courseLabel: "A A 누루60",
    therapistLabel: "마사지사1",
    status: "예약",
    customerMemo: "잠긴 달",
    ...overrides
  };
}

function renderView(overrides: Partial<Parameters<typeof CustomerVisitSearchView>[0]> = {}) {
  return renderToStaticMarkup(
    <CustomerVisitSearchView
      activeIndex={-1}
      candidates={[]}
      historyOpen={false}
      locale="ko"
      onQueryChange={() => undefined}
      onQueryKeyDown={(_event: KeyboardEvent<HTMLInputElement>) => undefined}
      onSelect={() => undefined}
      query=""
      rows={[]}
      selectedCustomerId={null}
      selectedMemo={null}
      {...overrides}
    />
  );
}

describe("customer visit search", () => {
  it("keeps the query and the chosen visit in the address, and drops them when the query is empty", () => {
    assert.equal(CUSTOMER_SEARCH_DEBOUNCE_MS, 300);

    const typed = paramsOf(customerVisitSearchPath(ledger, { customerQuery: " 민아 " }));
    assert.equal(typed.get("operatingMonthId"), "month-2026-06");
    assert.equal(typed.get("serviceDate"), "2026-06-10");
    assert.equal(typed.get("customerQuery"), "민아");
    assert.equal(typed.get("visitCustomer"), null);
    assert.equal(typed.get("visitMemo"), null);

    const cleared = paramsOf(customerVisitSearchPath(ledger, { customerQuery: "   ", visitCustomer: "customer-1" }));
    assert.equal(cleared.get("customerQuery"), null);
    assert.equal(cleared.get("visitCustomer"), null);
    assert.equal(cleared.get("operatingMonthId"), "month-2026-06");

    const customer = paramsOf(customerVisitSearchPath(ledger, { customerQuery: "민아", visitCustomer: "customer-1" }));
    assert.equal(customer.get("customerQuery"), "민아");
    assert.equal(customer.get("visitCustomer"), "customer-1");
    assert.equal(customer.get("visitMemo"), null);

    const memo = paramsOf(customerVisitSearchPath(ledger, { customerQuery: "민아", visitMemo: "민아 메모" }));
    assert.equal(memo.get("visitMemo"), "민아 메모");
    assert.equal(memo.get("visitCustomer"), null);

    const blankMemo = paramsOf(customerVisitSearchPath(ledger, { customerQuery: "민아", visitMemo: "" }));
    assert.equal(blankMemo.has("visitMemo"), true);
    assert.equal(blankMemo.get("visitMemo"), "");

    assert.equal(customerVisitLedgerPath("month-locked", "2026-07-02"), "/calls?operatingMonthId=month-locked&serviceDate=2026-07-02");
  });

  it("moves through candidates with the arrow keys and stops at the ends", () => {
    assert.equal(moveCandidateIndex(-1, "ArrowDown", 3), 0);
    assert.equal(moveCandidateIndex(0, "ArrowDown", 3), 1);
    assert.equal(moveCandidateIndex(2, "ArrowDown", 3), 2);
    assert.equal(moveCandidateIndex(-1, "ArrowUp", 3), 2);
    assert.equal(moveCandidateIndex(0, "ArrowUp", 3), 0);
    assert.equal(moveCandidateIndex(2, "ArrowUp", 3), 1);
    assert.equal(moveCandidateIndex(0, "ArrowDown", 0), -1);
  });

  it("shows the search label, the empty line, and one history row in Korean and Vietnamese", () => {
    const idle = renderView();
    assert.match(idle, /고객 검색/);
    assert.doesNotMatch(idle, /일치하는 결과가 없습니다/);
    assert.doesNotMatch(idle, /방문 이력/);

    const empty = renderView({ query: "없는손님" });
    assert.match(empty, /고객 검색/);
    assert.match(empty, /일치하는 결과가 없습니다\. 이름이나 번호의 일부를 다시 입력해 보세요\./);

    const emptyVi = renderView({ locale: "vi", query: "khong" });
    assert.match(emptyVi, /Tìm khách/);
    assert.match(emptyVi, /Không có kết quả khớp\. Hãy thử nhập một phần tên hoặc số\./);

    const found = renderView({
      query: "민아",
      candidates: [candidate(), candidate({ kind: "memo", customerId: null, label: "민아 메모", phone: null, latestVisitDate: "2026-07-03" })],
      historyOpen: true,
      selectedCustomerId: "customer-1",
      rows: [row()]
    });
    assert.match(found, /민아 · 090111/);
    assert.match(found, /최근 방문 2026-06-20/);
    assert.match(found, /민아 메모/);
    assert.match(found, /최근 방문 2026-07-03/);
    assert.match(found, /방문 이력/);
    assert.match(found, /예약시각/);
    assert.match(found, /Therapist/);
    assert.match(found, /고객\/메모/);
    assert.match(found, /A A 누루60/);
    assert.match(found, /마사지사1/);
    assert.match(found, /잠긴 달/);
    assert.match(found, /11:00/);
    assert.match(found, />예약</);
    assert.match(found, /tabindex="-1"/);
    assert.match(found, /href="\/calls\?operatingMonthId=month-locked&(?:amp;)?serviceDate=2026-07-02"/);
    assert.doesNotMatch(found, /customerQuery/);
    assert.doesNotMatch(found, /일치하는 결과가 없습니다/);

    const foundVi = renderView({
      locale: "vi",
      query: "민아",
      historyOpen: true,
      rows: [row()]
    });
    assert.match(foundVi, /Lịch sử ghé/);
    assert.match(foundVi, /Giờ đặt/);
    assert.match(foundVi, /Therapist/);
    assert.match(foundVi, /Khách\/Ghi chú/);
    assert.match(foundVi, />Đặt trước</);
  });
});
