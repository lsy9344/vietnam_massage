import { z } from "zod";

export const courseCodes = ["A", "B", "C", "D", "E"] as const;
export type CourseCode = (typeof courseCodes)[number];

export type DefaultCourseSeed = {
  code: CourseCode;
  name: string;
  durationMinutes: number;
  basePrice: number;
  opsCallCredit: number;
  earcarePoolAmount: number;
  requiresSecondTherapist: boolean;
  tvDisplayName: string;
};

export const defaultCourseSeeds: DefaultCourseSeed[] = [
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
];

export const defaultOpsDailyIncentiveSeeds = [
  { thresholdCallCount: 30, personalAmount: 50000 },
  { thresholdCallCount: 40, personalAmount: 100000 },
  { thresholdCallCount: 50, personalAmount: 200000 }
] as const;

export const defaultOpsMonthlyIncentiveSeeds = [
  { thresholdCallCount: 1000, totalAmount: 3000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
  { thresholdCallCount: 1100, totalAmount: 5000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
  { thresholdCallCount: 1200, totalAmount: 8000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
  { thresholdCallCount: 1300, totalAmount: 12000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
  { thresholdCallCount: 1400, totalAmount: 18000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 },
  { thresholdCallCount: 1500, totalAmount: 25000000, leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35 }
] as const;

const idSchema = z.string().trim().min(1, "ID가 필요합니다.");
const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, "적용월은 YYYY-MM 형식이어야 합니다.");
const nullableMonthSchema = z.preprocess(
  (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value),
  monthSchema.nullable()
);
const moneySchema = z.coerce
  .number({ error: "금액은 숫자여야 합니다." })
  .int("금액은 VND 정수여야 합니다.")
  .min(0, "금액은 0 이상 정수여야 합니다.");
const positiveIntSchema = z.coerce
  .number({ error: "숫자를 입력하세요." })
  .int("정수여야 합니다.")
  .min(1, "1 이상이어야 합니다.");
const nonNegativeIntSchema = z.coerce
  .number({ error: "숫자를 입력하세요." })
  .int("정수여야 합니다.")
  .min(0, "0 이상이어야 합니다.");
const shareSchema = z.coerce
  .number({ error: "분배율은 숫자여야 합니다." })
  .min(0, "분배율은 0 이상이어야 합니다.")
  .max(1, "분배율은 1 이하여야 합니다.");
const booleanSchema = z.preprocess((value) => {
  if (value === "true" || value === "on" || value === "Y") return true;
  if (value === "false" || value === "off" || value === "N" || value === null || value === undefined || value === "") return false;
  return value;
}, z.boolean({ error: "Y/N 값을 확인하세요." }));

function validateMonthRange<T extends { effectiveFromMonth: string; effectiveToMonth: string | null }>(value: T, context: z.RefinementCtx) {
  if (value.effectiveToMonth !== null && value.effectiveToMonth < value.effectiveFromMonth) {
    context.addIssue({
      code: "custom",
      path: ["effectiveToMonth"],
      message: "적용 종료월은 시작월보다 빠를 수 없습니다."
    });
  }
}

const coursePolicyBaseSchema = z.object({
  courseId: idSchema,
  name: z.string().trim().min(1, "코스명을 입력하세요.").max(100, "코스명은 100자 이하여야 합니다."),
  durationMinutes: positiveIntSchema,
  basePrice: moneySchema,
  opsCallCredit: nonNegativeIntSchema,
  earcarePoolAmount: moneySchema,
  requiresSecondTherapist: booleanSchema,
  tvDisplayName: z.string().trim().min(1, "TV 표시명을 입력하세요.").max(40, "TV 표시명은 40자 이하여야 합니다."),
  effectiveFromMonth: monthSchema,
  effectiveToMonth: nullableMonthSchema
});

export const createCoursePolicySchema = coursePolicyBaseSchema.superRefine(validateMonthRange);

export const updateCoursePolicySchema = coursePolicyBaseSchema.omit({ courseId: true }).extend({
  policyId: idSchema
}).superRefine(validateMonthRange);

export const deactivateCourseSchema = z.object({
  courseId: idSchema
});

const therapistCourseRateBaseSchema = z.object({
  therapistId: idSchema,
  courseId: idSchema,
  amount: moneySchema,
  effectiveFromMonth: monthSchema,
  effectiveToMonth: nullableMonthSchema
});

export const createTherapistCourseRateSchema = therapistCourseRateBaseSchema.superRefine(validateMonthRange);

export const updateTherapistCourseRateSchema = therapistCourseRateBaseSchema.omit({ therapistId: true, courseId: true }).extend({
  rateId: idSchema
}).superRefine(validateMonthRange);

export const endTherapistCourseRateSchema = z.object({
  rateId: idSchema,
  effectiveToMonth: monthSchema
});

const opsDailyIncentiveRuleBaseSchema = z.object({
  thresholdCallCount: positiveIntSchema,
  personalAmount: moneySchema,
  effectiveFromMonth: monthSchema,
  effectiveToMonth: nullableMonthSchema
});

export const createOpsDailyIncentiveRuleSchema = opsDailyIncentiveRuleBaseSchema.superRefine(validateMonthRange);

export const updateOpsDailyIncentiveRuleSchema = opsDailyIncentiveRuleBaseSchema.extend({
  ruleId: idSchema
}).superRefine(validateMonthRange);

const opsMonthlyIncentiveRuleBaseSchema = z.object({
  thresholdCallCount: positiveIntSchema,
  totalAmount: moneySchema,
  leadShare: shareSchema,
  counterTeamShare: shareSchema,
  waiterTeamShare: shareSchema,
  effectiveFromMonth: monthSchema,
  effectiveToMonth: nullableMonthSchema
});

function validateMonthlyRule(value: z.infer<typeof opsMonthlyIncentiveRuleBaseSchema>, context: z.RefinementCtx) {
    validateMonthRange(value, context);
    const shareTotal = value.leadShare + value.counterTeamShare + value.waiterTeamShare;
    if (Math.abs(shareTotal - 1) > 0.000001) {
      context.addIssue({
        code: "custom",
        path: ["leadShare"],
        message: "팀장/카운터팀/웨이터팀 분배율 합계는 1이어야 합니다."
      });
    }
}

export const createOpsMonthlyIncentiveRuleSchema = opsMonthlyIncentiveRuleBaseSchema.superRefine(validateMonthlyRule);

export const updateOpsMonthlyIncentiveRuleSchema = opsMonthlyIncentiveRuleBaseSchema.extend({
  ruleId: idSchema
}).superRefine(validateMonthlyRule);
