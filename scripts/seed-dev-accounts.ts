import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/masters/account-service";
import type { Role } from "@/lib/authorization";

const localAccounts: Array<{
  accountId: Role;
  email: string;
  displayName: string;
  staffCode: string;
  role: Role;
  localOnlySecret: string;
}> = [
  {
    accountId: "administrator",
    email: "administrator@example.local",
    displayName: "관리자",
    staffCode: "ADM-001",
    role: "administrator",
    localOnlySecret: "Story12!administrator"
  },
  {
    accountId: "counter",
    email: "counter@example.local",
    displayName: "카운터",
    staffCode: "CNT-001",
    role: "counter",
    localOnlySecret: "Story12!counter"
  },
  {
    accountId: "settlement_manager",
    email: "settlement@example.local",
    displayName: "정산 담당",
    staffCode: "SET-001",
    role: "settlement_manager",
    localOnlySecret: "Story12!settlement_manager"
  },
  {
    accountId: "waiter",
    email: "waiter@example.local",
    displayName: "웨이터",
    staffCode: "WTR-001",
    role: "waiter",
    localOnlySecret: "Story12!waiter"
  },
  {
    accountId: "read_only_viewer",
    email: "readonly@example.local",
    displayName: "조회 전용",
    staffCode: "ROV-001",
    role: "read_only_viewer",
    localOnlySecret: "Story12!read_only_viewer"
  }
];

async function main() {
  for (const account of localAccounts) {
    const employee = await (prisma as any).employee.upsert({
      where: { staffCode: account.staffCode },
      update: {
        displayName: account.displayName,
        isActive: true
      },
      create: {
        staffCode: account.staffCode,
        displayName: account.displayName,
        isActive: true
      }
    });

    const passwordHash = await hashPassword(account.localOnlySecret);

    await (prisma as any).userAccount.upsert({
      where: { accountId: account.accountId },
      update: {
        email: account.email,
        passwordHash,
        role: account.role,
        employeeId: employee.id,
        isActive: true,
        lockedUntil: null,
        failedLoginCount: 0
      },
      create: {
        email: account.email,
        accountId: account.accountId,
        passwordHash,
        role: account.role,
        employeeId: employee.id,
        isActive: true
      }
    });
  }

  console.log("Story 1.2 local development accounts seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
