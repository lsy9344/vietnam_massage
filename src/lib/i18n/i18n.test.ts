import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultLocale, fallbackLocale, isLocale, normalizeLocale } from "@/lib/i18n/config";
import { getMessages, has, t } from "@/lib/i18n";
import { ko } from "@/lib/i18n/messages/ko";
import { vi } from "@/lib/i18n/messages/vi";
import { codeLabel, operatingMonthStatusLabel, roomStatusLabel } from "@/lib/i18n/codes";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";

describe("i18n config", () => {
  it("기본 locale은 vi, fallback은 ko이다", () => {
    assert.equal(defaultLocale, "vi");
    assert.equal(fallbackLocale, "ko");
  });

  it("isLocale/normalizeLocale은 미지원 값을 기본 locale로 정규화한다", () => {
    assert.equal(isLocale("vi"), true);
    assert.equal(isLocale("en"), false);
    assert.equal(normalizeLocale("ko"), "ko");
    assert.equal(normalizeLocale("xx"), "vi");
    assert.equal(normalizeLocale(undefined), "vi");
  });
});

describe("i18n catalog parity", () => {
  it("vi 카탈로그는 ko의 모든 key를 가진다", () => {
    const koKeys = Object.keys(ko);
    const viKeys = new Set(Object.keys(vi));
    const missing = koKeys.filter((key) => !viKeys.has(key));
    assert.deepEqual(missing, [], `vi에서 누락된 key: ${missing.join(", ")}`);
  });

  it("두 카탈로그 모두 빈 문자열 값이 없다", () => {
    for (const [key, value] of Object.entries(ko)) {
      assert.notEqual(value, "", `ko.${key} 가 빈 문자열`);
    }
    for (const [key, value] of Object.entries(vi)) {
      assert.notEqual(value, "", `vi.${key} 가 빈 문자열`);
    }
  });
});

describe("t()", () => {
  it("locale 문구를 반환한다", () => {
    assert.equal(t("ko", "auth.signIn.submit"), "로그인");
    assert.equal(t("vi", "auth.signIn.submit"), "Đăng nhập");
  });

  it("placeholder를 치환한다", () => {
    assert.equal(t("ko", "roomStatus.aria", { status: "사용중" }), "상태: 사용중");
    assert.equal(t("vi", "roomStatus.aria", { status: "Đang sử dụng" }), "Trạng thái: Đang sử dụng");
  });

  it("has()는 key 존재 여부를 알려준다", () => {
    assert.equal(has("vi", "auth.signIn.submit"), true);
    assert.equal(has("ko", "auth.signIn.submit"), true);
  });

  it("getMessages는 전체 맵을 반환한다", () => {
    assert.equal(getMessages("vi")["auth.signIn.submit"], "Đăng nhập");
  });
});

describe("codeLabel()", () => {
  it("시스템 코드는 dictionary로 번역한다 (DB displayName 무시)", () => {
    // DB displayName이 한국어여도 vi dictionary 라벨을 쓴다.
    assert.equal(codeLabel("vi", "SERVICE_STATUS", "RESERVED", true, "예약"), "Đặt trước");
    assert.equal(codeLabel("ko", "PAYMENT_METHOD", "CASH", true, "현금"), "현금");
  });

  it("custom 코드는 DB displayName을 그대로 쓴다", () => {
    assert.equal(codeLabel("vi", "DISCOUNT_TYPE", "VIP_2026", false, "VIP 2026"), "VIP 2026");
  });

  it("값이 없으면 코드값으로 fallback한다", () => {
    assert.equal(codeLabel("vi", "SERVICE_STATUS", "UNKNOWN_CODE", true, null), "UNKNOWN_CODE");
    assert.equal(codeLabel("vi", "DISCOUNT_TYPE", "X", false, null), "X");
  });
});

describe("status label helpers", () => {
  it("roomStatusLabel은 한국어 key를 locale 라벨로 번역한다", () => {
    assert.equal(roomStatusLabel("ko", "종료확인"), "종료확인");
    assert.equal(roomStatusLabel("vi", "종료확인"), "Cần xác nhận kết thúc");
  });

  it("operatingMonthStatusLabel은 마감 상태를 번역하고 미지의 값은 그대로 둔다", () => {
    assert.equal(operatingMonthStatusLabel("vi", "마감확정"), "Đã chốt");
    assert.equal(operatingMonthStatusLabel("ko", "잠금"), "잠금");
    assert.equal(operatingMonthStatusLabel("vi", "기타상태"), "기타상태");
  });
});

describe("format helpers", () => {
  it("formatNumber는 locale별 그룹 구분을 적용한다", () => {
    // 값 자체(자릿수)는 locale과 무관하게 동일해야 한다.
    assert.equal(formatNumber("vi", 1500000).replace(/\D/g, ""), "1500000");
    assert.equal(formatNumber("ko", 1500000).replace(/\D/g, ""), "1500000");
  });

  it("formatCurrencyVnd는 VND 금액을 표시한다", () => {
    assert.equal(formatCurrencyVnd("vi", 1500000).replace(/\D/g, ""), "1500000");
    const withSymbol = formatCurrencyVnd("vi", 1500000, true);
    assert.match(withSymbol, /1[.,\s]?500[.,\s]?000/);
  });
});
