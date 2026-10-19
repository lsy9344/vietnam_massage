import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";

function createMemoryPrisma() {
  const employees = new Map([
    ["emp-1", { displayName: "Lan", staffCode: "THR-012", phone: "0901234567" }],
    ["emp-2", { displayName: "Mai", staffCode: "THR-013", phone: null }]
  ]);

  return {
    employee: {
      async findUnique(args: any) {
        return employees.get(args.where.id) ?? null;
      }
    }
  };
}

describe('getTherapistProfile ("나" 메뉴용 보기 전용 정보, M6)', () => {
  const prismaClient = createMemoryPrisma() as any;

  it("returns the name, staff code, and phone for the Me menu", async () => {
    const profile = await getTherapistProfile("emp-1", { prismaClient });
    assert.deepEqual(profile, { displayName: "Lan", staffCode: "THR-012", phone: "0901234567" });
  });

  it("returns a null phone instead of inventing a placeholder", async () => {
    const profile = await getTherapistProfile("emp-2", { prismaClient });
    assert.equal(profile?.phone, null);
  });

  it("returns null for an employee id that does not exist", async () => {
    assert.equal(await getTherapistProfile("missing", { prismaClient }), null);
  });
});
