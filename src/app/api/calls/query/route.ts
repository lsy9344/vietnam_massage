import { z } from "zod";
import { canAccessRoute, canPerform, getAuthorizedAccount } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { isSameOriginCallQuery } from "./request-origin";
import {
  autoFinishOverdueCalls, customerSharedPhone, customerVisitCountsFromRows,
  listCustomerVisitHistory, listTherapistAvailabilityWithSeats, mostRecentCustomerVisit,
  searchCustomerVisitCandidates, timeSlotSortOrderMap
} from "@/modules/calls/service-call-service";

const id = z.string().trim().min(1).max(200);
const availabilityInput = z.object({
  operatingMonthId: id,
  serviceDate: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  excludeCallId: id.optional()
});
const headers = { "Cache-Control": "no-store" };

async function authorize(writePermission = false) {
  const account = await getAuthorizedAccount();
  if (!account || !canAccessRoute(account.role, "/calls") || (writePermission && !canPerform(account.role, "call:write"))) {
    return Response.json({ error: t(await getLocale(), "action.error.noPermission") }, { status: account ? 403 : 401, headers });
  }
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const denied = await authorize(kind === "customers");
  if (denied) return denied;
  if (kind === "customers") {
    const query = z.string().trim().max(200).safeParse(params.get("query") ?? "");
    if (!query.success) return Response.json({ error: "Invalid query" }, { status: 400, headers });
    return Response.json(query.data ? await searchCustomerVisitCandidates({ query: query.data }) : [], { headers });
  }
  if (kind === "visit-summary") {
    const customerId = id.safeParse(params.get("customerId"));
    if (!customerId.success) return Response.json({ error: "Invalid customer" }, { status: 400, headers });
    const [rows, sharedPhone, order] = await Promise.all([
      listCustomerVisitHistory({ kind: "customer", customerId: customerId.data }),
      customerSharedPhone({ customerId: customerId.data }), timeSlotSortOrderMap()
    ]);
    return Response.json({ counts: customerVisitCountsFromRows(rows), recentVisit: mostRecentCustomerVisit(rows, order), sharedPhone }, { headers });
  }
  return Response.json({ error: "Invalid query" }, { status: 400, headers });
}

/** Availability can write automatic cleaning transitions (ADR 0008), so it must remain POST. */
export async function POST(request: Request) {
  // Route handlers need their own same-origin check; Server Actions previously provided this.
  if (!isSameOriginCallQuery(request)) return Response.json({ error: "Invalid origin" }, { status: 403, headers });
  const denied = await authorize();
  if (denied) return denied;
  const input = availabilityInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid availability input" }, { status: 400, headers });
  const finishedCallIds = await autoFinishOverdueCalls(input.data);
  return Response.json({ ...await listTherapistAvailabilityWithSeats(input.data), finishedCallIds }, { headers });
}
