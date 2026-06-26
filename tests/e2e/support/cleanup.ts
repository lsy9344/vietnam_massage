import { prisma } from "./db";

/**
 * E2E 격리(teardown) 공용 유틸.
 *
 * 공유 단일 DB에서 스펙이 시드/변이한 상태를 결정적으로 되돌리기 위한 헬퍼다.
 * 모든 함수는 스펙 전용 네임스페이스(accountId/staffCode/monthKey)를 인자로 받아
 * 자기 스펙의 데이터만 건드린다. 실데이터나 다른 스펙 데이터를 광범위 삭제하지 않는다.
 *
 * 모범 사례는 story-4-1의 `cleanupStorySeedData`이며, 본 모듈은 그 패턴을 재사용 가능하게 추출한 것이다.
 */

/**
 * 로그인 계정 상태를 기본값(활성/미잠금/실패횟수 0)으로 되돌린다.
 * 본문에서 role을 일시 변경한 테스트의 try/finally 복구나 afterAll 정리에 사용한다.
 */
export async function restoreUserAccount(accountId: string, role: string): Promise<void> {
  await (prisma as any).userAccount.update({
    where: { accountId },
    data: { role, isActive: true, lockedUntil: null, failedLoginCount: 0 }
  });
}

/**
 * 코드 마스터 항목의 활성 상태를 복구한다.
 * autosave 실패 시나리오처럼 코드 항목을 일시 비활성화한 테스트의 복구에 사용한다.
 */
export async function setCodeItemActive(codeType: string, code: string, isActive: boolean): Promise<void> {
  await (prisma as any).codeItem.updateMany({
    where: { codeType, code },
    data: { isActive }
  });
}

/**
 * 미래 날짜 네임스페이스로 시드한 운영월을 monthKey 기준으로 삭제한다.
 * 운영월은 스펙 전용 미래 monthKey(예: "2032-03")만 사용하므로 실데이터와 충돌하지 않는다.
 */
export async function deleteOperatingMonthsByKey(monthKeys: string[]): Promise<void> {
  if (monthKeys.length === 0) return;
  await (prisma as any).operatingMonth.deleteMany({
    where: { monthKey: { in: monthKeys } }
  });
}

/**
 * 스펙 전용 staffCode prefix(예: "E2E22-")로 시드한 직원을 비활성화한다.
 * 직원은 일반 운영 경로에서 물리 삭제하지 않는 도메인 규칙을 따라 soft-deactivate만 한다.
 */
export async function deactivateEmployeesByPrefix(staffCodePrefix: string): Promise<void> {
  await (prisma as any).employee.updateMany({
    where: { staffCode: { startsWith: staffCodePrefix } },
    data: { isActive: false }
  });
}
