import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthorizedAccount, getRoleLandingPath } from "@/lib/authorization";

export type TherapistAccess = {
  accountId: string;
  employeeId: string;
};

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
 * M17: Therapist 화면과 서버 액션이 거치는 검사 하나. 세션 계정이 활성이고, 역할이 therapist이고,
 * 연결된 직원이 Therapist 구분이며 퇴사가 아니어야 한다. 통과하면 {계정 id, 직원 id}를 돌려준다.
 *
 * 뒤 티켓(03–12)의 Therapist 화면·서버 액션은 모두 이 함수 하나를 부른다. 요청에서 직원 id를 받지
 * 않고(M3) 이 함수가 돌려주는 employeeId만 쓴다.
 *
 * 세션이 없거나 비활성·잠금이면 /sign-in으로 보낸다. 역할이 therapist가 아니면(예: 관리자가 Therapist
 * 주소를 직접 열었을 때) 그 역할의 첫 화면으로 보낸다. 역할은 therapist인데 연결된 직원 검사에서
 * 막히면(예: 계정은 아직 활성인데 직원 연결이 깨진 드문 상태) /sign-in으로 보낸다 — Therapist 첫 화면으로
 * 보내면 같은 검사가 다시 막혀 되돌이가 생기기 때문이다.
 *
 * 티켓 02(M17 뒷부분): 계정에 비밀번호 변경 필요 표시가 켜져 있으면 비밀번호 변경 화면과 로그아웃
 * 말고는 막는다(기본값). `allowPasswordChangeRequired`를 준 호출(비밀번호 변경 화면 자신, 그리고 이
 * 함수를 모든 하위 주소 앞에서 한 번 더 부르는 레이아웃)만 이 표시를 통과시킨다 — 레이아웃이 기본값으로
 * 부르면 비밀번호 변경 화면으로 가는 중에도 같은 자리로 다시 보내 되돌이가 생긴다.
 */
export async function requireTherapistAccess(options: { allowPasswordChangeRequired?: boolean } = {}): Promise<TherapistAccess> {
  const account = await getAuthorizedAccount();
  if (!account) {
    redirect("/sign-in");
  }
  if (account.role !== "therapist") {
    redirect(getRoleLandingPath(account.role));
  }
  if (!account.employeeId || !(await isTherapistEmployee(account.employeeId))) {
    redirect("/sign-in");
  }
  if (account.passwordChangeRequired && !options.allowPasswordChangeRequired) {
    redirect("/therapist/password");
  }

  return { accountId: account.id, employeeId: account.employeeId };
}
