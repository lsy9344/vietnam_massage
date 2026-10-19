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
});
