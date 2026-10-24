import assert from "node:assert/strict";
import { it } from "node:test";
import { loadCustomerVisitSummary, loadTherapistAvailability, searchCustomerLinkCandidates } from "./call-queries";

it("uses cancellable HTTP reads and keeps availability's automatic cleaning on POST", async (context) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  context.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    return Response.json(init?.method === "POST" ? { rows: [], seats: [], finishedCallIds: [] } : []);
  });
  const controller = new AbortController();
  await searchCustomerLinkCandidates("a & b", controller.signal);
  await loadCustomerVisitSummary("customer-1", controller.signal);
  const input = { operatingMonthId: "month-1", serviceDate: "2026-06-10", time: "11:00" };
  await loadTherapistAvailability(input, controller.signal);
  assert.equal(new URL(requests[0].url, "http://local").searchParams.get("query"), "a & b");
  assert.deepEqual(requests.map(({ init }) => init?.method), ["GET", "GET", "POST"]);
  assert.ok(requests.every(({ init }) => init?.signal === controller.signal && init.cache === "no-store"));
  assert.deepEqual(JSON.parse(requests[2].init?.body as string), input);
});

it("rejects failed queries so a lookup cannot be mistaken for an empty successful result", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("Unauthorized", { status: 401 }));
  await assert.rejects(searchCustomerLinkCandidates("a"), /Call query failed/);
});
