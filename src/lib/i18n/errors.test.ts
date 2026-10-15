import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasDomainErrorTranslation, resolveDomainErrorMessage, resolveKoreanMessage } from "@/lib/i18n/errors";

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

  it("다른 화면이 먼저 저장한 콜의 거절 문구가 두 언어로 있다", () => {
    const ko = "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.";
    assert.equal(resolveDomainErrorMessage("ko", "STALE_CALL", ko), ko);
    assert.equal(resolveDomainErrorMessage("vi", "STALE_CALL", ko), "Cuộc gọi này đã được thay đổi ở màn hình khác. Hãy tải lại rồi mới lưu.");
  });

  it("hasDomainErrorTranslation은 매핑 여부를 알려준다", () => {
    assert.equal(hasDomainErrorTranslation("ROOM_REQUIRED_FOR_STATUS"), true);
    assert.equal(hasDomainErrorTranslation("NOPE"), false);
  });
});

describe("resolveKoreanMessage", () => {
  it("지출 수단 오류를 베트남어로 바꾸고 한국어는 그대로 둔다", () => {
    assert.equal(resolveKoreanMessage("vi", "수단은 현금 또는 계좌입니다."), "Hình thức là tiền mặt hoặc chuyển khoản.");
    assert.equal(resolveKoreanMessage("ko", "수단은 현금 또는 계좌입니다."), "수단은 현금 또는 계좌입니다.");
  });
});
