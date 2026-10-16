import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCoursePolicySchema,
  createTherapistCourseRateSchema,
  defaultCourseSeeds,
  defaultOpsDailyIncentiveSeeds,
  defaultOpsMonthlyIncentiveSeeds
} from "@/modules/masters/course-schema";
import {
  CourseDomainError,
  createCourse,
  createCoursePolicy,
  currentCourseMonthKey,
  createOpsDailyIncentiveRule,
  createTherapistCourseRate,
  deactivateCourse,
  endTherapistCourseRate,
  ensureDefaultCoursesAndPolicies,
  getCoursePolicyForMonth,
  getTherapistCourseRateForMonth,
  listActiveCourses,
  listCourses,
  listOpsDailyIncentiveRulesForMonth,
  listOpsMonthlyIncentiveRulesForMonth,
  reactivateCourse,
  updateCoursePolicy,
  updateOpsDailyIncentiveRule,
  updateOpsMonthlyIncentiveRule
} from "@/modules/masters/course-service";

function createMemoryPrisma() {
  const courses = new Map<string, any>();
  const coursePolicies = new Map<string, any>();
  const therapistRates = new Map<string, any>();
  const dailyRules = new Map<string, any>();
  const monthlyRules = new Map<string, any>();
  const employees = new Map<string, any>();
  const operatingMonths = new Map<string, any>();
  const auditEvents: any[] = [];
  let seq = 1;

  function timestamp() {
    return new Date(`2026-06-08T00:${String(seq % 60).padStart(2, "0")}:00.000Z`);
  }

  function nextId(prefix: string) {
    return `${prefix}-${seq++}`;
  }

  function seedTherapists() {
    for (let index = 1; index <= 50; index += 1) {
      const id = `thr-${String(index).padStart(3, "0")}`;
      employees.set(id, {
        id,
        displayName: `이름변경-${index}`,
        staffCode: `THR-${String(index).padStart(3, "0")}`,
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        phone: null,
        birthday: null,
        hireDate: null,
        employmentStatus: "재직",
        sortOrder: index,
        isActive: true,
        createdAt: timestamp(),
        updatedAt: timestamp()
      });
    }
  }

  function seedOperatingMonth(monthKey = "2026-06", status = "작성중") {
    operatingMonths.set(monthKey, {
      id: `om-${monthKey}`,
      monthKey,
      startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
      endDate: new Date(`${monthKey}-30T00:00:00.000Z`),
      status,
      createdAt: timestamp(),
      updatedAt: timestamp()
    });
  }

  function matches(record: any, where: any = {}) {
    if (where.id && record.id !== where.id) return false;
    if (where.code && record.code !== where.code) return false;
    if (where.courseId && record.courseId !== where.courseId) return false;
    if (where.therapistId && record.therapistId !== where.therapistId) return false;
    if (where.staffCode && record.staffCode !== where.staffCode) return false;
    if (where.employeeGroup && record.employeeGroup !== where.employeeGroup) return false;
    if (where.thresholdCallCount && record.thresholdCallCount !== where.thresholdCallCount) return false;
    if (typeof where.isActive === "boolean" && record.isActive !== where.isActive) return false;
    if (where.NOT?.id && record.id === where.NOT.id) return false;
    return true;
  }

  function modelFor(map: Map<string, any>, prefix: string) {
    return {
      async create({ data }: any) {
        const id = data.id ?? nextId(prefix);
        const record = { id, ...data, createdAt: timestamp(), updatedAt: timestamp() };
        map.set(id, record);
        return record;
      },
      async findMany({ where, orderBy }: any = {}) {
        const records = [...map.values()].filter((record) => matches(record, where));
        if (Array.isArray(orderBy)) {
          records.sort((a, b) => {
            for (const order of orderBy) {
              const [key] = Object.keys(order);
              if (a[key] < b[key]) return order[key] === "asc" ? -1 : 1;
              if (a[key] > b[key]) return order[key] === "asc" ? 1 : -1;
            }
            return 0;
          });
        }
        return records;
      },
      async findUnique({ where }: any) {
        if (where.id) return map.get(where.id) ?? null;
        if (where.code) return [...map.values()].find((record) => record.code === where.code) ?? null;
        return null;
      },
      async findFirst({ where, orderBy }: any) {
        const records = await this.findMany({ where, orderBy });
        return records[0] ?? null;
      },
      async updateMany({ where, data }: any) {
        const record = [...map.values()].find((item) => matches(item, where));
        if (!record) return { count: 0 };
        map.set(record.id, { ...record, ...data, updatedAt: new Date("2026-06-09T00:00:00.000Z") });
        return { count: 1 };
      }
    };
  }

  const client: any = {
    course: modelFor(courses, "course"),
    coursePolicy: modelFor(coursePolicies, "policy"),
    therapistCourseRate: modelFor(therapistRates, "rate"),
    opsDailyIncentiveRule: modelFor(dailyRules, "daily"),
    opsMonthlyIncentiveRule: modelFor(monthlyRules, "monthly"),
    employee: modelFor(employees, "emp"),
    operatingMonth: modelFor(operatingMonths, "om"),
    auditLog: {
      async create({ data }: any) {
        const record = { id: nextId("audit"), ...data, createdAt: timestamp() };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    courses,
    coursePolicies,
    therapistRates,
    dailyRules,
    monthlyRules,
    employees,
    operatingMonths,
    auditEvents,
    seedTherapists,
    seedOperatingMonth
  };

  return client;
}

describe("course schema", () => {
  it("defines exact default course and incentive seeds from the source workbook", () => {
    assert.deepEqual(
      defaultCourseSeeds.map((course) => ({
        code: course.code,
        name: course.name,
        durationMinutes: course.durationMinutes,
        basePrice: course.basePrice,
        requiresSecondTherapist: course.requiresSecondTherapist,
        tvDisplayName: course.tvDisplayName
      })),
      [
        {
          code: "A",
          name: "60분 A코스 누루마사지",
          durationMinutes: 60,
          basePrice: 1500000,
          requiresSecondTherapist: false,
          tvDisplayName: "A 누루60"
        },
        {
          code: "C",
          name: "90분 C코스 때밀이+마사지",
          durationMinutes: 90,
          basePrice: 2000000,
          requiresSecondTherapist: false,
          tvDisplayName: "C 때밀이90"
        },
        {
          code: "D",
          name: "90분 D코스 2:1 코스",
          durationMinutes: 90,
          basePrice: 3200000,
          requiresSecondTherapist: true,
          tvDisplayName: "D 2:1 90"
        }
      ]
    );
    assert.deepEqual(defaultOpsDailyIncentiveSeeds, [
      { thresholdCallCount: 30, personalAmount: 50000 },
      { thresholdCallCount: 40, personalAmount: 100000 },
      { thresholdCallCount: 50, personalAmount: 200000 }
    ]);
    assert.equal(defaultOpsMonthlyIncentiveSeeds.at(0)?.leadShare, 0.3);
    assert.equal(defaultOpsMonthlyIncentiveSeeds.at(-1)?.totalAmount, 25000000);
  });

  it("returns Korean validation errors for months, money, minutes, thresholds, and shares", () => {
    const invalidPolicy = createCoursePolicySchema.safeParse({
      courseId: "course-1",
      name: "",
      durationMinutes: "0",
      basePrice: "-1",
      requiresSecondTherapist: "maybe",
      tvDisplayName: "",
      effectiveFromMonth: "2026-6",
      effectiveToMonth: "2026-05"
    });
    const invalidRate = createTherapistCourseRateSchema.safeParse({
      therapistId: "thr-1",
      courseId: "course-1",
      amount: "-1",
      effectiveFromMonth: "bad",
      effectiveToMonth: ""
    });

    assert.equal(invalidPolicy.success, false);
    assert.equal(invalidRate.success, false);
    if (invalidPolicy.success || invalidRate.success) {
      throw new Error("expected validation failures");
    }
    assert.match(invalidPolicy.error.issues.map((issue) => issue.message).join("\n"), /YYYY-MM/);
    assert.match(invalidPolicy.error.issues.map((issue) => issue.message).join("\n"), /0 이상/);
    assert.match(invalidRate.error.issues.map((issue) => issue.message).join("\n"), /금액은 0 이상 정수/);
  });
});

describe("course service", () => {
  it("seeds courses, policies, therapist rates, and ops incentive rules idempotently", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth("2026-05");

    const first = await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const second = await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const courses = await listCourses({ monthKey: "2026-05", prismaClient });
    const dailyRules = await listOpsDailyIncentiveRulesForMonth({ monthKey: "2026-05", prismaClient });
    const monthlyRules = await listOpsMonthlyIncentiveRulesForMonth({ monthKey: "2026-05", prismaClient });

    assert.equal(first.coursesCreated, 3);
    assert.equal(first.coursePoliciesCreated, 3);
    assert.equal(first.therapistRatesCreated, 150);
    assert.equal(first.opsDailyRulesCreated, 3);
    assert.equal(first.opsMonthlyRulesCreated, 6);
    assert.equal(second.coursesCreated + second.coursePoliciesCreated + second.therapistRatesCreated, 0);
    assert.deepEqual(courses.map((course) => course.code), ["A", "C", "D"]);
    assert.equal(courses.find((course) => course.code === "D")?.currentPolicy?.requiresSecondTherapist, true);
    assert.equal(prismaClient.therapistRates.size, 150);
    assert.deepEqual(
      dailyRules.map((rule) => [rule.thresholdCallCount, rule.personalAmount]),
      [
        [30, 50000],
        [40, 100000],
        [50, 200000]
      ]
    );
    assert.deepEqual(
      monthlyRules.map((rule) => [rule.thresholdCallCount, rule.totalAmount, rule.leadShare, rule.counterTeamShare, rule.waiterTeamShare]),
      [
        [1000, 3000000, 0.3, 0.35, 0.35],
        [1100, 5000000, 0.3, 0.35, 0.35],
        [1200, 8000000, 0.3, 0.35, 0.35],
        [1300, 12000000, 0.3, 0.35, 0.35],
        [1400, 18000000, 0.3, 0.35, 0.35],
        [1500, 25000000, 0.3, 0.35, 0.35]
      ]
    );
    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "course.created").length, 3);
  });

  // E코스는 지금 하지 않는다(스펙 D8). 기본 시드가 만들지 않고, 비활성으로 둔 코스를 다시 켜지 않는다.
  it("does not seed course E and never turns an inactive course back on", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const courseC = (await listCourses({ monthKey: "2026-06", prismaClient })).find((course) => course.code === "C");
    assert.ok(courseC);
    await deactivateCourse({ actorId: "admin-1", courseId: courseC.id, prismaClient });

    const again = await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const courses = await listCourses({ monthKey: "2026-06", prismaClient });
    assert.equal(again.coursesCreated, 0);
    assert.equal(courses.find((course) => course.code === "C")?.isActive, false);
    assert.equal(courses.some((course) => course.code === "E"), false);
  });

  it("preserves stable Course.id and Course.code when display and price policy changes", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const before = (await listCourses({ monthKey: "2026-06", prismaClient })).find((course) => course.code === "A");
    assert.ok(before?.currentPolicy);

    await updateCoursePolicy({
      actorId: "admin-1",
      policyId: before.currentPolicy.id,
      name: before.currentPolicy.name,
      durationMinutes: before.currentPolicy.durationMinutes,
      basePrice: before.currentPolicy.basePrice,
      requiresSecondTherapist: before.currentPolicy.requiresSecondTherapist,
      tvDisplayName: before.currentPolicy.tvDisplayName,
      effectiveFromMonth: before.currentPolicy.effectiveFromMonth,
      effectiveToMonth: "2026-06",
      prismaClient
    });
    const nextPolicy = await createCoursePolicy({
      actorId: "admin-1",
      courseId: before.id,
      name: "60분 A코스 새 표시명",
      durationMinutes: 60,
      basePrice: 1600000,
      requiresSecondTherapist: false,
      tvDisplayName: "A 새표시",
      effectiveFromMonth: "2026-07",
      effectiveToMonth: null,
      prismaClient
    });
    const after = (await listCourses({ monthKey: "2026-07", prismaClient })).find((course) => course.id === before.id);

    assert.equal(nextPolicy.courseId, before.id);
    assert.equal(after?.code, "A");
    assert.equal(after?.currentPolicy?.name, "60분 A코스 새 표시명");
    assert.equal(prismaClient.auditEvents.at(-1).action, "course.policy_changed");
  });

  it("returns effective-month policies and rejects overlapping active ranges", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const course = (await listCourses({ monthKey: "2026-06", prismaClient })).find((item) => item.code === "C");
    assert.ok(course?.currentPolicy);

    await updateCoursePolicy({
      actorId: "admin-1",
      policyId: course.currentPolicy.id,
      name: course.currentPolicy.name,
      durationMinutes: course.currentPolicy.durationMinutes,
      basePrice: course.currentPolicy.basePrice,
      requiresSecondTherapist: course.currentPolicy.requiresSecondTherapist,
      tvDisplayName: course.currentPolicy.tvDisplayName,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: "2026-06",
      prismaClient
    });
    await createCoursePolicy({
      actorId: "admin-1",
      courseId: course.id,
      name: "90분 C코스 새 정책",
      durationMinutes: 90,
      basePrice: 1900000,
      requiresSecondTherapist: false,
      tvDisplayName: "C 새정책",
      effectiveFromMonth: "2026-07",
      effectiveToMonth: null,
      prismaClient
    });

    const june = await getCoursePolicyForMonth({ courseId: course.id, monthKey: "2026-06", prismaClient });
    const july = await getCoursePolicyForMonth({ courseId: course.id, monthKey: "2026-07", prismaClient });
    assert.equal(june.basePrice, 2000000);
    assert.equal(july.basePrice, 1900000);
    await assert.rejects(
      () =>
        createCoursePolicy({
          actorId: "admin-1",
          courseId: course.id,
          name: "겹침",
          durationMinutes: 90,
          basePrice: 2000000,
          requiresSecondTherapist: false,
          tvDisplayName: "겹침",
          effectiveFromMonth: "2026-07",
          effectiveToMonth: "2026-08",
          prismaClient
        }),
      /적용월 범위가 겹칩니다/
    );
  });

  it("blocks policy, therapist rate, and ops incentive ranges that overlap confirmed or locked months", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth("2026-06", "마감확정");
    prismaClient.seedOperatingMonth("2026-07", "작성중");
    const course = await prismaClient.course.create({ data: { code: "A", isActive: true } });

    await assert.rejects(
      () =>
        createCoursePolicy({
          actorId: "admin-1",
          courseId: course.id,
          name: "확정월 변경",
          durationMinutes: 60,
          basePrice: 1500000,
          requiresSecondTherapist: false,
          tvDisplayName: "A60",
          effectiveFromMonth: "2026-06",
          effectiveToMonth: "2026-06",
          prismaClient
        }),
      (error) => error instanceof CourseDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    await assert.rejects(
      () =>
        createTherapistCourseRate({
          actorId: "admin-1",
          therapistId: "thr-001",
          courseId: course.id,
          amount: 700000,
          effectiveFromMonth: "2026-06",
          effectiveToMonth: null,
          prismaClient
        }),
      (error) => error instanceof CourseDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    await assert.rejects(
      () =>
        createOpsDailyIncentiveRule({
          actorId: "admin-1",
          thresholdCallCount: 60,
          personalAmount: 300000,
          effectiveFromMonth: "2026-06",
          effectiveToMonth: null,
          prismaClient
        }),
      (error) => error instanceof CourseDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );

    const future = await createCoursePolicy({
      actorId: "admin-1",
      courseId: course.id,
      name: "미래월 정책",
      durationMinutes: 60,
      basePrice: 1600000,
      requiresSecondTherapist: false,
      tvDisplayName: "A 미래",
      effectiveFromMonth: "2026-07",
      effectiveToMonth: null,
      prismaClient
    });

    assert.equal(future.effectiveFromMonth, "2026-07");
    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "course.policy_changed").length, 1);
  });

  it("seeds therapist rates by Employee.id from THR staffCode and does not hide zero rates", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const courses = await listCourses({ monthKey: "2026-06", prismaClient });
    const courseA = courses.find((course) => course.code === "A");
    const courseD = courses.find((course) => course.code === "D");
    assert.ok(courseA);
    assert.ok(courseD);

    const rate1 = await getTherapistCourseRateForMonth({
      therapistId: "thr-001",
      courseId: courseA.id,
      monthKey: "2026-06",
      prismaClient
    });
    const rate5D = await getTherapistCourseRateForMonth({
      therapistId: "thr-005",
      courseId: courseD.id,
      monthKey: "2026-06",
      prismaClient
    });

    assert.equal(rate1.amount, 700000);
    assert.equal(rate5D.amount, 0);
    await assert.rejects(
      () =>
        getTherapistCourseRateForMonth({
          therapistId: "마사지사1",
          courseId: courseA.id,
          monthKey: "2026-06",
          prismaClient
        }),
      /수당 정책을 찾을 수 없습니다/
    );
  });

  it("prevents rate overlap, supports ending policies, and avoids no-op audit noise", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const course = (await listCourses({ monthKey: "2026-06", prismaClient })).find((item) => item.code === "C");
    assert.ok(course);
    const existing = await getTherapistCourseRateForMonth({
      therapistId: "thr-001",
      courseId: course.id,
      monthKey: "2026-06",
      prismaClient
    });

    await assert.rejects(
      () =>
        createTherapistCourseRate({
          actorId: "admin-1",
          therapistId: "thr-001",
          courseId: course.id,
          amount: 1,
          effectiveFromMonth: "2026-06",
          effectiveToMonth: null,
          prismaClient
        }),
      /적용월 범위가 겹칩니다/
    );

    const beforeAuditCount = prismaClient.auditEvents.length;
    await endTherapistCourseRate({
      actorId: "admin-1",
      rateId: existing.id,
      effectiveToMonth: "2026-06",
      prismaClient
    });
    await endTherapistCourseRate({
      actorId: "admin-1",
      rateId: existing.id,
      effectiveToMonth: "2026-06",
      prismaClient
    });

    assert.equal(
      prismaClient.auditEvents.filter((event: any) => event.action === "therapist_course_rate.ended").length,
      1
    );
    assert.equal(prismaClient.auditEvents.length, beforeAuditCount + 1);
    await assert.rejects(
      () =>
        endTherapistCourseRate({
          actorId: "admin-1",
          rateId: existing.id,
          effectiveToMonth: "2026-05",
          prismaClient
        }),
      /정책 종료월은 시작월보다 빠를 수 없습니다/
    );
  });

  it("suppresses no-op audit events for operations incentive updates", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const dailyRule = (await listOpsDailyIncentiveRulesForMonth({ monthKey: "2026-06", prismaClient }))[0];
    const monthlyRule = (await listOpsMonthlyIncentiveRulesForMonth({ monthKey: "2026-06", prismaClient }))[0];
    const beforeAuditCount = prismaClient.auditEvents.length;

    await updateOpsDailyIncentiveRule({
      actorId: "admin-1",
      ruleId: dailyRule.id,
      thresholdCallCount: dailyRule.thresholdCallCount,
      personalAmount: dailyRule.personalAmount,
      effectiveFromMonth: dailyRule.effectiveFromMonth,
      effectiveToMonth: dailyRule.effectiveToMonth,
      prismaClient
    });
    await updateOpsMonthlyIncentiveRule({
      actorId: "admin-1",
      ruleId: monthlyRule.id,
      thresholdCallCount: monthlyRule.thresholdCallCount,
      totalAmount: monthlyRule.totalAmount,
      leadShare: monthlyRule.leadShare,
      counterTeamShare: monthlyRule.counterTeamShare,
      waiterTeamShare: monthlyRule.waiterTeamShare,
      effectiveFromMonth: monthlyRule.effectiveFromMonth,
      effectiveToMonth: monthlyRule.effectiveToMonth,
      prismaClient
    });

    assert.equal(prismaClient.auditEvents.length, beforeAuditCount);
  });

  it("uses plain JSON audit snapshots and suppresses repeated course deactivation events", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const course = (await listCourses({ monthKey: "2026-06", prismaClient })).find((item) => item.code === "C");
    assert.ok(course);

    await deactivateCourse({ actorId: "admin-1", courseId: course.id, prismaClient });
    await deactivateCourse({ actorId: "admin-1", courseId: course.id, prismaClient });

    const deactivationEvents = prismaClient.auditEvents.filter((event: any) => event.action === "course.deactivated");
    assert.equal(deactivationEvents.length, 1);
    assert.equal(JSON.stringify(deactivationEvents[0].afterValue).includes("2026-06-08T"), false);
    assert.ok(!(deactivationEvents[0].afterValue instanceof Date));
  });

  const june = new Date("2026-06-15T05:00:00.000Z");

  // 코스 다시 사용(스펙 D9): 비활성 코스를 다시 켠다. 그달 정책이 있으면 그대로 쓰고, 없으면 정책을 함께 받는다.
  it("turns an inactive course back on with its policy for the month, once, with an audit record", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    const courseC = (await listCourses({ monthKey: "2026-06", prismaClient })).find((course) => course.code === "C");
    assert.ok(courseC);
    await deactivateCourse({ actorId: "admin-1", courseId: courseC.id, prismaClient });
    assert.equal((await listActiveCourses({ monthKey: "2026-06", prismaClient })).some((course) => course.code === "C"), false);

    const after = await reactivateCourse({ actorId: "admin-2", courseId: courseC.id, now: june, prismaClient });
    await reactivateCourse({ actorId: "admin-2", courseId: courseC.id, now: june, prismaClient });

    assert.equal(after.isActive, true);
    assert.equal(after.currentPolicy?.name, "90분 C코스 때밀이+마사지");
    assert.equal((await listActiveCourses({ monthKey: "2026-06", prismaClient })).some((course) => course.code === "C"), true);
    const events = prismaClient.auditEvents.filter((event: any) => event.action === "course.reactivated");
    assert.equal(events.length, 1);
    assert.equal(events[0].actorId, "admin-2");
    assert.equal(events[0].beforeValue.isActive, false);
    assert.equal(events[0].afterValue.isActive, true);
  });

  // 그달은 오늘(Asia/Ho_Chi_Minh)이 속한 달이다. 화면의 기준 적용월(가장 이른 운영월)이 마감확정이어도 이번 달 정책으로 켠다.
  it("checks the policy for the month of today, not the earliest operating month that may already be closed", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedOperatingMonth("2026-06", "마감확정");
    prismaClient.seedOperatingMonth("2026-10", "작성중");
    const courseB = await prismaClient.course.create({ data: { code: "B", isActive: false } });
    const october = new Date("2026-10-16T05:00:00.000Z");
    const policy = { name: "90분 B코스", durationMinutes: 90, basePrice: 1800000, requiresSecondTherapist: false, tvDisplayName: "B 90", effectiveFromMonth: "2026-10", effectiveToMonth: null };

    const after = await reactivateCourse({ actorId: "admin-1", courseId: courseB.id, policy, now: october, prismaClient });

    assert.equal(after.isActive, true);
    assert.equal(after.currentPolicy?.effectiveFromMonth, "2026-10");
    assert.equal(currentCourseMonthKey(october), "2026-10");
    // 하노이 시각으로 이미 다음 달이면 그달도 다음 달이다.
    assert.equal(currentCourseMonthKey(new Date("2026-10-31T18:30:00.000Z")), "2026-11");
  });

  it("asks for a policy when the reactivated course has none for the month, and creates it with the course", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedOperatingMonth("2026-06");
    const courseB = await prismaClient.course.create({ data: { code: "B", isActive: false } });
    await prismaClient.coursePolicy.create({
      data: { courseId: courseB.id, name: "B 옛 정책", durationMinutes: 90, basePrice: 1, requiresSecondTherapist: false, tvDisplayName: "B", effectiveFromMonth: "2026-01", effectiveToMonth: "2026-05", isActive: true }
    });

    await assert.rejects(
      () => reactivateCourse({ actorId: "admin-1", courseId: courseB.id, now: june, prismaClient }),
      (error) => error instanceof CourseDomainError && error.code === "COURSE_POLICY_REQUIRED"
    );
    assert.equal(prismaClient.courses.get(courseB.id).isActive, false);

    // 준 정책이 그달을 덮지 않으면 여전히 받지 않는다.
    const policy = { name: "90분 B코스", durationMinutes: 90, basePrice: 1800000, requiresSecondTherapist: false, tvDisplayName: "B 90", effectiveFromMonth: "2026-07", effectiveToMonth: null };
    await assert.rejects(
      () => reactivateCourse({ actorId: "admin-1", courseId: courseB.id, policy, now: june, prismaClient }),
      (error) => error instanceof CourseDomainError && error.code === "COURSE_POLICY_REQUIRED"
    );

    const after = await reactivateCourse({ actorId: "admin-1", courseId: courseB.id, policy: { ...policy, effectiveFromMonth: "2026-06" }, now: june, prismaClient });
    assert.equal(after.isActive, true);
    assert.equal(after.currentPolicy?.name, "90분 B코스");
    assert.equal(after.currentPolicy?.basePrice, 1800000);
    assert.deepEqual(
      prismaClient.auditEvents.map((event: any) => event.action).filter((action: string) => action.startsWith("course.")),
      ["course.policy_changed", "course.reactivated"]
    );
  });

  // 새 코스 추가(스펙 D9): 코드(중복 거절), 이름, 시간, 가격, 2인 여부와 첫 정책을 한 번에 만든다.
  it("adds a new course with its first policy and rejects a code that already exists, active or not", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedTherapists();
    prismaClient.seedOperatingMonth();
    await ensureDefaultCoursesAndPolicies({ actorId: "admin-1", prismaClient });
    await prismaClient.course.create({ data: { code: "E", isActive: false } });
    const input = { name: "75분 F코스", durationMinutes: 75, basePrice: 1700000, requiresSecondTherapist: true, tvDisplayName: "F 75", effectiveFromMonth: "2026-06", effectiveToMonth: null };

    const created = await createCourse({ actorId: "admin-1", code: " f ", ...input, now: june, prismaClient });

    assert.equal(created.code, "F");
    assert.equal(created.isActive, true);
    assert.equal(created.currentPolicy?.durationMinutes, 75);
    assert.equal(created.currentPolicy?.requiresSecondTherapist, true);
    const active = await listActiveCourses({ monthKey: "2026-06", prismaClient });
    assert.deepEqual(active.map((course) => course.code), ["A", "C", "D", "F"]);
    const courseEvents = prismaClient.auditEvents.filter((event: any) => event.targetId === created.id || event.targetId === created.currentPolicy?.id);
    assert.deepEqual(courseEvents.map((event: any) => event.action), ["course.created", "course.policy_changed"]);

    for (const code of ["A", "e", "F"]) {
      await assert.rejects(
        () => createCourse({ actorId: "admin-1", code, ...input, prismaClient }),
        (error) => error instanceof CourseDomainError && error.code === "COURSE_CODE_DUPLICATE"
      );
    }
    await assert.rejects(
      () => createCourse({ actorId: "admin-1", code: "F-1", ...input, prismaClient }),
      (error) => error instanceof CourseDomainError && error.code === "INVALID_COURSE_INPUT"
    );
    assert.equal([...prismaClient.courses.values()].filter((course: any) => course.code.startsWith("F")).length, 1);
  });

  it("does not add a course whose first policy overlaps a locked month", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.seedOperatingMonth("2026-06", "마감확정");
    await assert.rejects(
      () =>
        createCourse({
          actorId: "admin-1",
          code: "G",
          name: "G",
          durationMinutes: 60,
          basePrice: 0,
          requiresSecondTherapist: false,
          tvDisplayName: "G",
          effectiveFromMonth: "2026-06",
          effectiveToMonth: null,
          prismaClient
        }),
      (error) => error instanceof CourseDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.courses.size, 0);
  });

  it("returns domain errors instead of silently assuming missing policy values", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      () => getCoursePolicyForMonth({ courseId: "missing-course", monthKey: "2026-06", prismaClient }),
      (error) => error instanceof CourseDomainError && error.code === "COURSE_POLICY_NOT_FOUND"
    );
  });
});
