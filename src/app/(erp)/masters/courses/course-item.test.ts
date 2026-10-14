import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { courseItemKey, parseCourseItem } from "@/app/(erp)/masters/courses/course-item";

describe("코스·수당 화면에서 고른 항목", () => {
  it("코스, 수당 칸, 일·월 인센 규칙을 주소 값 하나로 오간다", () => {
    const items = [
      { kind: "course", courseId: "c1" },
      { kind: "rate", therapistId: "t1", courseId: "c1" },
      { kind: "daily", ruleId: "d1" },
      { kind: "monthly", ruleId: "m1" }
    ] as const;
    for (const item of items) {
      assert.deepEqual(parseCourseItem(courseItemKey(item)), item);
    }
  });

  it("모르는 값은 고르지 않은 것으로 본다", () => {
    assert.equal(parseCourseItem(null), null);
    assert.equal(parseCourseItem("c1"), null);
    assert.equal(parseCourseItem("course:"), null);
    assert.equal(parseCourseItem("rate:t1"), null);
    assert.equal(parseCourseItem("rate:t1:c1:x"), null);
    assert.equal(parseCourseItem("other:x"), null);
  });
});
