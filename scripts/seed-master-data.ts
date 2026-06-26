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
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { defaultEmployees } from "@/modules/masters/employee-schema";
import { defaultRooms } from "@/modules/masters/room-schema";
import { defaultCodeItems, defaultTimeSlots } from "@/modules/masters/code-schema";

async function seedRooms() {
  const migrationReferenceNames = defaultRooms.map((room) => room.migrationReferenceName);
  const targetSortOrders = defaultRooms.map((room) => room.sortOrder);

  // 정렬을 재배치하기 전에 충돌 가능한 행을 임시로 비켜둔다. sortOrder 는 UNIQUE 이므로
  // "+ 1000000" 만으로는 이미 큰 값이 있을 때 충돌할 수 있고, sortOrder IN (목표값) 조건은
  // 같은 값을 쓰는 커스텀 객실까지 밀어내 의도치 않은 재정렬을 일으킨다.
  // 따라서 (1) 재배치 대상은 기본 객실(migrationReferenceName)로 한정하고,
  // (2) 임시값은 음수(-sortOrder)로 두어 항상 비어 있는 구간을 쓴다.
  // 단, 목표 자리(10..110)를 커스텀 객실이 점유 중이면 그 행도 잠시 음수로 비켜둔 뒤 복원한다.
  await prisma.$executeRaw`
    UPDATE "rooms"
    SET "sort_order" = -"sort_order"
    WHERE "migration_reference_name" IN (${Prisma.join(migrationReferenceNames)})
      OR (
        "sort_order" IN (${Prisma.join(targetSortOrders)})
        AND "migration_reference_name" NOT IN (${Prisma.join(migrationReferenceNames)})
      )
  `;

  for (const room of defaultRooms) {
    const existing = await prisma.room.findFirst({
      where: { migrationReferenceName: room.migrationReferenceName }
    });

    if (existing) {
      await prisma.room.update({
        where: { id: existing.id },
        data: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          sortOrder: room.sortOrder,
          isActive: true
        }
      });
    } else {
      await prisma.room.create({
        data: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          sortOrder: room.sortOrder,
          isActive: true
        }
      });
    }
  }

  // 목표 자리를 비우려고 잠시 음수로 비켜둔 커스텀 객실을 양수 구간으로 복원한다.
  // sort_order 에는 상한 CHECK 가 없어 "1000000 + 원래값" 같은 고정 오프셋은 이미 그 대역을 쓰는 행이
  // 있으면 UNIQUE 위반이 날 수 있다. 따라서 "현재 최대값 이후의 빈 자리"로 10 간격 순번을 매겨 배정한다.
  // 원래 순서를 보존하기 위해 -sort_order(=원래값) 오름차순으로 정렬한다.
  await prisma.$executeRaw`
    WITH "displaced" AS (
      SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY -"sort_order" ASC) AS "rn"
      FROM "rooms"
      WHERE "sort_order" < 0
    )
    UPDATE "rooms"
    SET "sort_order" = (SELECT COALESCE(MAX("sort_order"), 0) FROM "rooms" WHERE "sort_order" >= 0)
      + "displaced"."rn" * 10
    FROM "displaced"
    WHERE "rooms"."id" = "displaced"."id"
  `;

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
