import { prisma } from "./db";

const employeeIds = new Set<string>();

export const testEmployees = {
  async upsert(input: Parameters<typeof prisma.employee.upsert>[0]) {
    const preferredOrder = input.create.sortOrder;
    const employeeGroup = input.create.employeeGroup;
    const staffCode = input.create.staffCode;
    const existing = await prisma.employee.findUnique({ where: input.where });
    for (let offset = 0; offset < 1000; offset += 1) {
      const sortOrder = existing?.sortOrder ?? preferredOrder + offset;
      const conflict = await prisma.employee.findFirst({
        where: { employeeGroup, sortOrder, NOT: { staffCode } }
      });
      if (conflict) continue;
      try {
        const employee = await prisma.employee.upsert({
          ...input,
          create: { ...input.create, sortOrder }
        });
        employeeIds.add(employee.id);
        return employee;
      } catch (error) {
        // Another worker may claim the slot between the lookup and insert.
        const target = error && typeof error === "object" && "meta" in error
          ? JSON.stringify(error.meta) : "";
        if (existing || !(error && typeof error === "object" && "code" in error && error.code === "P2002") || !target.includes("sort_order")) throw error;
      }
    }
    throw new Error(`No test employee sort order available for ${staffCode}`);
  },
  async deactivateAll() {
    if (employeeIds.size === 0) return;
    await prisma.employee.updateMany({ where: { id: { in: [...employeeIds] } }, data: { isActive: false } });
    employeeIds.clear();
  }
};
