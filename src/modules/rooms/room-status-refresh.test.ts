import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  businessHourAt,
  isWithinLiveRefreshWindow,
  latestRoomStatusUpdatedAt
} from "@/modules/rooms/room-status-refresh";

/** 매장 현지(UTC+7) 시각을 UTC ISO 문자열로 바꾼다. */
function atBusinessLocalTime(isoLocal: string) {
  return new Date(`${isoLocal}+07:00`);
}

describe("businessHourAt", () => {
  it("브라우저 시간대와 무관하게 매장 현지 시각의 시를 돌려준다", () => {
    // 2026-06-10T17:30+07:00 == 2026-06-10T10:30Z
    assert.equal(businessHourAt(new Date("2026-06-10T10:30:00.000Z")), 17);
  });

  it("자정을 넘긴 시각도 매장 현지 기준으로 판단한다", () => {
    // 2026-06-11T00:30+07:00 == 2026-06-10T17:30Z
    assert.equal(businessHourAt(new Date("2026-06-10T17:30:00.000Z")), 0);
  });
});

describe("isWithinLiveRefreshWindow", () => {
  it("영업 시작(11:00)부터 자정까지는 자동 갱신을 돌린다", () => {
    for (const local of ["2026-06-10T11:00:00", "2026-06-10T19:00:00", "2026-06-10T23:59:00"]) {
      assert.equal(isWithinLiveRefreshWindow(atBusinessLocalTime(local)), true, local);
    }
  });

  it("자정을 넘겨 마지막 콜이 끝나는 03:00 직전까지도 자동 갱신을 유지한다", () => {
    for (const local of ["2026-06-11T00:00:00", "2026-06-11T01:00:00", "2026-06-11T02:59:00"]) {
      assert.equal(isWithinLiveRefreshWindow(atBusinessLocalTime(local)), true, local);
    }
  });

  it("마감 후(03:00~11:00)에는 자동 갱신을 멈춘다", () => {
    for (const local of ["2026-06-11T03:00:00", "2026-06-11T07:00:00", "2026-06-11T10:59:00"]) {
      assert.equal(isWithinLiveRefreshWindow(atBusinessLocalTime(local)), false, local);
    }
  });

  it("서버 시간대가 매장과 달라도 판단이 흔들리지 않는다", () => {
    // 한국(UTC+9) 정오 = 베트남(UTC+7) 오전 10시 → 아직 영업 전
    assert.equal(isWithinLiveRefreshWindow(new Date("2026-06-11T03:00:00.000Z")), false);
  });
});

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
