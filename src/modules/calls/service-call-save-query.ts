import { Prisma } from "@prisma/client";

export type CallSaveReadClient = {
  $queryRaw?: (query: Prisma.Sql) => Promise<unknown>;
};

// Only the call save/readback path uses this join. Keep Prisma's global relation strategy unchanged.
// PostgreSQL JSON timestamps have no timezone (the Prisma columns store UTC).
export function callSaveRecordFromJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(callSaveRecordFromJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([column, child]) => {
    const key = column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    const date = ["serviceDate", "startDate", "endDate", "createdAt", "updatedAt"].includes(key);
    return [key, date && typeof child === "string"
      ? new Date(child.length === 10 ? `${child}T00:00:00Z` : /(?:Z|[+-]\d\d:\d\d)$/.test(child) ? child : `${child}Z`)
      : callSaveRecordFromJson(child)];
  }));
}

export async function readCallSaveRecords(client: CallSaveReadClient, where: Prisma.Sql): Promise<unknown[]> {
  if (!client.$queryRaw) throw new Error("Call save joined reads require PostgreSQL.");
  const rows = await client.$queryRaw(Prisma.sql`
    SELECT to_jsonb(c) || jsonb_build_object(
      'operatingMonth', to_jsonb(m), 'room', to_jsonb(r),
      'course', to_jsonb(co) || jsonb_build_object('policies',
        COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM course_policies p WHERE p.course_id = co.id), '[]'::jsonb)),
      'assignments', COALESCE((
        SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('employee', jsonb_build_object(
          'id', e.id, 'displayName', e.display_name, 'staffCode', e.staff_code,
          'employeeGroup', e.employee_group, 'isActive', e.is_active)))
        FROM service_call_assignments a JOIN employees e ON e.id = a.employee_id
        WHERE a.service_call_id = c.id
      ), '[]'::jsonb)
    ) AS record
    FROM service_calls c
    JOIN operating_months m ON m.id = c.operating_month_id
    JOIN courses co ON co.id = c.course_id
    LEFT JOIN rooms r ON r.id = c.room_id
    WHERE ${where}
  `) as Array<{ record: unknown }>;
  return rows.map(({ record }) => callSaveRecordFromJson(record));
}

export const callSaveById = (id: string) => Prisma.sql`c.id = ${id}`;
export const callSaveByDay = (monthId: string, date: Date) => Prisma.sql`c.operating_month_id = ${monthId} AND c.service_date = ${date}`;
