"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CustomerVisitSearchView } from "@/app/(erp)/calls/customer-visit-search-view";
import {
  CUSTOMER_SEARCH_DEBOUNCE_MS,
  customerVisitSearchPath,
  moveCandidateIndex
} from "@/app/(erp)/calls/customer-visit-search";
import { useLocale } from "@/lib/i18n/client";
import type { CustomerVisitCandidateDto, CustomerVisitHistoryRowDto } from "@/modules/calls/service-call-service";

export function CustomerVisitSearch({
  operatingMonthId,
  serviceDate,
  query,
  candidates,
  rows,
  visitCustomer,
  visitMemo
}: {
  operatingMonthId: string;
  serviceDate: string;
  query: string;
  candidates: CustomerVisitCandidateDto[];
  rows: CustomerVisitHistoryRowDto[];
  visitCustomer: string | null;
  visitMemo: string | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [draft, setDraft] = useState(query);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputFocused = useRef(false);
  const commitTimer = useRef<number | null>(null);
  const candidateKey = candidates.map((candidate) => `${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`).join("|");

  useEffect(() => {
    if (!inputFocused.current) setDraft(query);
  }, [query]);

  useEffect(() => {
    window.history.scrollRestoration = "auto";
  }, []);

  useEffect(() => {
    if (draft.trim() === query) return;
    commitTimer.current = window.setTimeout(() => {
      router.replace(customerVisitSearchPath({ operatingMonthId, serviceDate }, { customerQuery: draft }), { scroll: false });
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    };
  }, [draft, operatingMonthId, query, router, serviceDate]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [candidateKey]);

  function select(candidate: CustomerVisitCandidateDto) {
    if (draft.trim() !== query) return;
    // 후보를 고르면 검색어를 바로 주소에 남긴다. 기다리던 입력이 선택을 지우면 안 된다.
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    const next =
      candidate.kind === "customer" && candidate.customerId
        ? { customerQuery: draft, visitCustomer: candidate.customerId }
        : { customerQuery: draft, visitMemo: candidate.label };
    router.replace(customerVisitSearchPath({ operatingMonthId, serviceDate }, next), { scroll: false });
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
    <CustomerVisitSearchView
      activeIndex={activeIndex}
      candidates={candidates}
      historyOpen={(visitCustomer !== null || visitMemo !== null) && draft.trim() === query}
      locale={locale}
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
      settledQuery={query}
      rows={rows}
      selectedCustomerId={visitCustomer}
      selectedMemo={visitMemo}
    />
  );
}
