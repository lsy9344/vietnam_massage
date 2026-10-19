import { prisma } from "@/lib/prisma";

export type TherapistProfile = {
  displayName: string;
  staffCode: string;
  phone: string | null;
};

type TherapistProfilePrismaClient = {
  employee: {
    findUnique(args: unknown): Promise<TherapistProfile | null>;
  };
};

function getClient(client?: TherapistProfilePrismaClient) {
  return client ?? (prisma as unknown as TherapistProfilePrismaClient);
}

/**
 * "나" 메뉴에 보이는 내 정보(이름, 직원 코드, 전화번호)만 고른다. 연락처 외의 민감 칸(비고 등)이나
 * 다른 직원의 정보는 애초에 질의에서 고르지 않는다(M6). 고칠 수 없는 보기 전용 정보라 getTherapistAccess가
 * 돌려준 employeeId로만 조회하고, 서버 액션에서 직원 id를 입력으로 받지 않는다(M3).
 */
export async function getTherapistProfile(
  employeeId: string,
  options: { prismaClient?: TherapistProfilePrismaClient } = {}
): Promise<TherapistProfile | null> {
  return getClient(options.prismaClient).employee.findUnique({
    where: { id: employeeId },
    select: { displayName: true, staffCode: true, phone: true }
  });
}
