import assert from "node:assert/strict";
import { it } from "node:test";
import { mergeConfirmedRows } from "./confirmed-rows";

it("keeps confirmed creates and newer saves when an older server refresh arrives", () => {
  const old = { id: "a", updatedAt: "1", startTime: "11:00", status: "예약" };
  const saved = { ...old, updatedAt: "2", status: "사용중" };
  const created = { id: "b", updatedAt: "2", startTime: "10:00", status: "예약" };
  const rows = mergeConfirmedRows([old], [saved, created], (time) => Number(time.replace(":", "")));
  assert.deepEqual(rows, [created, saved]);
  const refreshed = { ...saved, warning: "updated day warning" };
  assert.equal(mergeConfirmedRows([refreshed], [saved], () => 0)[0], refreshed);
});

it("accepts a newer server version instead of retaining the local confirmation", () => {
  const saved = { id: "a", updatedAt: "2", startTime: "11:00" };
  const server = { ...saved, updatedAt: "3" };
  assert.deepEqual(mergeConfirmedRows([server], [saved], () => 0), [server]);
});
