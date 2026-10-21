import { prisma } from "@/lib/prisma";
import { getAuthorizedAccount, type Role } from "@/lib/authorization";

export type TherapistAccess = {
  accountId: string;
  employeeId: string;
};

/**
 * M17 판정의 순수 결과(R20). redirect는 이 모듈이 하지 않는다 — 앱 쪽 어댑터
 * (src/app/therapist/require-therapist-access.ts)가 verdict를 보고 한다. role-landing은 그 역할의
 * 첫 화면을 알아야 해서 role을 들고 있다.
 */
export type TherapistAccessVerdict =
  | { kind: "ok"; accountId: string; employeeId: string }
  | { kind: "sign-in" }
  | { kind: "role-landing"; role: Role }
  | { kind: "password-change" };

type TherapistAccessPrismaClient = {
  employee: {
    findUnique(args: unknown): Promise<{ employeeGroup: string; employmentStatus: string } | null>;
  };
};

function getClient(client?: TherapistAccessPrismaClient) {
  return client ?? (prisma as unknown as TherapistAccessPrismaClient);
}

/**
 * M17 뒷부분: 계정에 연결된 직원이 Therapist 구분(`employeeGroup === "THERAPIST"`)이고
 * 퇴사가 아닌지 본다. 계정이 활성이고 역할이 therapist인지는 호출하는 쪽(requireTherapistAccess)이
 * getAuthorizedAccount로 이미 확인한다. 메모리 Prisma로 단위 테스트한다(Testing Decisions 경계 1).
 */
export async function isTherapistEmployee(employeeId: string, options: { prismaClient?: TherapistAccessPrismaClient } = {}) {
  const employee = await getClient(options.prismaClient).employee.findUnique({
    where: { id: employeeId },
    select: { employeeGroup: true, employmentStatus: true }
  });
  return employee !== null && employee.employeeGroup === "THERAPIST" && employee.employmentStatus !== "퇴사";
}

/**
 * M17 판정 하나를 순수 함수로 돌려준다(R20, 스멜: src/modules/ 중 유일하게 next/navigation을 쓰던
 * 것을 고친다). account가 없으면(세션 없음·비활성·잠금 — getAuthorizedAccount가 이미 가려낸다)
 * sign-in이다. 역할이 therapist가 아니면 role-landing(그 역할의 첫 화면으로, 예: 관리자가 Therapist
 * 주소를 직접 열었을 때)이다. 역할은 therapist인데 연결된 직원 검사(isValidTherapistEmployee —
 * isTherapistEmployee의 결과, 직원 구분이 다르거나 퇴사면 false)에서 막히면 sign-in이다 — Therapist
 * 첫 화면으로 보내면 같은 검사가 다시 막혀 되돌이가 생기기 때문이다. 비밀번호 변경 필요 표시가 있고
 * allowPasswordChangeRequired가 아니면 password-change다.
 */
export function evaluateTherapistAccess(input: {
  account: { id: string; role: Role; employeeId: string | null; passwordChangeRequired: boolean } | null;
  isValidTherapistEmployee: boolean;
  allowPasswordChangeRequired?: boolean;
}): TherapistAccessVerdict {
  const { account, isValidTherapistEmployee, allowPasswordChangeRequired } = input;
  if (!account) {
    return { kind: "sign-in" };
  }
  if (account.role !== "therapist") {
    return { kind: "role-landing", role: account.role };
  }
  if (!account.employeeId || !isValidTherapistEmployee) {
    return { kind: "sign-in" };
  }
  if (account.passwordChangeRequired && !allowPasswordChangeRequired) {
    return { kind: "password-change" };
  }
  return { kind: "ok", accountId: account.id, employeeId: account.employeeId };
}

/**
 * evaluateTherapistAccess의 조립(R20): 세션을 읽고(getAuthorizedAccount, @/lib/authorization —
 * redirect를 쓰지 않는 자리) 직원 검사를 거쳐 판정을 돌려준다. 앱 쪽 어댑터
 * (requireTherapistAccess)만 이 결과로 redirect한다.
 */
export async function resolveTherapistAccess(
  options: { allowPasswordChangeRequired?: boolean; prismaClient?: TherapistAccessPrismaClient } = {}
): Promise<TherapistAccessVerdict> {
  const account = await getAuthorizedAccount();
  const isValidTherapistEmployee =
    account?.role === "therapist" && account.employeeId
      ? await isTherapistEmployee(account.employeeId, { prismaClient: options.prismaClient })
      : false;

  return evaluateTherapistAccess({
    account,
    isValidTherapistEmployee,
    allowPasswordChangeRequired: options.allowPasswordChangeRequired
  });
}
