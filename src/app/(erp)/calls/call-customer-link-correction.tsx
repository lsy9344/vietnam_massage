"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { DetailRow } from "@/components/ui/detail-row";
import { ScreenState } from "@/components/ui/screen-state";
import { CustomerCandidateCompare, customerCandidateOptionId, isCustomerCandidateChosen } from "@/components/domain/customer-candidate-compare";
import { useLocale, useT } from "@/lib/i18n/client";
import type { CustomerDto, CustomerVisitCandidateDto, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import {
  correctServiceCallCustomerLinkAction,
  reloadServiceCallRowAction,
  searchCustomerLinkCandidatesAction,
  type ServiceCallCustomerLinkCorrectionActionState
} from "@/app/(erp)/calls/actions";
import { CUSTOMER_SEARCH_DEBOUNCE_MS, customerScreenHref, moveCandidateIndex } from "@/app/(erp)/customers/customer-search";
import { usePhoneWidth } from "@/app/(erp)/calls/phone-width";

/**
 * 편집 패널 "더 보기"의 고객 연결 정정(F06, ADR 0003, 스토리 81-83). 원장 행 저장과는 별개의 전용 작업이라
 * 콜의 고객/메모(customerMemo)는 바꾸지 않고 customerId 연결만 바꾼다. 새 고객 후보는 22의 비교
 * 정보(CustomerCandidateCompare/같은 연락처 경고/방문완료 건수)로 고르며 자동 연결은 없다.
 *
 * 휴대폰 폭(티켓 26)에서는 "지금 연결"·"고객 화면으로 이동"만 보이고, 잠금 안내와 정정 폼은 그리지
 * 않는다(명세 F08 — 카드 목록에서 연 패널은 읽기 형태로 남는다).
 *
 * 부르는 쪽은 `key={row.id}`로 이 컴포넌트를 둬야 콜을 바꿀 때 초안이 깨끗이 다시 시작된다. 같은 콜에서
 * 정정이 성공하면(또는 "다시 불러오기"로 최신 행을 받으면) 컴포넌트는 그대로 두고 아래 effect로 바뀐
 * customerId만 다시 반영한다 — 리마운트하면 막 보여 준 "고객 연결을 정정했습니다." 안내가 바로 사라진다.
 */
export function CallCustomerLinkCorrection({
  customers,
  isLocked,
  row,
  onCorrected
}: {
  customers: CustomerDto[];
  isLocked: boolean;
  row: ServiceCallRowDto;
  onCorrected: (row: ServiceCallRowDto) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const isPhoneWidth = usePhoneWidth();
  const linkedCustomer = row.customerId ? customers.find((customer) => customer.id === row.customerId) ?? null : null;
  const customerScreenTarget = linkedCustomer
    ? customerScreenHref({ customerQuery: "", visitCustomer: linkedCustomer.id })
    : row.customerMemo
      ? customerScreenHref({ customerQuery: "", visitMemo: row.customerMemo })
      : customerScreenHref({ customerQuery: "" });

  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(row.customerId ?? null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(linkedCustomer?.name ?? null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [candidates, setCandidates] = useState<CustomerVisitCandidateDto[]>([]);
  const searchTimer = useRef<number | null>(null);
  const searchRequestId = useRef(0);
  // 후보 중 실제 고객 레코드가 있는 것만 보여 준다. 고객 기록이 없는 콜의 고객/메모(memo 후보)는
  // 연결할 customerId가 없어 이 정정의 대상이 아니다.
  const customerCandidates = candidates.filter(
    (candidate): candidate is CustomerVisitCandidateDto & { customerId: string } => candidate.kind === "customer" && candidate.customerId !== null
  );

  // 콜을 바꾸거나(주소의 콜 id가 바뀌어도 이 콜이 다시 보임) 이 콜의 연결이 바뀌면(정정 성공, 다시
  // 불러오기) 바꿀 값의 기본값과 검색 초안을 그 최신 값으로 다시 맞춘다.
  useEffect(() => {
    const nextLinked = row.customerId ? customers.find((customer) => customer.id === row.customerId) ?? null : null;
    setPendingCustomerId(row.customerId ?? null);
    setPendingLabel(nextLinked?.name ?? null);
    setQuery("");
    setCandidates([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.customerId]);

  useEffect(() => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setCandidates([]);
      return;
    }
    const requestId = ++searchRequestId.current;
    searchTimer.current = window.setTimeout(() => {
      searchCustomerLinkCandidatesAction(trimmed).then((result) => {
        if (searchRequestId.current === requestId) setCandidates(result);
      });
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, [query]);

  const [state, formAction, pending] = useActionState<ServiceCallCustomerLinkCorrectionActionState, FormData>(
    async (previousState, formData) => {
      const result = await correctServiceCallCustomerLinkAction(previousState, formData);
      if (result?.ok) {
        // row prop이 새 customerId로 바뀌면 위 effect가 pendingCustomerId·검색 초안을 다시 맞춘다.
        onCorrected(result.data);
      }
      return result;
    },
    null
  );
  const stale = state && !state.ok && state.domainErrorCode === "STALE_CALL" ? state : null;
  const reasonError = state && !state.ok && "fieldErrors" in state ? state.fieldErrors?.reason?.[0] ?? null : null;
  const [reloading, setReloading] = useState(false);

  async function reloadLatest() {
    setReloading(true);
    try {
      const result = await reloadServiceCallRowAction(row.id);
      if (result.ok) onCorrected(result.data);
    } finally {
      setReloading(false);
    }
  }

  function selectCandidate(candidate: CustomerVisitCandidateDto) {
    if (candidate.kind !== "customer" || !candidate.customerId) return;
    setActiveIndex(-1);
    setPendingCustomerId(candidate.customerId);
    setPendingLabel(candidate.label);
  }

  function unlink() {
    setPendingCustomerId(null);
    setPendingLabel(null);
  }

  return (
    <div className="grid gap-3">
      <dl>
        <DetailRow
          label={t("calls.detail.customerLink.current")}
          value={
            linkedCustomer
              ? [linkedCustomer.name, linkedCustomer.phone].filter((part) => part && part.trim() !== "").join(" · ")
              : t("calls.detail.customerLink.unlinked")
          }
        />
      </dl>
      <a
        className="justify-self-start text-sm font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
        href={customerScreenTarget}
      >
        {t("calls.detail.customerLink.goToCustomerScreen")}
      </a>

      {isPhoneWidth ? null : isLocked ? (
        <ScreenState kind="locked" label={t("common.screenState.locked")} title={t("calls.detail.customerLink.locked")} />
      ) : (
        <form action={formAction} className="grid gap-3" noValidate>
          <input name="serviceCallId" type="hidden" value={row.id} />
          <input name="expectedUpdatedAt" type="hidden" value={row.updatedAt} />
          <input name="customerId" type="hidden" value={pendingCustomerId ?? ""} />

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">
              {pendingCustomerId
                ? t("calls.detail.customerLink.pendingSelected", { customer: pendingLabel ?? pendingCustomerId })
                : t("calls.detail.customerLink.pendingUnlinked")}
            </span>
            <Button className="justify-self-start" disabled={pendingCustomerId === null} onClick={unlink} type="button" variant="secondary">
              {t("calls.detail.customerLink.unlinkAction")}
            </Button>
          </div>

          <label className="grid gap-1.5" htmlFor="customer-link-search">
            <span className="text-sm font-semibold text-foreground">{t("calls.detail.customerLink.searchLabel")}</span>
            <input
              aria-activedescendant={activeIndex >= 0 && activeIndex < customerCandidates.length ? customerCandidateOptionId("customer-link-candidates", activeIndex) : undefined}
              aria-autocomplete="list"
              aria-controls={customerCandidates.length > 0 ? "customer-link-candidates" : undefined}
              aria-expanded={customerCandidates.length > 0}
              autoComplete="off"
              className={inputFieldClassName({ className: "w-full" })}
              id="customer-link-search"
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.key === "Process") return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => moveCandidateIndex(current, event.key as "ArrowDown" | "ArrowUp", customerCandidates.length));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const candidate = customerCandidates[activeIndex];
                  if (candidate) selectCandidate(candidate);
                } else if (event.key === "Escape") {
                  setQuery("");
                  setActiveIndex(-1);
                }
              }}
              role="combobox"
              type="text"
              value={query}
            />
          </label>

          {customerCandidates.length > 0 ? (
            customerCandidates.some((candidate) => candidate.sharedPhone) ? (
              <CustomerCandidateCompare
                activeIndex={activeIndex}
                candidates={customerCandidates}
                label={t("calls.detail.customerLink.searchLabel")}
                listboxId="customer-link-candidates"
                locale={locale}
                onSelect={selectCandidate}
                selectedCustomerId={pendingCustomerId}
                selectedMemo={null}
              />
            ) : (
              <ul aria-label={t("calls.detail.customerLink.searchLabel")} className="grid gap-2" id="customer-link-candidates" role="listbox">
                {customerCandidates.map((candidate, index) => {
                  const chosen = isCustomerCandidateChosen(candidate, pendingCustomerId, null);
                  return (
                    <li key={candidate.customerId} role="presentation">
                      <button
                        aria-selected={index === activeIndex}
                        id={customerCandidateOptionId("customer-link-candidates", index)}
                        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-4 py-2 text-left text-sm transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary ${
                          chosen ? "bg-readonly [box-shadow:inset_3px_0_0_var(--brand)]" : "bg-surface"
                        }`}
                        onClick={() => selectCandidate(candidate)}
                        role="option"
                        type="button"
                      >
                        <span className="font-semibold text-foreground">{candidate.label}</span>
                        <span className="text-xs text-muted">{candidate.phone ?? ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          <label className="grid gap-1.5" htmlFor="customer-link-reason">
            <span className="text-sm font-semibold text-foreground">{t("calls.detail.customerLink.reasonLabel")}</span>
            <textarea
              aria-describedby={reasonError ? "customer-link-reason-error" : undefined}
              aria-invalid={reasonError ? true : undefined}
              className={inputFieldClassName({ className: "h-20 py-2", invalid: Boolean(reasonError) })}
              id="customer-link-reason"
              name="reason"
            />
            {reasonError ? (
              <span className="text-sm text-danger" id="customer-link-reason-error" role="alert">
                {reasonError}
              </span>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={pending} type="submit">
              {t("calls.detail.customerLink.submit")}
            </Button>
            {state?.ok ? (
              <span className="text-sm text-success" role="status">
                {t("calls.detail.customerLink.success")}
              </span>
            ) : state && !state.ok && !stale && !reasonError ? (
              <span className="text-sm text-danger" role="alert">
                {state.formError}
              </span>
            ) : null}
          </div>

          {stale ? (
            <div className="grid gap-2">
              <span className="text-sm text-warning" role="alert">
                {stale.formError}
              </span>
              <Button className="justify-self-start" disabled={reloading} onClick={reloadLatest} type="button" variant="secondary">
                {t("calls.save.reloadLatest")}
              </Button>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
