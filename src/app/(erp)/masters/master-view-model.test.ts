import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countActive, masterItemHref, readMasterItem } from "@/app/(erp)/masters/master-view-model";

describe("기준정보 화면의 고른 항목 주소", () => {
  it("주소의 item 값을 그대로 고른 항목으로 읽는다", () => {
    assert.equal(readMasterItem("room-1"), "room-1");
    assert.equal(readMasterItem("  room-1 "), "room-1");
  });

  it("없거나 빈 값, 여러 값은 고르지 않은 것으로 본다", () => {
    assert.equal(readMasterItem(undefined), null);
    assert.equal(readMasterItem(""), null);
    assert.equal(readMasterItem("   "), null);
    assert.equal(readMasterItem(["a", "b"]), null);
  });

  it("다른 매개변수를 두고 item만 넣거나 뺀다", () => {
    assert.equal(masterItemHref("http://x/masters/rooms?a=1", "room-1"), "/masters/rooms?a=1&item=room-1");
    assert.equal(masterItemHref("http://x/masters/rooms?a=1&item=room-1", null), "/masters/rooms?a=1");
    assert.equal(masterItemHref("http://x/masters/rooms?item=room-1", null), "/masters/rooms");
  });
});

describe("활성·비활성 수", () => {
  it("활성과 비활성을 따로 센다", () => {
    assert.deepEqual(countActive([{ isActive: true }, { isActive: false }, { isActive: true }]), { active: 2, inactive: 1 });
    assert.deepEqual(countActive([]), { active: 0, inactive: 0 });
  });
});
