import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactLongDigitSequences } from "@/modules/therapists/therapist-text-redaction";

describe("redactLongDigitSequences", () => {
  it("masks an attached 7+ digit number", () => {
    assert.equal(redactLongDigitSequences("도착하면 0901234567로 연락"), "도착하면 •••••••로 연락");
  });

  it("masks a number split by spaces, hyphens, or dots", () => {
    assert.equal(redactLongDigitSequences("090 123 4567"), "•••••••");
    assert.equal(redactLongDigitSequences("090-123-4567"), "•••••••");
    assert.equal(redactLongDigitSequences("090.123.4567"), "•••••••");
  });

  it("masks a country-code number", () => {
    assert.equal(redactLongDigitSequences("+84 90 123 4567 로 연락"), "••••••• 로 연락");
  });

  it("leaves 6 digits or fewer untouched (room numbers, times, amounts)", () => {
    assert.equal(redactLongDigitSequences("101호, 14:30, 150000원"), "101호, 14:30, 150000원");
    assert.equal(redactLongDigitSequences("예약번호 123456"), "예약번호 123456");
  });

  it("masks exactly at the 7-digit boundary", () => {
    assert.equal(redactLongDigitSequences("1234567"), "•••••••");
    assert.equal(redactLongDigitSequences("123456"), "123456");
  });

  it("does not merge unrelated short numbers across other characters", () => {
    assert.equal(redactLongDigitSequences("101호와 103호"), "101호와 103호");
  });

  it("passes null through unchanged", () => {
    assert.equal(redactLongDigitSequences(null), null);
  });

  it("leaves text with no long digit run unchanged", () => {
    assert.equal(redactLongDigitSequences("조용히 해 주세요"), "조용히 해 주세요");
  });

  // R13(M13 "금액은 그대로"): 구분자 허용 때문에 천 단위 묶음 금액과 ISO 날짜까지 가려지던 것을 고친다.
  describe("leaves thousand-grouped amounts and ISO dates alone (R13)", () => {
    it("leaves a dot-grouped amount untouched", () => {
      assert.equal(redactLongDigitSequences("코스 금액 1.500.000 VND 결제"), "코스 금액 1.500.000 VND 결제");
      assert.equal(redactLongDigitSequences("1.500.000 VND"), "1.500.000 VND");
    });

    it("leaves a space- or hyphen-grouped amount untouched", () => {
      assert.equal(redactLongDigitSequences("1 500 000"), "1 500 000");
      assert.equal(redactLongDigitSequences("1-500-000"), "1-500-000");
    });

    it("leaves a two-group amount (no leading zero, 3-digit tail) untouched", () => {
      assert.equal(redactLongDigitSequences("12.000.000"), "12.000.000");
    });

    it("leaves an ISO date untouched", () => {
      assert.equal(redactLongDigitSequences("예약일 2026-10-20 방문"), "예약일 2026-10-20 방문");
      assert.equal(redactLongDigitSequences("2026-10-20"), "2026-10-20");
    });

    it("still masks a phone number even though its groups use the same dot separator (first group starts with 0)", () => {
      assert.equal(redactLongDigitSequences("090.123.4567"), "•••••••");
    });

    it("still masks a number whose groups mix separators (not a consistent amount)", () => {
      assert.equal(redactLongDigitSequences("1.500-000"), "•••••••");
    });

    it("still masks a number whose later groups are not exactly 3 digits (not an amount)", () => {
      assert.equal(redactLongDigitSequences("12.500.00"), "•••••••");
    });

    it("still masks a plain 7+ digit run with no separators (ambiguous, no amount or date shape)", () => {
      assert.equal(redactLongDigitSequences("1500000"), "•••••••");
    });
  });
});
