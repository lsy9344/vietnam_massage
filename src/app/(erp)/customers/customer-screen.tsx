"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CustomerScreenView } from "@/app/(erp)/customers/customer-screen-view";
import { CUSTOMER_SEARCH_DEBOUNCE_MS, customerScreenHref, moveCandidateIndex } from "@/app/(erp)/customers/customer-search";
import { useLocale } from "@/lib/i18n/client";
import type {
  CustomerDto,
  CustomerVisitCandidateDto,
  CustomerVisitCountsDto,
  CustomerVisitHistoryRowDto
} from "@/modules/calls/service-call-service";

export function CustomerScreen({
  query,
  candidates,
  customer,
  visitMemo,
  visitCounts,
  history,
  selectedSharedPhone
}: {
  query: string;
  candidates: CustomerVisitCandidateDto[];
  customer: CustomerDto | null;
  visitMemo: string | null;
  visitCounts: CustomerVisitCountsDto | null;
  history: CustomerVisitHistoryRowDto[];
  /** S5: 검색 결과 없이 바로 고른 고객의 같은 연락처 경고. */
  selectedSharedPhone: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [draft, setDraft] = useState(query);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputFocused = useRef(false);
  const commitTimer = useRef<number | null>(null);
  const candidateKey = candidates.map((candidate) => `${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`).join("|");
  const visitCustomer = customer?.id ?? null;
  const [seenCandidateKey, setSeenCandidateKey] = useState(candidateKey);
  // 후보가 바뀌면 키보드로 고르던 자리를 처음으로 되돌린다.
  if (seenCandidateKey !== candidateKey) {
    setSeenCandidateKey(candidateKey);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (!inputFocused.current) setDraft(query);
  }, [query]);

  useEffect(() => {
    if (draft.trim() === query) return;
    commitTimer.current = window.setTimeout(() => {
      router.replace(customerScreenHref({ customerQuery: draft, visitCustomer, visitMemo }), { scroll: false });
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    };
  }, [draft, query, router, visitCustomer, visitMemo]);

  function select(candidate: CustomerVisitCandidateDto) {
    if (draft.trim() !== query) return;
    // 후보를 고르면 검색어를 바로 주소에 남긴다. 기다리던 입력이 선택을 지우면 안 된다.
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    const next =
      candidate.kind === "customer" && candidate.customerId
        ? { customerQuery: draft, visitCustomer: candidate.customerId }
        : { customerQuery: draft, visitMemo: candidate.label };
    router.replace(customerScreenHref(next), { scroll: false });
  }

  function onQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.key === "Process") return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const key = event.key;
      event.preventDefault();
      setActiveIndex((current) => moveCandidateIndex(current, key, candidates.length));
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const candidate = candidates[activeIndex];
    if (candidate) select(candidate);
  }

  return (
    <CustomerScreenView
      activeIndex={activeIndex}
      candidates={candidates}
      customer={customer}
      history={history}
      locale={locale}
      onClose={() => router.replace(customerScreenHref({ customerQuery: query }), { scroll: false })}
      onQueryBlur={() => {
        inputFocused.current = false;
      }}
      onQueryChange={setDraft}
      onQueryFocus={() => {
        inputFocused.current = true;
      }}
      onQueryKeyDown={onQueryKeyDown}
      onSelect={select}
      query={draft}
      selectedMemo={customer ? null : visitMemo}
      selectedSharedPhone={selectedSharedPhone}
      settledQuery={query}
      visitCounts={visitCounts}
    />
  );
}
