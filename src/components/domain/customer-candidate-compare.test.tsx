import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerCandidateCompare, isCustomerCandidateChosen } from "@/components/domain/customer-candidate-compare";
import type { CustomerVisitCandidateDto } from "@/modules/calls/service-call-service";

function candidate(overrides: Partial<CustomerVisitCandidateDto> = {}): CustomerVisitCandidateDto {
  return {
    kind: "customer",
    customerId: "customer-1",
    label: "민아",
    phone: "090-111-2222",
    latestVisitDate: "2026-06-20",
    completedVisitCount: 2,
    sharedPhone: true,
    ...overrides
  };
}

describe("isCustomerCandidateChosen", () => {
  it("고른 고객 id나 고객 기록이 없는 콜의 메모와 같은 후보만 true다", () => {
    assert.equal(isCustomerCandidateChosen(candidate(), "customer-1", null), true);
    assert.equal(isCustomerCandidateChosen(candidate(), "customer-2", null), false);
    assert.equal(isCustomerCandidateChosen(candidate(), null, null), false);
    const memo = candidate({ kind: "memo", customerId: null, label: "민아 메모", phone: null });
    assert.equal(isCustomerCandidateChosen(memo, null, "민아 메모"), true);
    assert.equal(isCustomerCandidateChosen(memo, null, "다른 메모"), false);
  });
});

describe("CustomerCandidateCompare(B09, 스토리 78-80)", () => {
  it("같은 연락처 경고와 이름·연락처·최근 방문일·방문완료 건수 비교 표를 보이고, 고르거나 키보드로 짚은 후보에 표시를 남긴다", () => {
    const html = renderToStaticMarkup(
      <CustomerCandidateCompare
        activeIndex={1}
        candidates={[
          candidate({ customerId: "customer-1", label: "민아", phone: "090-111-2222", completedVisitCount: 2, latestVisitDate: "2026-06-20" }),
          candidate({ customerId: "customer-2", label: "리민", phone: "0901112222", completedVisitCount: 5, latestVisitDate: "2026-05-01" })
        ]}
        label="고객 검색"
        listboxId="candidates"
        locale="ko"
        onSelect={() => undefined}
        selectedCustomerId="customer-2"
        selectedMemo={null}
      />
    );

    assert.match(html, /role="alert"[^>]*>[\s\S]*같은 연락처의 고객이 여러 명입니다/);
    assert.match(html, /<div aria-label="고객 검색"[^>]*id="candidates"[^>]*role="listbox"/);
    for (const header of ["이름", "연락처", "최근 방문일", "방문완료 건수"]) {
      assert.match(html, new RegExp(`<span[^>]*>${header}</span>`));
    }

    const options = [...html.matchAll(/<button[^>]*role="option"[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
    assert.equal(options.length, 2);
    assert.doesNotMatch(options[0], /aria-current/);
    assert.doesNotMatch(options[0], /aria-selected="true"/);
    assert.match(options[0], />민아</);
    assert.match(options[1], /aria-current="true"/);
    assert.match(options[1], /aria-selected="true"/);
    assert.match(options[1], />리민</);
    assert.match(html, /090-111-2222/);
    assert.match(html, />2</);
    assert.match(html, />5</);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(
      <CustomerCandidateCompare
        activeIndex={-1}
        candidates={[candidate(), candidate({ customerId: "customer-2", label: "리민" })]}
        label="Tìm khách"
        listboxId="candidates"
        locale="vi"
        onSelect={() => undefined}
        selectedCustomerId={null}
        selectedMemo={null}
      />
    );

    assert.match(html, /Có nhiều khách hàng dùng cùng một số liên lạc\./);
    assert.match(html, /<span[^>]*>Tên<\/span>/);
    assert.match(html, /<span[^>]*>Số liên lạc<\/span>/);
  });
});
