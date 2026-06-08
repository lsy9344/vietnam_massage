import { z } from "zod";

export const operatingMonthStatuses = ["작성중", "검토중", "마감확정", "잠금"] as const;

export type OperatingMonthStatus = (typeof operatingMonthStatuses)[number];

export const operatingMonthKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "운영월은 YYYY-MM 형식이어야 합니다.");

function isValidIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth;
}

export const isoDateOnlySchema = z
  .string()
  .trim()
  .refine(isValidIsoDateOnly, "날짜는 ISO YYYY-MM-DD 형식이어야 합니다.");

export const operatingMonthStatusSchema = z.enum(operatingMonthStatuses, {
  error: "운영월 상태는 작성중, 검토중, 마감확정, 잠금 중 하나여야 합니다."
});

export const createOperatingMonthSchema = z.object({
  monthKey: operatingMonthKeySchema,
  startDate: isoDateOnlySchema.optional(),
  endDate: isoDateOnlySchema.optional()
});

export const changeOperatingMonthStatusSchema = z.object({
  monthKey: operatingMonthKeySchema,
  status: operatingMonthStatusSchema
});
