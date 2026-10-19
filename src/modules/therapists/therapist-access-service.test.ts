import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTherapistEmployee } from "@/modules/therapists/therapist-access-service";

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
