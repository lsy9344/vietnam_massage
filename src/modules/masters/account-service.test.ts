import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCurrentAccountAuthorization } from "@/modules/masters/account-service";

function createMemoryPrisma() {
  const employees = new Map<string, { id: string; displayName: string }>([
    ["emp-1", { id: "emp-1", displayName: "Lan" }]
  ]);
  const accounts = [
    { id: "acc-1", accountId: "counter01", role: "counter", employeeId: "emp-1", isActive: true, lockedUntil: null },
    { id: "acc-2", accountId: "admin", role: "administrator", employeeId: null, isActive: true, lockedUntil: null }
  ];

  return {
    userAccount: {
      async findUnique(args: any) {
        const account = accounts.find((candidate) => candidate.accountId === args.where.accountId);
        if (!account) return null;
        const picked: Record<string, unknown> = {};
        for (const [field, selected] of Object.entries(args.select ?? {})) {
          if (!selected) continue;
          if (field === "employee") {
            const employee = account.employeeId ? employees.get(account.employeeId) : null;
            picked.employee = employee ? { displayName: employee.displayName } : null;
          } else {
            picked[field] = account[field as keyof typeof account];
          }
        }
        return picked;
      }
    }
  };
}

describe("getCurrentAccountAuthorization display name", () => {
  it("shows the linked employee's display name for the Me menu", async () => {
    const account = await getCurrentAccountAuthorization("counter01", { prismaClient: createMemoryPrisma() as any });

    assert.equal(account?.displayName, "Lan");
    assert.equal(account?.role, "counter");
  });

  it("falls back to the account id when no employee is linked", async () => {
    const account = await getCurrentAccountAuthorization("admin", { prismaClient: createMemoryPrisma() as any });

    assert.equal(account?.displayName, "admin");
  });
});
