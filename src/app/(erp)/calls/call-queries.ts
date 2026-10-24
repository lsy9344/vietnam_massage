import type {
  CustomerVisitCandidateDto, CustomerVisitCountsDto, CustomerVisitHistoryRowDto,
  SeatPointDto, TherapistAvailabilityRowDto
} from "@/modules/calls/service-call-service";

async function query<T>(params: URLSearchParams | object, signal?: AbortSignal): Promise<T> {
  const get = params instanceof URLSearchParams;
  const response = await fetch(`/api/calls/query${get ? `?${params}` : ""}`, {
    method: get ? "GET" : "POST", cache: "no-store", signal,
    ...(get ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) })
  });
  if (!response.ok) throw new Error("Call query failed");
  return response.json() as Promise<T>;
}

export function searchCustomerLinkCandidates(search: string, signal?: AbortSignal) {
  return query<CustomerVisitCandidateDto[]>(new URLSearchParams({ kind: "customers", query: search }), signal);
}

export function loadCustomerVisitSummary(customerId: string, signal?: AbortSignal) {
  return query<{ counts: CustomerVisitCountsDto; recentVisit: CustomerVisitHistoryRowDto | null; sharedPhone: boolean }>(
    new URLSearchParams({ kind: "visit-summary", customerId }), signal
  );
}

export async function loadTherapistAvailability(input: { operatingMonthId: string; serviceDate: string; time: string; excludeCallId?: string }, signal?: AbortSignal) {
  const result = await query<{ rows: TherapistAvailabilityRowDto[]; seats: SeatPointDto[]; finishedCallIds: string[] }>(input, signal);
  if (result.finishedCallIds.length > 0) window.dispatchEvent(new Event("calls:refresh"));
  return result;
}
