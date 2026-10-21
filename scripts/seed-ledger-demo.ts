import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });
import { getPrismaClient } from "../src/lib/prisma";

async function main() {
  const prisma = getPrismaClient();

  // 1. Operating month
  let month = await prisma.operatingMonth.findFirst({
    where: { monthKey: "2026-10" }
  });
  if (!month) {
    month = await prisma.operatingMonth.create({
      data: {
        monthKey: "2026-10",
        status: "작성중",
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2026-10-31T23:59:59.999Z")
      }
    });
  }
  const monthId = month.id;

  // 2. Courses
  const courseA = await prisma.course.findFirst({ where: { code: "A" } });
  const courseB = await prisma.course.findFirst({ where: { code: "B" } });
  const courseC = await prisma.course.findFirst({ where: { code: "C" } });
  const courseD = await prisma.course.findFirst({ where: { code: "D" } });

  // 3. Rooms
  const rooms = await prisma.room.findMany();
  const room201 = rooms.find((r) => r.displayName.includes("201")) || rooms[0];
  const room202 = rooms.find((r) => r.displayName.includes("202")) || rooms[1] || rooms[0];
  const room203 = rooms.find((r) => r.displayName.includes("203")) || rooms[2] || rooms[0];
  const room204 = rooms.find((r) => r.displayName.includes("204")) || rooms[3] || rooms[0];

  // 4. Therapists
  const therapists = await prisma.employee.findMany({ where: { employeeGroup: "THERAPIST" } });
  const t2 = therapists.find((t) => t.displayName.includes("2") || t.staffCode.includes("02")) || therapists[0];
  const t8 = therapists.find((t) => t.displayName.includes("8") || t.staffCode.includes("08")) || therapists[1];
  const t19 = therapists.find((t) => t.displayName.includes("19") || t.staffCode.includes("19")) || therapists[2];
  const t5 = therapists.find((t) => t.displayName.includes("5") || t.staffCode.includes("05")) || therapists[3];
  const t12 = therapists.find((t) => t.displayName.includes("12") || t.staffCode.includes("12")) || therapists[4];

  const targetDates = [
    { dateStr: "2026-10-21", dateObj: new Date("2026-10-21T00:00:00.000Z") },
    { dateStr: "2026-10-22", dateObj: new Date("2026-10-22T00:00:00.000Z") }
  ];

  for (const { dateStr, dateObj } of targetDates) {
    // 5. Therapist Attendance for today
    for (const t of therapists.slice(0, 15)) {
      await prisma.therapistAttendance.upsert({
        where: {
          operatingMonthId_attendanceDate_employeeId: {
            operatingMonthId: monthId,
            attendanceDate: dateObj,
            employeeId: t.id
          }
        },
        update: {
          checkInMinute: 720, // 12:00
          checkOutMinute: 1320, // 22:00
          standbyMinutes: 600,
          isFullAttendanceRecognized: true,
          isActive: true
        },
        create: {
          employeeId: t.id,
          attendanceDate: dateObj,
          operatingMonthId: monthId,
          checkInMinute: 720,
          checkOutMinute: 1320,
          standbyMinutes: 600,
          isFullAttendanceRecognized: true,
          isActive: true
        }
      });
    }

    // Clear existing demo calls for this date
    await prisma.serviceCallAssignment.deleteMany({
      where: { serviceCall: { serviceDate: dateObj } }
    });
    await prisma.serviceCallStatusHistory.deleteMany({
      where: { serviceCall: { serviceDate: dateObj } }
    });
    await prisma.serviceCall.deleteMany({
      where: { serviceDate: dateObj }
    });

    // Create demo calls
    const callsData = [
      {
        id: `call-demo-${dateStr}-1`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "12:00",
        actualEntryTime: "12:00",
        status: "IN_USE",
        courseId: courseC!.id,
        roomId: room201.id,
        customerMemo: "텔레그램 홍길동 @hong123 / 목 어깨 집중",
        bookingChannelCode: "TELEGRAM",
        bookerName: "홍길동",
        confirmationCode: "Y",
        therapist1Id: t19?.id
      },
      {
        id: `call-demo-${dateStr}-2`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "13:00",
        actualEntryTime: "13:00",
        status: "IN_USE",
        courseId: courseD!.id,
        roomId: room202.id,
        customerMemo: "카톡 이몽룡 010-2345-6789 / VIP 관리 요청",
        bookingChannelCode: "KAKAOTALK",
        bookerName: "이몽룡",
        confirmationCode: "Y",
        discountTypeCode: "DISCOUNT_VIP",
        therapist1Id: t2?.id,
        therapist2Id: t8?.id
      },
      {
        id: `call-demo-${dateStr}-3`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "14:00",
        actualEntryTime: null,
        status: "RESERVED",
        courseId: courseC!.id,
        roomId: room203.id,
        customerMemo: "잘로 성춘향 @chunhyang / 오일 마사지",
        bookingChannelCode: "ZALO",
        bookerName: "성춘향",
        confirmationCode: "N",
        therapist1Id: t2?.id
      },
      {
        id: `call-demo-${dateStr}-4`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "15:00",
        actualEntryTime: null,
        status: "RESERVED",
        courseId: courseA!.id,
        roomId: room204.id,
        customerMemo: "왓츠앱 David +84-90-123-4567 / English speaker",
        bookingChannelCode: "WHATSAPP",
        bookerName: "David",
        confirmationCode: "N",
        therapist1Id: t5?.id
      },
      {
        id: `call-demo-${dateStr}-5`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "16:00",
        actualEntryTime: null,
        status: "RESERVED",
        courseId: courseB!.id,
        roomId: room201.id,
        customerMemo: "위챗 Zhang @zhang_spa / 강한 압 선호",
        bookingChannelCode: "WECHAT",
        bookerName: "Zhang",
        confirmationCode: "N",
        therapist1Id: t12?.id
      },
      {
        id: `call-demo-${dateStr}-6`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "17:00",
        actualEntryTime: "17:00",
        status: "VISIT_COMPLETE",
        courseId: courseA!.id,
        roomId: room202.id,
        customerMemo: "워크인 박지성 / 현장 워크인 손님",
        bookingChannelCode: "WALK_IN",
        bookerName: "박지성",
        confirmationCode: "Y",
        therapist1Id: t19?.id
      },
      {
        id: `call-demo-${dateStr}-7`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "18:00",
        actualEntryTime: "18:00",
        status: "CLEANING",
        note: "[종료 19:10] 조기 퇴실",
        courseId: courseA!.id,
        roomId: room203.id,
        customerMemo: "전화 김철수 010-8888-9999 / 유선 예약",
        bookingChannelCode: "PHONE",
        bookerName: "김철수",
        confirmationCode: "Y",
        therapist1Id: t5?.id
      },
      {
        id: `call-demo-${dateStr}-8`,
        operatingMonthId: monthId,
        serviceDate: dateObj,
        startTime: "19:00",
        actualEntryTime: null,
        status: "CANCELED",
        courseId: courseB!.id,
        roomId: room204.id,
        customerMemo: "기타 일반손님 / 현장 문의 후 취소",
        bookingChannelCode: "OTHER",
        bookerName: "일반손님",
        confirmationCode: "N"
      }
    ];

    for (const c of callsData) {
      const { therapist1Id, therapist2Id, ...callFields } = c;
      await prisma.serviceCall.create({
        data: {
          ...callFields,
          assignments: {
            create: [
              ...(therapist1Id ? [{ employeeId: therapist1Id, assignmentRole: "THERAPIST_1" as const }] : []),
              ...(therapist2Id ? [{ employeeId: therapist2Id, assignmentRole: "THERAPIST_2" as const }] : [])
            ]
          }
        }
      });
    }
  }

  console.log("Demo calls and master data seeded successfully for 2026-10-21 and 2026-10-22!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
