import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateTherapistAccess, isTherapistEmployee } from "@/modules/therapists/therapist-access-service";

function createMemoryPrisma() {
  const employees = new Map([
    ["emp-therapist-active", { employeeGroup: "THERAPIST", employmentStatus: "재직" }],
    ["emp-therapist-leave", { employeeGroup: "THERAPIST", employmentStatus: "휴직" }],
    ["emp-therapist-resigned", { employeeGroup: "THERAPIST", employmentStatus: "퇴사" }],
    ["emp-operations", { employeeGroup: "OPERATIONS", employmentStatus: "재직" }]
  ]);

  return {
    employee: {
      async findUnique(args: any) {
        return employees.get(args.where.id) ?? null;
      }
    }
  };
}

describe("isTherapistEmployee (M17 뒷부분)", () => {
  const prismaClient = createMemoryPrisma() as any;

  it("passes an active THERAPIST-group employee", async () => {
    assert.equal(await isTherapistEmployee("emp-therapist-active", { prismaClient }), true);
  });

  it("passes a THERAPIST-group employee on leave (퇴사만 막는다)", async () => {
    assert.equal(await isTherapistEmployee("emp-therapist-leave", { prismaClient }), true);
  });

  it("rejects a resigned THERAPIST-group employee", async () => {
    assert.equal(await isTherapistEmployee("emp-therapist-resigned", { prismaClient }), false);
  });

  it("rejects an OPERATIONS-group employee even if active (D26: therapist 역할은 Therapist 구분 직원만)", async () => {
    assert.equal(await isTherapistEmployee("emp-operations", { prismaClient }), false);
  });

  it("rejects an employee id that does not exist", async () => {
    assert.equal(await isTherapistEmployee("missing", { prismaClient }), false);
  });
});

// R20: M17 판정을 순수 함수로 옮긴 결과(redirect 없이 분기마다 확인한다). therapist-access-service.ts는
// next/navigation을 쓰지 않는다 — redirect는 앱 쪽 어댑터(src/app/therapist/require-therapist-access.ts)
// 가 이 함수의 verdict를 보고 한다.
describe("evaluateTherapistAccess (M17, R20)", () => {
  const therapistAccount = { id: "acct-1", role: "therapist" as const, employeeId: "emp-1", passwordChangeRequired: false };

  it("비활성 계정(세션 없음·비활성·잠금은 getAuthorizedAccount가 이미 null로 가려낸다) → sign-in", () => {
    assert.deepEqual(evaluateTherapistAccess({ account: null, isValidTherapistEmployee: false }), { kind: "sign-in" });
  });

  it("역할 다름 → role-landing(그 역할을 함께 돌려준다)", () => {
    const account = { id: "acct-2", role: "counter" as const, employeeId: "emp-2", passwordChangeRequired: false };
    assert.deepEqual(evaluateTherapistAccess({ account, isValidTherapistEmployee: false }), { kind: "role-landing", role: "counter" });
  });

  it("직원 구분 다름 또는 퇴사(isTherapistEmployee가 false, 그 둘은 자기 테스트가 있다) → sign-in", () => {
    assert.deepEqual(
      evaluateTherapistAccess({ account: therapistAccount, isValidTherapistEmployee: false }),
      { kind: "sign-in" }
    );
  });

  it("비밀번호 변경 필요 + 불허(기본값) → password-change", () => {
    const account = { ...therapistAccount, passwordChangeRequired: true };
    assert.deepEqual(evaluateTherapistAccess({ account, isValidTherapistEmployee: true }), { kind: "password-change" });
  });

  it("비밀번호 변경 필요 + 허용 → ok(비밀번호 변경 화면·그 화면을 감싸는 레이아웃이 쓴다)", () => {
    const account = { ...therapistAccount, passwordChangeRequired: true };
    assert.deepEqual(
      evaluateTherapistAccess({ account, isValidTherapistEmployee: true, allowPasswordChangeRequired: true }),
      { kind: "ok", accountId: "acct-1", employeeId: "emp-1" }
    );
  });

  it("모두 통과 → ok", () => {
    assert.deepEqual(evaluateTherapistAccess({ account: therapistAccount, isValidTherapistEmployee: true }), {
      kind: "ok",
      accountId: "acct-1",
      employeeId: "emp-1"
    });
  });
});
