import { ScreenState } from "@/components/ui/screen-state";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { CustomerVisitCandidateDto } from "@/modules/calls/service-call-service";

const cellClassName = "border-b border-border px-3 py-2";

/** 검색 후보 목록에서 지금 고른 고객(또는 고객 기록이 없는 콜의 고객/메모)인지. 목록·비교 표가 같이 쓴다. */
export function isCustomerCandidateChosen(
  candidate: CustomerVisitCandidateDto,
  selectedCustomerId: string | null,
  selectedMemo: string | null
) {
  return (
    (candidate.kind === "customer" && candidate.customerId !== null && candidate.customerId === selectedCustomerId) ||
    (candidate.kind === "memo" && selectedMemo !== null && candidate.label === selectedMemo)
  );
}

/**
 * 같은 연락처 경고 + 후보 비교 표(B09, 스토리 78-80). 검색 후보 중 숫자만 비교한 연락처가 둘 이상 같으면 쓴다.
 * 자동 연결·병합은 없고, 이름·연락처·최근 방문일·방문완료 건수를 나란히 두어 직접 고르게 한다.
 * 콜 서비스 검색(searchCustomerVisitCandidates)의 결과를 그대로 받으므로, 빠른 예약의 고객 단계(티켓 24)와
 * 콜 상세의 고객 연결 정정(티켓 25)도 이 컴포넌트를 재사용한다.
 */
export function CustomerCandidateCompare({
  candidates,
  activeIndex,
  locale,
  label,
  listboxId,
  selectedCustomerId,
  selectedMemo,
  onSelect
}: {
  candidates: CustomerVisitCandidateDto[];
  activeIndex: number;
  locale: Locale;
  /** 바깥 검색 캡슐의 라벨(aria-label). 화면마다 다른 문구를 쓸 수 있다. */
  label: string;
  /** 바깥 combobox의 aria-controls가 가리키는 id. */
  listboxId: string;
  selectedCustomerId: string | null;
  selectedMemo: string | null;
  onSelect: (candidate: CustomerVisitCandidateDto) => void;
}) {
  return (
    <>
      <ScreenState kind="warning" label={t(locale, "customers.duplicatePhone.chip")} title={t(locale, "customers.duplicatePhone.title")} />
      <div aria-label={label} className="overflow-x-auto rounded-md border border-border bg-surface" id={listboxId} role="listbox">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className={cellClassName} scope="col">
                {t(locale, "calls.customer.field.name")}
              </th>
              <th className={cellClassName} scope="col">
                {t(locale, "calls.customer.field.phone")}
              </th>
              <th className={cellClassName} scope="col">
                {t(locale, "customers.compare.column.latestVisit")}
              </th>
              <th className={`${cellClassName} text-right`} scope="col">
                {t(locale, "customers.compare.column.completedVisits")}
              </th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate, index) => {
              const chosen = isCustomerCandidateChosen(candidate, selectedCustomerId, selectedMemo);
              const active = index === activeIndex;
              return (
                <tr
                  className={chosen ? "bg-readonly [box-shadow:inset_3px_0_0_var(--brand)]" : "hover:bg-readonly"}
                  key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`}
                >
                  <td className={cellClassName}>
                    <button
                      aria-current={chosen ? "true" : undefined}
                      aria-selected={active}
                      className="min-h-11 text-left font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                      id={`customer-option-${index}`}
                      onClick={() => onSelect(candidate)}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      {candidate.label}
                    </button>
                  </td>
                  <td className={cellClassName}>{candidate.phone ?? ""}</td>
                  <td className={cellClassName}>{candidate.latestVisitDate ?? ""}</td>
                  <td className={`${cellClassName} text-right`}>{candidate.completedVisitCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
