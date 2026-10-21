import { ScreenState } from "@/components/ui/screen-state";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { CustomerVisitCandidateDto } from "@/modules/calls/service-call-service";

export function customerCandidateOptionId(listboxId: string, index: number) {
  return `${listboxId}-option-${index}`;
}

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
        <div className="min-w-[32rem]" role="presentation">
          <div aria-hidden="true" className="grid grid-cols-4 gap-3 border-b border-border bg-readonly px-3 py-2 text-xs font-semibold text-muted">
            <span>{t(locale, "calls.customer.field.name")}</span>
            <span>{t(locale, "calls.customer.field.phone")}</span>
            <span>{t(locale, "customers.compare.column.latestVisit")}</span>
            <span className="text-right">{t(locale, "customers.compare.column.completedVisits")}</span>
          </div>
          {candidates.map((candidate, index) => {
            const chosen = isCustomerCandidateChosen(candidate, selectedCustomerId, selectedMemo);
            return (
              <button
                aria-current={chosen ? "true" : undefined}
                aria-selected={index === activeIndex}
                className={`grid min-h-11 w-full grid-cols-4 items-center gap-3 border-b border-border px-3 py-2 text-left text-sm text-foreground hover:bg-readonly focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-secondary ${chosen ? "bg-readonly [box-shadow:inset_3px_0_0_var(--brand)]" : ""}`}
                id={customerCandidateOptionId(listboxId, index)}
                key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`}
                onClick={() => onSelect(candidate)}
                role="option"
                tabIndex={activeIndex < 0 ? 0 : -1}
                type="button"
              >
                <span className="font-semibold underline underline-offset-4">{candidate.label}</span>
                <span>{candidate.phone ?? ""}</span>
                <span>{candidate.latestVisitDate ?? ""}</span>
                <span className="text-right tabular-nums">{candidate.completedVisitCount}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
