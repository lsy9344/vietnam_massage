import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasDomainErrorTranslation, resolveDomainErrorMessage } from "@/lib/i18n/errors";

describe("resolveDomainErrorMessage", () => {
  it("vi이고 매핑된 code면 vi 번역을 반환한다", () => {
    assert.equal(
      resolveDomainErrorMessage("vi", "OPERATING_MONTH_DATE_OUT_OF_RANGE", "운영월 범위를 벗어난 날짜입니다."),
      "Ngày nằm ngoài phạm vi tháng vận hành."
    );
  });

  it("ko면 항상 한국어 원문(fallback)을 반환한다", () => {
    assert.equal(
      resolveDomainErrorMessage("ko", "OPERATING_MONTH_DATE_OUT_OF_RANGE", "운영월 범위를 벗어난 날짜입니다."),
      "운영월 범위를 벗어난 날짜입니다."
    );
  });

  it("매핑이 없는 code(내부 전용)는 vi여도 한국어 원문을 유지한다", () => {
    assert.equal(
      resolveDomainErrorMessage("vi", "SOME_INTERNAL_CODE", "내부 오류입니다."),
      "내부 오류입니다."
    );
  });

  it("code가 undefined면 한국어 원문을 유지한다", () => {
    assert.equal(resolveDomainErrorMessage("vi", undefined, "오류입니다."), "오류입니다.");
  });

  it("hasDomainErrorTranslation은 매핑 여부를 알려준다", () => {
    assert.equal(hasDomainErrorTranslation("ROOM_REQUIRED_FOR_STATUS"), true);
    assert.equal(hasDomainErrorTranslation("NOPE"), false);
  });
});
