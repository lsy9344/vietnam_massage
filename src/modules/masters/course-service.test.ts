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
  createCoursePolicy,
  createTherapistCourseRate,
  deactivateCourse,
  endTherapistCourseRate,
  ensureDefaultCoursesAndPolicies,
  getCoursePolicyForMonth,
  getTherapistCourseRateForMonth,
  listCourses,
  listOpsDailyIncentiveRulesForMonth,
  listOpsMonthlyIncentiveRulesForMonth,
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

  function seedOperatingMonth(monthKey = "2026-06") {
    operatingMonths.set(monthKey, {
      id: `om-${monthKey}`,
      monthKey,
      startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
      endDate: new Date(`${monthKey}-30T00:00:00.000Z`),
      status: "작성중",
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
        opsCallCredit: course.opsCallCredit,
        earcarePoolAmount: course.earcarePoolAmount,
        requiresSecondTherapist: course.requiresSecondTherapist,
        tvDisplayName: course.tvDisplayName
      })),
      [
        {
          code: "A",
          name: "60분 A코스 누루마사지",
          durationMinutes: 60,
          basePrice: 1500000,
          opsCallCredit: 1,
          earcarePoolAmount: 0,
          requiresSecondTherapist: false,
          tvDisplayName: "A 누루60"
        },
        {
          code: "B",
          name: "90분 B코스 귀청소+마사지",
          durationMinutes: 90,
          basePrice: 1800000,
          opsCallCredit: 1,
          earcarePoolAmount: 100000,
          requiresSecondTherapist: false,
          tvDisplayName: "B 귀청소90"
        },
        {
          code: "C",
          name: "90분 C코스 때밀이+마사지",
          durationMinutes: 90,
          basePrice: 2000000,
          opsCallCredit: 1,
          earcarePoolAmount: 0,
          requiresSecondTherapist: false,
          tvDisplayName: "C 때밀이90"
        },
        {
          code: "D",
          name: "90분 D코스 2:1 코스",
          durationMinutes: 90,
          basePrice: 3200000,
          opsCallCredit: 1,
          earcarePoolAmount: 0,
          requiresSecondTherapist: true,
          tvDisplayName: "D 2:1 90"
        },
        {
          code: "E",
          name: "120분 E코스 풀코스 패키지",
          durationMinutes: 120,
          basePrice: 3000000,
          opsCallCredit: 1,
          earcarePoolAmount: 100000,
          requiresSecondTherapist: false,
          tvDisplayName: "E 풀코스120"
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
      opsCallCredit: "-1",
      earcarePoolAmount: "-1",
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

    assert.equal(first.coursesCreated, 5);
    assert.equal(first.coursePoliciesCreated, 5);
    assert.equal(first.therapistRatesCreated, 250);
    assert.equal(first.opsDailyRulesCreated, 3);
    assert.equal(first.opsMonthlyRulesCreated, 6);
    assert.equal(second.coursesCreated + second.coursePoliciesCreated + second.therapistRatesCreated, 0);
    assert.equal(courses.length, 5);
    assert.equal(courses.find((course) => course.code === "D")?.currentPolicy?.requiresSecondTherapist, true);
    assert.equal(prismaClient.therapistRates.size, 250);
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
    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "course.created").length, 5);
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
      opsCallCredit: before.currentPolicy.opsCallCredit,
      earcarePoolAmount: before.currentPolicy.earcarePoolAmount,
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
      opsCallCredit: 1,
      earcarePoolAmount: 0,
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
    const course = (await listCourses({ monthKey: "2026-06", prismaClient })).find((item) => item.code === "B");
    assert.ok(course?.currentPolicy);

    await updateCoursePolicy({
      actorId: "admin-1",
      policyId: course.currentPolicy.id,
      name: course.currentPolicy.name,
      durationMinutes: course.currentPolicy.durationMinutes,
      basePrice: course.currentPolicy.basePrice,
      opsCallCredit: course.currentPolicy.opsCallCredit,
      earcarePoolAmount: course.currentPolicy.earcarePoolAmount,
      requiresSecondTherapist: course.currentPolicy.requiresSecondTherapist,
      tvDisplayName: course.currentPolicy.tvDisplayName,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: "2026-06",
      prismaClient
    });
    await createCoursePolicy({
      actorId: "admin-1",
      courseId: course.id,
      name: "90분 B코스 새 정책",
      durationMinutes: 90,
      basePrice: 1900000,
      opsCallCredit: 1,
      earcarePoolAmount: 100000,
      requiresSecondTherapist: false,
      tvDisplayName: "B 새정책",
      effectiveFromMonth: "2026-07",
      effectiveToMonth: null,
      prismaClient
    });

    const june = await getCoursePolicyForMonth({ courseId: course.id, monthKey: "2026-06", prismaClient });
    const july = await getCoursePolicyForMonth({ courseId: course.id, monthKey: "2026-07", prismaClient });
    assert.equal(june.basePrice, 1800000);
    assert.equal(july.basePrice, 1900000);
    await assert.rejects(
      () =>
        createCoursePolicy({
          actorId: "admin-1",
          courseId: course.id,
          name: "겹침",
          durationMinutes: 90,
          basePrice: 2000000,
          opsCallCredit: 1,
          earcarePoolAmount: 0,
          requiresSecondTherapist: false,
          tvDisplayName: "겹침",
          effectiveFromMonth: "2026-07",
          effectiveToMonth: "2026-08",
          prismaClient
        }),
      /적용월 범위가 겹칩니다/
    );
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
    const course = (await listCourses({ monthKey: "2026-06", prismaClient })).find((item) => item.code === "E");
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

  it("returns domain errors instead of silently assuming missing policy values", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      () => getCoursePolicyForMonth({ courseId: "missing-course", monthKey: "2026-06", prismaClient }),
      (error) => error instanceof CourseDomainError && error.code === "COURSE_POLICY_NOT_FOUND"
    );
  });
});
