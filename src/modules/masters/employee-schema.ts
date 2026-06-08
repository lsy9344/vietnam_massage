import { z } from "zod";

export const employeeGroups = ["OPERATIONS", "EARCARE", "THERAPIST"] as const;
export const shiftTypes = ["전체", "주간", "야간"] as const;
export const employmentStatuses = ["재직", "퇴사", "휴직"] as const;
export const accountRoles = ["administrator", "counter", "waiter", "settlement_manager", "read_only_viewer"] as const;

export type EmployeeGroup = (typeof employeeGroups)[number];
export type ShiftType = (typeof shiftTypes)[number];
export type EmploymentStatus = (typeof employmentStatuses)[number];

export const employeeGroupLabels: Record<EmployeeGroup, string> = {
  OPERATIONS: "운영팀",
  EARCARE: "귀케어팀",
  THERAPIST: "마사지사"
};

function isValidIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type DefaultEmployee = {
  displayName: string;
  staffCode: string;
  employeeGroup: EmployeeGroup;
  position: string;
  shiftType: ShiftType | null;
  baseSalary: number;
  employmentStatus: EmploymentStatus;
  sortOrder: number;
};

const operationsEmployees: DefaultEmployee[] = [
  {
    displayName: "팀장",
    staffCode: "OPS-LEAD-001",
    employeeGroup: "OPERATIONS",
    position: "팀장",
    shiftType: "전체",
    baseSalary: 22000000,
    employmentStatus: "재직",
    sortOrder: 10
  },
  {
    displayName: "카운터1",
    staffCode: "OPS-COUNTER-DAY-001",
    employeeGroup: "OPERATIONS",
    position: "카운터",
    shiftType: "주간",
    baseSalary: 12000000,
    employmentStatus: "재직",
    sortOrder: 20
  },
  {
    displayName: "카운터2",
    staffCode: "OPS-COUNTER-NIGHT-001",
    employeeGroup: "OPERATIONS",
    position: "카운터",
    shiftType: "야간",
    baseSalary: 12000000,
    employmentStatus: "재직",
    sortOrder: 30
  },
  {
    displayName: "웨이터1",
    staffCode: "OPS-WAITER-DAY-001",
    employeeGroup: "OPERATIONS",
    position: "웨이터",
    shiftType: "주간",
    baseSalary: 9000000,
    employmentStatus: "재직",
    sortOrder: 40
  },
  {
    displayName: "웨이터2",
    staffCode: "OPS-WAITER-NIGHT-001",
    employeeGroup: "OPERATIONS",
    position: "웨이터",
    shiftType: "야간",
    baseSalary: 9000000,
    employmentStatus: "재직",
    sortOrder: 50
  }
];

const earcareEmployees: DefaultEmployee[] = Array.from({ length: 4 }, (_, index) => ({
  displayName: `귀케어${index + 1}`,
  staffCode: `EAR-${String(index + 1).padStart(3, "0")}`,
  employeeGroup: "EARCARE",
  position: "귀케어사",
  shiftType: null,
  baseSalary: 5000000,
  employmentStatus: "재직",
  sortOrder: (index + 1) * 10
}));

const therapistEmployees: DefaultEmployee[] = Array.from({ length: 50 }, (_, index) => ({
  displayName: `마사지사${index + 1}`,
  staffCode: `THR-${String(index + 1).padStart(3, "0")}`,
  employeeGroup: "THERAPIST",
  position: "마사지사",
  shiftType: null,
  baseSalary: 0,
  employmentStatus: "재직",
  sortOrder: (index + 1) * 10
}));

// Static anchors for the generated boundary defaults: EAR-001, THR-050.

export const defaultEmployees: DefaultEmployee[] = [...operationsEmployees, ...earcareEmployees, ...therapistEmployees];

const optionalTrimmedTextSchema = z.preprocess(
  (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value),
  z.string().trim().max(80, "80자 이하여야 합니다.").nullable()
);

export const isoDateStringSchema = z.preprocess(
  (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value),
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.")
    .refine(isValidIsoDate, "유효한 날짜를 입력하세요.")
    .nullable()
);

const employeeIdSchema = z.string().trim().min(1, "직원 ID가 필요합니다.");
const staffCodeSchema = z
  .string()
  .trim()
  .min(1, "staff code를 입력하세요.")
  .max(60, "staff code는 60자 이하여야 합니다.")
  .regex(/^[A-Z0-9-]+$/, "staff code는 영문 대문자, 숫자, 하이픈만 사용할 수 있습니다.");
const displayNameSchema = z.string().trim().min(1, "이름을 입력하세요.").max(60, "이름은 60자 이하여야 합니다.");
const positionSchema = z.string().trim().min(1, "직책을 입력하세요.").max(40, "직책은 40자 이하여야 합니다.");
const employeeGroupSchema = z.enum(employeeGroups, { error: "직원 그룹이 올바르지 않습니다." });
const shiftTypeSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.enum(shiftTypes, { error: "주/야간 값이 올바르지 않습니다." }).nullable()
);
const employmentStatusSchema = z.enum(employmentStatuses, { error: "재직상태가 올바르지 않습니다." });
const baseSalarySchema = z.preprocess(
  (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? undefined : value),
  z.coerce
    .number({ error: "기본급을 입력하세요." })
    .int("기본급은 VND 정수여야 합니다.")
    .min(0, "기본급은 0 이상이어야 합니다.")
);
const sortOrderSchema = z.coerce
  .number({ error: "정렬 순서는 숫자여야 합니다." })
  .int("정렬 순서는 정수여야 합니다.")
  .min(1, "정렬 순서는 1 이상이어야 합니다.")
  .max(99999, "정렬 순서는 99999 이하여야 합니다.");

export const createEmployeeSchema = z.object({
  displayName: displayNameSchema,
  staffCode: staffCodeSchema,
  employeeGroup: employeeGroupSchema,
  position: positionSchema,
  shiftType: shiftTypeSchema,
  baseSalary: baseSalarySchema,
  phone: optionalTrimmedTextSchema,
  birthday: isoDateStringSchema,
  hireDate: isoDateStringSchema,
  employmentStatus: employmentStatusSchema,
  sortOrder: sortOrderSchema
});

export const updateEmployeeProfileSchema = createEmployeeSchema.extend({
  employeeId: employeeIdSchema
});

export const updateEmployeeSortOrderSchema = z.object({
  employeeId: employeeIdSchema,
  sortOrder: sortOrderSchema
});

export const deactivateEmployeeSchema = z.object({
  employeeId: employeeIdSchema
});

export const linkUserAccountToEmployeeSchema = z.object({
  employeeId: employeeIdSchema,
  email: z.string().trim().email("이메일 형식이 올바르지 않습니다."),
  accountId: z.string().trim().min(1, "계정 ID를 입력하세요.").max(80, "계정 ID는 80자 이하여야 합니다."),
  role: z.enum(accountRoles, { error: "계정 역할이 올바르지 않습니다." }),
  initialSecret: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").optional()
  )
});
