import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { CustomerScreenView } from "@/app/(erp)/customers/customer-screen-view";
import { CUSTOMER_SEARCH_DEBOUNCE_MS, customerScreenHref, moveCandidateIndex } from "@/app/(erp)/customers/customer-search";
import type { CustomerVisitCandidateDto, CustomerVisitHistoryRowDto } from "@/modules/calls/service-call-service";

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

const minah = { id: "customer-1", name: "민아", phone: "090111", memo: "단골" };

function renderView(overrides: Partial<Parameters<typeof CustomerScreenView>[0]> = {}, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(
    renderInShell(
      <CustomerScreenView
        activeIndex={-1}
        candidates={[]}
        customer={null}
        history={[]}
        locale={locale}
        onClose={() => undefined}
        onQueryChange={() => undefined}
        onQueryKeyDown={() => undefined}
        onSelect={() => undefined}
        query=""
        selectedMemo={null}
        settledQuery=""
        {...overrides}
      />,
      locale
    )
  );
}

describe("customer screen address", () => {
  it("keeps the query and the chosen customer or call memo in the address", () => {
    assert.equal(CUSTOMER_SEARCH_DEBOUNCE_MS, 300);
    assert.equal(customerScreenHref({ customerQuery: "   " }), "/customers");

    const typed = paramsOf(customerScreenHref({ customerQuery: " 민아 " }));
    assert.equal(typed.get("customerQuery"), "민아");
    assert.equal(typed.get("visitCustomer"), null);
    assert.equal(typed.get("visitMemo"), null);

    const customer = paramsOf(customerScreenHref({ customerQuery: "민아", visitCustomer: "customer-1", visitMemo: "무시" }));
    assert.equal(customer.get("visitCustomer"), "customer-1");
    assert.equal(customer.get("visitMemo"), null);

    const memo = paramsOf(customerScreenHref({ customerQuery: "민아", visitMemo: "민아 메모" }));
    assert.equal(memo.get("visitMemo"), "민아 메모");
    assert.equal(memo.get("visitCustomer"), null);

    const blankMemo = paramsOf(customerScreenHref({ customerQuery: "민아", visitMemo: "" }));
    assert.equal(blankMemo.has("visitMemo"), true);

    // 검색어를 지워도 고른 고객은 패널에 남는다.
    assert.equal(customerScreenHref({ customerQuery: "", visitCustomer: "customer-1" }), "/customers?visitCustomer=customer-1");
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
});

describe("customer screen view", () => {
  it("opens with a labelled search capsule and no detail panel", () => {
    const idle = renderView();
    assert.match(idle, /<label[^>]*for="customer-search"[^>]*>[^<]*<span[^>]*>고객 검색<\/span>/);
    assert.match(idle, /<div class="[^"]*rounded-full border border-border-strong bg-surface[^"]*focus-within:outline-brand-secondary/);
    assert.match(idle, /이름, 연락처, 메모나 콜의 고객\/메모 일부로 찾습니다/);
    assert.doesNotMatch(idle, /<aside/);
    assert.doesNotMatch(idle, /일치하는 결과가 없습니다/);

    assert.doesNotMatch(renderView({ query: "민", settledQuery: "" }), /일치하는 결과가 없습니다/);
    assert.match(
      renderView({ query: "없는손님", settledQuery: "없는손님" }),
      /일치하는 결과가 없습니다\. 이름이나 번호의 일부를 다시 입력해 보세요\./
    );
    assert.match(renderView({ query: "khong", settledQuery: "khong" }, "vi"), /Không có kết quả khớp\. Hãy thử nhập một phần tên hoặc số\./);
  });

  it("lists candidates as row cards with the latest visit date, marking the chosen one", () => {
    const html = renderView({
      query: "민아",
      settledQuery: "민아",
      candidates: [
        candidate({ label: "원장표기" }),
        candidate({ kind: "memo", customerId: null, label: "민아 메모", phone: null, latestVisitDate: "2026-07-03" })
      ],
      customer: minah,
      activeIndex: 1
    });
    const options = [...html.matchAll(/<button[^>]*role="option"[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);

    assert.equal(options.length, 2);
    assert.match(options[0], /aria-current="true"/);
    assert.match(options[0], /min-h-14 [^"]*rounded-md/);
    assert.match(options[0], /원장표기/);
    assert.match(options[0], /최근 방문 2026-06-20/);
    assert.doesNotMatch(options[0], /090111/);
    assert.match(options[1], /aria-selected="true"/);
    assert.match(options[1], /민아 메모/);
    assert.match(html, /aria-activedescendant="customer-option-1"/);
  });

  it("shows the chosen customer's record form and visit history, each history row linking to that call on the ledger", () => {
    const html = renderView({ customer: minah, history: [row()] });
    const panel = html.match(/<aside[^>]*aria-label="민아"[\s\S]*<\/aside>/)?.[0] ?? "";

    assert.match(panel, /고객 정보/);
    assert.match(panel, /name="customerId" value="customer-1"/);
    assert.match(panel, /value="민아"/);
    assert.match(panel, /value="090111"/);
    assert.match(panel, /value="단골"/);
    assert.match(panel, />고치기</);
    assert.match(panel, /방문 이력/);
    for (const header of ["날짜", "예약시각", "코스", "Therapist", "상태", "고객/메모"]) {
      assert.match(panel, new RegExp(`<th[^>]*>${header}</th>`));
    }
    assert.match(panel, /A A 누루60/);
    assert.match(panel, /마사지사1/);
    assert.match(panel, />예약</);
    assert.match(panel, /잠긴 달/);
    assert.match(panel, /href="\/calls\?operatingMonthId=month-locked&amp;serviceDate=2026-07-02&amp;call=call-1">2026-07-02</);
    assert.match(panel, />닫기</);

    const vietnamese = renderView({ customer: minah, history: [row()] }, "vi");
    assert.match(vietnamese, /Thông tin khách/);
    assert.match(vietnamese, /Lịch sử ghé/);
    assert.match(vietnamese, /Giờ đặt/);
    assert.match(vietnamese, /Khách\/Ghi chú/);
    assert.match(vietnamese, />Đặt trước</);
    assert.match(vietnamese, />Sửa</);
  });

  it("shows only the history for a call memo that has no customer record", () => {
    const html = renderView({ selectedMemo: "민아 메모", history: [row({ customerMemo: "민아 메모" })] });
    const panel = html.match(/<aside[^>]*aria-label="민아 메모"[\s\S]*<\/aside>/)?.[0] ?? "";

    assert.match(panel, /고객 기록이 없는 콜 표기입니다/);
    assert.doesNotMatch(panel, /<form/);
    assert.match(panel, /방문 이력/);
  });

  it("says so when the chosen customer has no visits", () => {
    assert.match(renderView({ customer: minah, history: [] }), /방문 이력이 없습니다\./);
  });
});
