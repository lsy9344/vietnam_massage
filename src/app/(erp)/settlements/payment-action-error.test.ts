import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthorizationError } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { mapTherapistDailySettlementPaymentActionError } from "@/app/(erp)/settlements/payment-action-error";

describe("mapTherapistDailySettlementPaymentActionError", () => {
  it("내부 DB 오류 메시지는 사용자에게 노출하지 않는다", () => {
    const result = mapTherapistDailySettlementPaymentActionError(
      new Error('relation "therapist_daily_settlement_payment_histories" does not exist')
    );

    assert.equal(result.ok, false);
    assert.equal(result.formError, "지급완료 상태 저장 중 오류가 발생했습니다.");
    assert.equal(result.formError.includes("relation"), false);
  });

  it("허용된 업무 오류 메시지는 그대로 돌려준다", () => {
    const result = mapTherapistDailySettlementPaymentActionError(new Error("운영월을 찾을 수 없습니다."));

    assert.equal(result.ok, false);
    assert.equal(result.formError, "운영월을 찾을 수 없습니다.");
  });

  it("권한과 감사 로그 오류는 정해진 사용자 문구로 매핑한다", () => {
    const authorization = mapTherapistDailySettlementPaymentActionError(new AuthorizationError());
    const audit = mapTherapistDailySettlementPaymentActionError(new AuditDomainError("raw audit failure", "INVALID_AUDIT_ACTION"));

    assert.equal(authorization.ok, false);
    assert.equal(authorization.formError, "권한이 없습니다.");
    assert.equal(audit.ok, false);
    assert.equal(audit.formError, "감사 로그 기록 중 오류가 발생했습니다.");
    assert.equal(audit.domainErrorCode, "INVALID_AUDIT_ACTION");
  });
});
