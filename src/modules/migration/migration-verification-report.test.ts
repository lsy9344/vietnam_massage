import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHEET_FEATURE_MAPPINGS } from "@/modules/migration/sheet-feature-mapping";
import {
  buildMigrationVerificationReport,
  parseMigrationVerificationFilters,
  updateMigrationVerificationIssueStatus,
  type MigrationVerificationIssueRecord,
  type MigrationVerificationPrismaClient
} from "@/modules/migration/migration-verification-report";
import { MIGRATION_SOURCE_REFERENCES, type MigrationMismatchReport } from "../../../tests/fixtures/migration-calculation-comparison";

function mismatch(input: Partial<MigrationMismatchReport> = {}): MigrationMismatchReport {
  return {
    area: input.area ?? "calls.payment",
    fixtureId: input.fixtureId ?? "call-complete-a-discount",
    expected: input.expected ?? { paymentAmount: 1400000 },
    actual: input.actual ?? { paymentAmount: 1500000 },
    sourceReference: input.sourceReference ?? MIGRATION_SOURCE_REFERENCES.realtimeLedger,
    relatedRequirement: input.relatedRequirement ?? "FR-37 / Story 7.2",
    message: input.message ?? "방문완료 할인 계산이 fixture 기대값과 다릅니다."
  };
}

function issue(overrides: Partial<MigrationVerificationIssueRecord> = {}): MigrationVerificationIssueRecord {
  const now = new Date("2034-06-10T09:00:00.000Z");
  return {
    id: overrides.id ?? `issue-${overrides.itemKey ?? "default"}`,
    itemKey: overrides.itemKey ?? "sheet:목록",
    kind: overrides.kind ?? "sheet_mapping",
    sourceSheet: overrides.sourceSheet ?? "목록",
    relatedRequirement: overrides.relatedRequirement ?? "FR-36",
    relatedStory: overrides.relatedStory ?? "Story 7.1",
    status: overrides.status ?? "미확인",
    assigneeName: overrides.assigneeName ?? null,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function createMemoryClient(initialIssues: MigrationVerificationIssueRecord[] = []) {
  const issues = initialIssues.map((row) => ({ ...row }));
  const histories: unknown[] = [];

  const client: MigrationVerificationPrismaClient = {
    migrationVerificationIssue: {
      findMany: async () => issues,
      findUnique: async (args: any) => issues.find((row) => row.itemKey === args.where.itemKey) ?? null,
      create: async (args: any) => {
        const row = {
          id: `issue-${issues.length + 1}`,
          createdAt: new Date("2034-06-10T10:00:00.000Z"),
          updatedAt: new Date("2034-06-10T10:00:00.000Z"),
          assigneeName: null,
          note: null,
          ...args.data
        };
        issues.push(row);
        return row;
      },
      update: async (args: any) => {
        const index = issues.findIndex((row) => row.itemKey === args.where.itemKey);
        if (index === -1) throw new Error("not found");
        issues[index] = { ...issues[index], ...args.data, updatedAt: new Date("2034-06-10T10:05:00.000Z") };
        return issues[index];
      }
    },
    migrationVerificationIssueHistory: {
      create: async (args: any) => {
        histories.push(args.data);
        return { id: `history-${histories.length}`, createdAt: new Date("2034-06-10T10:05:00.000Z"), ...args.data };
      }
    },
    $transaction: async <T,>(callback: (tx: MigrationVerificationPrismaClient) => Promise<T>) => callback(client)
  };

  return { client, histories };
}

describe("Story 7.3 migration verification report", () => {
  it("builds a report with 100 percent preservation rate and all Story 7.2 core calculation pass rows", () => {
    const report = buildMigrationVerificationReport({ generatedAt: "2034-06-10T00:00:00.000Z" });

    assert.equal(report.summary.totalSheets, 12);
    assert.equal(report.summary.mappedSheetCount, 12);
    assert.equal(report.summary.missingSheetCount, 0);
    assert.equal(report.summary.preservationRate, 100);
    assert.equal(report.summary.preservationGoalMet, true);
    assert.equal(report.summary.coreCalculationStatus, "통과");

    for (const requiredArea of [
      "calls.payment",
      "calls.discount",
      "calls.ops-credit",
      "calls.d-course",
      "rooms.status",
      "operations.daily-incentive",
      "operations.monthly-incentive",
      "earcare.zero-worker-pool",
      "therapist.role-settlement",
      "closing.final-payout"
    ]) {
      assert.ok(report.calculationRows.some((row) => row.area === requiredArea && row.status === "pass"), requiredArea);
    }
  });

  it("marks hidden 목록 as missing and lowers preservation below 100 percent when mapping source omits it", () => {
    const report = buildMigrationVerificationReport({
      mappingSource: SHEET_FEATURE_MAPPINGS.filter((mapping) => mapping.sourceSheet !== "목록")
    });

    assert.equal(report.summary.missingSheetCount, 1);
    assert.equal(report.summary.preservationGoalMet, false);
    assert.ok(report.summary.preservationRate < 100);
    assert.ok(report.sheetRows.some((row) => row.sourceSheet === "목록" && row.mappingStatus === "missing"));
    assert.ok(report.openIssueRows.some((row) => row.itemKey === "sheet:목록"));
  });

  it("preserves Story 7.2 mismatch report shape for injected mismatch calculation rows", () => {
    const report = buildMigrationVerificationReport({ calculationMismatches: [mismatch()] });
    const row = report.calculationRows.find((candidate) => candidate.itemKey === "calculation:calls.payment:call-complete-a-discount");

    assert.ok(row);
    assert.equal(row.status, "mismatch");
    assert.equal(row.area, "calls.payment");
    assert.equal(row.fixtureId, "call-complete-a-discount");
    assert.deepEqual(row.expected, { paymentAmount: 1400000 });
    assert.deepEqual(row.actual, { paymentAmount: 1500000 });
    assert.match(row.sourceReference, /A:S/);
    assert.equal(row.relatedRequirement, "FR-37 / Story 7.2");
    assert.match(row.message, /할인/);
    assert.equal(report.summary.coreCalculationStatus, "불일치");
  });

  it("keeps passed calculations open when persisted tracking status is 재검증 필요", () => {
    const report = buildMigrationVerificationReport({
      persistedIssues: [
        issue({
          itemKey: "calculation:earcare.zero-worker-pool:earcare-zero-worker",
          kind: "calculation_comparison",
          sourceSheet: "귀케어일정산",
          relatedRequirement: "FR-37",
          relatedStory: "Story 7.2",
          status: "재검증 필요",
          note: "수정 배포 후 재검증 예정"
        })
      ]
    });

    const row = report.calculationRows.find((candidate) => candidate.itemKey === "calculation:earcare.zero-worker-pool:earcare-zero-worker");
    assert.ok(row);
    assert.equal(row.status, "pass");
    assert.equal(row.issueStatus, "재검증 필요");
    assert.ok(report.openIssueRows.some((candidate) => candidate.itemKey === row.itemKey && candidate.status === "재검증 필요"));
  });

  it("filters by sheet, FR, story, status, and kind using bounded URL search params", () => {
    const filters = parseMigrationVerificationFilters({
      sheet: "귀케어일정산",
      fr: "FR-37",
      story: "Story 7.2",
      status: "재검증 필요",
      kind: "calculation_comparison",
      ignored: "nope"
    });
    const report = buildMigrationVerificationReport({
      filters,
      persistedIssues: [
        issue({
          itemKey: "calculation:earcare.zero-worker-pool:earcare-zero-worker",
          kind: "calculation_comparison",
          sourceSheet: "귀케어일정산",
          relatedRequirement: "FR-37",
          relatedStory: "Story 7.2",
          status: "재검증 필요"
        }),
        issue({ itemKey: "sheet:목록", kind: "sheet_mapping", sourceSheet: "목록", relatedRequirement: "FR-36", status: "미확인" })
      ]
    });

    assert.deepEqual(report.filters, filters);
    assert.equal(report.openIssueRows.length, 1);
    assert.equal(report.openIssueRows[0]?.itemKey, "calculation:earcare.zero-worker-pool:earcare-zero-worker");
  });

  it("validates status and note, then appends issue history in one transaction", async () => {
    const { client, histories } = createMemoryClient([issue({ itemKey: "sheet:목록", status: "미확인" })]);

    await assert.rejects(
      () =>
        updateMigrationVerificationIssueStatus({
          prismaClient: client,
          actorId: "account-counter",
          actorRole: "counter",
          itemKey: "sheet:목록",
          kind: "sheet_mapping",
          status: "수정중"
        }),
      /관리자만/
    );

    await assert.rejects(
      () =>
        updateMigrationVerificationIssueStatus({
          prismaClient: client,
          actorId: "account-admin",
          actorRole: "administrator",
          itemKey: "sheet:목록",
          kind: "sheet_mapping",
          status: "완료" as any
        }),
      /상태/
    );

    const updated = await updateMigrationVerificationIssueStatus({
      prismaClient: client,
      actorId: "account-admin",
      actorRole: "administrator",
      itemKey: "sheet:목록",
      kind: "sheet_mapping",
      sourceSheet: "목록",
      relatedRequirement: "FR-36",
      relatedStory: "Story 7.3",
      status: "수정중",
      note: ` ${"담당자 메모".repeat(120)} `
    });

    assert.equal(updated.status, "수정중");
    assert.equal(updated.note?.length, 500);
    assert.equal(histories.length, 1);
    const history = histories[0] as { changedAt: Date };
    assert.deepEqual(history, {
      issueId: "issue-sheet:목록",
      previousStatus: "미확인",
      newStatus: "수정중",
      note: "담당자 메모".repeat(120).slice(0, 500),
      changedByAccountId: "account-admin",
      changedAt: history.changedAt
    });
  });
});
