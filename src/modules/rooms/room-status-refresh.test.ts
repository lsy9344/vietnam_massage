import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";

describe("latestRoomStatusUpdatedAt", () => {
  it("객실 상태가 있으면 렌더 시각이 아니라 상태 데이터의 최신 updatedAt을 반환한다", () => {
    const latest = latestRoomStatusUpdatedAt(
      [
        { updatedAt: "2026-06-10T09:00:00.000Z" },
        { updatedAt: "2026-06-10T09:05:00.000Z" }
      ],
      "2026-06-10T10:00:00.000Z"
    );

    assert.equal(latest, "2026-06-10T09:05:00.000Z");
  });

  it("객실 상태가 없을 때만 fallback 시각을 사용한다", () => {
    assert.equal(latestRoomStatusUpdatedAt([], "2026-06-10T10:00:00.000Z"), "2026-06-10T10:00:00.000Z");
  });
});
