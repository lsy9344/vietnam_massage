/**
 * E2E 기본 마스터 데이터 시드 (멱등).
 *
 * 다수의 E2E 스펙(story-1-5/1-6/1-7/1-8, 콜/정산 계열)이 기본 마스터 데이터
 * (직원 59명, 객실 11개, 코드 20개, 시간 슬롯 29개)가 DB에 존재한다고 가정한다.
 * 그러나 기존에는 이를 시드하는 공유 메커니즘이 없어, 각 스펙이 제멋대로 데이터를
 * 만들고 정리하지 않아 직원이 수백 명까지 누적되는 오염을 일으켰다.
 *
 * 이 스크립트는 schema 모듈의 default* 정의를 source of truth로 사용해
 * upsert(멱등)로 기준 마스터를 보장한다. 반복 실행해도 중복이 쌓이지 않는다.
 *
 * 실행: npx tsx scripts/seed-master-data.ts
 */
import { prisma } from "@/lib/prisma";
import { defaultEmployees } from "@/modules/masters/employee-schema";
import { defaultRooms } from "@/modules/masters/room-schema";
import { defaultCodeItems, defaultTimeSlots } from "@/modules/masters/code-schema";

async function seedRooms() {
  for (const room of defaultRooms) {
    await prisma.room.upsert({
      where: { sortOrder: room.sortOrder },
      update: { displayName: room.displayName, migrationReferenceName: room.migrationReferenceName, isActive: true },
      create: {
        displayName: room.displayName,
        migrationReferenceName: room.migrationReferenceName,
        sortOrder: room.sortOrder,
        isActive: true
      }
    });
  }
  return defaultRooms.length;
}

async function seedEmployees() {
  for (const emp of defaultEmployees) {
    await prisma.employee.upsert({
      where: { staffCode: emp.staffCode },
      update: {
        displayName: emp.displayName,
        employeeGroup: emp.employeeGroup,
        position: emp.position,
        shiftType: emp.shiftType,
        baseSalary: emp.baseSalary,
        employmentStatus: emp.employmentStatus,
        sortOrder: emp.sortOrder,
        isActive: true
      },
      create: {
        displayName: emp.displayName,
        staffCode: emp.staffCode,
        employeeGroup: emp.employeeGroup,
        position: emp.position,
        shiftType: emp.shiftType,
        baseSalary: emp.baseSalary,
        employmentStatus: emp.employmentStatus,
        sortOrder: emp.sortOrder,
        isActive: true
      }
    });
  }
  return defaultEmployees.length;
}

async function seedCodeItems() {
  for (const item of defaultCodeItems) {
    await prisma.codeItem.upsert({
      where: { codeType_code: { codeType: item.codeType, code: item.code } },
      update: { displayName: item.displayName, sortOrder: item.sortOrder, isSystemDefault: true, isActive: true },
      create: {
        codeType: item.codeType,
        code: item.code,
        displayName: item.displayName,
        sortOrder: item.sortOrder,
        isSystemDefault: true,
        isActive: true
      }
    });
  }
  return defaultCodeItems.length;
}

async function seedTimeSlots() {
  for (const slot of defaultTimeSlots) {
    await prisma.timeSlot.upsert({
      where: { value: slot.value },
      update: { sortOrder: slot.sortOrder, isActive: true },
      create: { value: slot.value, sortOrder: slot.sortOrder, isActive: true }
    });
  }
  return defaultTimeSlots.length;
}

async function main() {
  const rooms = await seedRooms();
  const employees = await seedEmployees();
  const codes = await seedCodeItems();
  const slots = await seedTimeSlots();
  console.log(`E2E master data seeded: rooms=${rooms}, employees=${employees}, codeItems=${codes}, timeSlots=${slots}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
