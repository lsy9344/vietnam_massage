import { redirect } from "next/navigation";
import { getRoleLandingPath } from "@/lib/authorization";
import { resolveTherapistAccess, type TherapistAccess } from "@/modules/therapists/therapist-access-service";

/**
 * Therapist 화면·서버 액션이 거치는 검사 하나(M17, R20). 판정 자체는 모듈
 * (resolveTherapistAccess/evaluateTherapistAccess)이 순수하게 돌려주고, redirect는 이 앱 쪽
 * 어댑터에서만 한다 — src/modules/는 next/navigation을 쓰지 않는다.
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
  const verdict = await resolveTherapistAccess(options);

  if (verdict.kind === "sign-in") {
    redirect("/sign-in");
  }
  if (verdict.kind === "role-landing") {
    redirect(getRoleLandingPath(verdict.role));
  }
  if (verdict.kind === "password-change") {
    redirect("/therapist/password");
  }

  return { accountId: verdict.accountId, employeeId: verdict.employeeId };
}
