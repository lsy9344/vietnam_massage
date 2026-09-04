// One-off helper for the 10-hour full-attendance rule (client feedback 2026-09).
//
// The Prisma migration `20260904100000_full_attendance_10h_nullable_checkout` already
// re-evaluates the stored `is_full_attendance_recognized` flags to the 600-minute rule.
// What this script adds: regenerating the stored closing snapshots of already-confirmed
// (마감확정/잠금) months whose 만근 amounts changed. It reuses the domain confirm flow
// (lock -> reopen -> confirm, or reopen -> confirm -> lock) so every month gets a new
// closeVersion snapshot with a full audit trail instead of rewriting history in place.
// Open (작성중/검토중) months need no regeneration: their 월마감 preview is always
// computed from the current flags.
//
// NOTE: re-confirmation stores the CURRENT preview, so any data drift since the old
// confirmation (not just 만근) is included in the new version. This matches what the
// operator would produce by re-confirming the month manually.
//
// Usage:
//   npx tsx scripts/recalc-full-attendance.ts --dry-run   # report only (default)
//   npx tsx scripts/recalc-full-attendance.ts --apply     # re-confirm affected months

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { listMonthlyClosingPreview } from "@/modules/closing/monthly-closing-preview-service";
import {
  confirmMonthlyClose,
  lockMonthlyClose,
  reopenMonthlyClose
} from "@/modules/closing/monthly-closing-service";

type ManGeunEntry = { days: number | null; amount: number };

type TherapistRowLike = {
  employeeId: string;
  fullAttendanceDays?: number | null;
  fullAttendanceAllowanceAmount?: number;
};

const REOPEN_REASON = "만근 기준 10시간(600분) 소급 재계산";

function manGeunByEmployeeId(rows: TherapistRowLike[]): Map<string, ManGeunEntry> {
  return new Map(
    rows.map((row) => [
      row.employeeId,
      { days: row.fullAttendanceDays ?? null, amount: row.fullAttendanceAllowanceAmount ?? 0 }
    ])
  );
}

function manGeunDiff(snapshotRows: TherapistRowLike[], previewRows: TherapistRowLike[]): string[] {
  const before = manGeunByEmployeeId(snapshotRows);
  const after = manGeunByEmployeeId(previewRows);
  const changed: string[] = [];
  for (const employeeId of new Set([...before.keys(), ...after.keys()])) {
    const beforeEntry = before.get(employeeId);
    const afterEntry = after.get(employeeId);
    if (
      !beforeEntry ||
      !afterEntry ||
      beforeEntry.days !== afterEntry.days ||
      beforeEntry.amount !== afterEntry.amount
    ) {
      changed.push(
        `${employeeId}: ${JSON.stringify(beforeEntry ?? null)} -> ${JSON.stringify(afterEntry ?? null)}`
      );
    }
  }
  return changed;
}

async function main() {
  const apply = process.argv.includes("--apply");

  // The flag backfill lives in the 20260904100000 migration; refuse to run before it.
  const inconsistent = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "therapist_attendances"
     WHERE "is_full_attendance_recognized" <> ("standby_minutes" IS NOT NULL AND "standby_minutes" >= 600)`
  )) as Array<{ count: number }>;
  if ((inconsistent[0]?.count ?? 0) > 0) {
    throw new Error(
      "만근 플래그가 10시간 기준과 일치하지 않는 행이 있습니다. 먼저 `prisma migrate deploy`로 20260904100000 마이그레이션을 적용하세요."
    );
  }

  const administrator = await prisma.userAccount.findFirst({
    where: { role: "administrator", isActive: true },
    select: { id: true }
  });
  if (!administrator) {
    throw new Error("활성 administrator 계정을 찾을 수 없습니다.");
  }
  const actorId = administrator.id;

  const months = await prisma.operatingMonth.findMany({
    where: { status: { in: ["마감확정", "잠금"] } },
    orderBy: { monthKey: "asc" },
    select: { id: true, monthKey: true, status: true }
  });

  const affected: Array<{ month: (typeof months)[number]; diff: string[] }> = [];

  for (const month of months) {
    const closing = await prisma.monthlyClosing.findFirst({
      where: { operatingMonthId: month.id },
      orderBy: { closeVersion: "desc" }
    });
    if (!closing) {
      console.log(`[skip] ${month.monthKey}: 저장된 마감 스냅샷이 없습니다.`);
      continue;
    }

    const snapshotRows =
      ((closing.snapshotJson as { therapists?: { rows?: TherapistRowLike[] } } | null)?.therapists?.rows ??
        []) as TherapistRowLike[];
    const preview = await listMonthlyClosingPreview({ operatingMonthId: month.id });
    const diff = manGeunDiff(snapshotRows, (preview.therapists.rows as unknown) as TherapistRowLike[]);

    if (diff.length === 0) {
      console.log(`[ok] ${month.monthKey}: 만근 금액 변경 없음`);
      continue;
    }

    console.log(`[changed] ${month.monthKey} (${month.status})`);
    for (const line of diff) {
      console.log(`  ${line}`);
    }
    affected.push({ month, diff });
  }

  console.log(`대상 운영월: ${affected.length}개 / 전체 확정월: ${months.length}개`);

  if (!apply) {
    console.log("dry-run 모드입니다. 실제 재확정하려면 --apply 옵션으로 실행하세요.");
    return;
  }

  for (const { month } of affected) {
    console.log(`[apply] ${month.monthKey} (${month.status}) 재확정 시작`);
    if (month.status === "마감확정") {
      await lockMonthlyClose({ operatingMonthId: month.id, actorId });
    }
    await reopenMonthlyClose({ operatingMonthId: month.id, actorId, reason: REOPEN_REASON });
    await confirmMonthlyClose({ operatingMonthId: month.id, actorId });
    if (month.status === "잠금") {
      await lockMonthlyClose({ operatingMonthId: month.id, actorId });
    }
    console.log(`[apply] ${month.monthKey} 재확정 완료 (최종 상태: ${month.status})`);
  }

  console.log("완료: 만근 10시간 기준으로 마감 스냅샷을 재확정했습니다.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
