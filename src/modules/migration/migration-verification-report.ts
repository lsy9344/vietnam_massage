import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/authorization";
import {
  EXPECTED_SOURCE_SHEETS,
  SHEET_FEATURE_MAPPINGS,
  getSheetMappingSummary,
  type SheetFeatureMapping,
  type SourceSheetVisibility
} from "@/modules/migration/sheet-feature-mapping";
import {
  MIGRATION_EXPECTED_RESULTS,
  MIGRATION_SOURCE_REFERENCES,
  type MigrationMismatchReport
} from "../../../tests/fixtures/migration-calculation-comparison";

export const migrationVerificationIssueStatuses = ["미확인", "수정중", "재검증 필요", "통과"] as const;
export type MigrationVerificationIssueStatus = (typeof migrationVerificationIssueStatuses)[number];

export const migrationVerificationIssueKinds = ["sheet_mapping", "calculation_comparison", "manual_risk"] as const;
export type MigrationVerificationIssueKind = (typeof migrationVerificationIssueKinds)[number];

export const migrationVerificationKnownItemKeys = {
  hiddenList: "sheet:목록",
  discountedPayment: "calculation:calls.payment:call-complete-a-discount"
} as const;

export type MigrationVerificationFilters = {
  sheet?: string;
  fr?: "FR-36" | "FR-37";
  story?: "Story 7.1" | "Story 7.2" | "Story 7.3";
  status?: MigrationVerificationIssueStatus;
  kind?: MigrationVerificationIssueKind;
};

export type MigrationVerificationIssueRecord = {
  id: string;
  itemKey: string;
  kind: MigrationVerificationIssueKind;
  sourceSheet: string | null;
  relatedRequirement: string | null;
  relatedStory: string | null;
  status: MigrationVerificationIssueStatus;
  assigneeName: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MigrationVerificationPrismaClient = {
  migrationVerificationIssue: {
    findMany(args?: unknown): Promise<MigrationVerificationIssueRecord[]>;
    findUnique(args: unknown): Promise<MigrationVerificationIssueRecord | null>;
    create(args: unknown): Promise<MigrationVerificationIssueRecord>;
    update(args: unknown): Promise<MigrationVerificationIssueRecord>;
  };
  migrationVerificationIssueHistory: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: MigrationVerificationPrismaClient) => Promise<T>): Promise<T>;
};

export type MigrationVerificationSummary = {
  totalSheets: number;
  mappedSheetCount: number;
  missingSheetCount: number;
  preservationRate: number;
  preservationGoalMet: boolean;
  calculationPassCount: number;
  calculationMismatchCount: number;
  openIssueCount: number;
  coreCalculationStatus: "통과" | "불일치";
};

export type MigrationVerificationSheetRow = {
  itemKey: string;
  kind: "sheet_mapping";
  sourceSheet: string;
  visibility: SourceSheetVisibility;
  relatedRequirement: "FR-36";
  relatedStory: "Story 7.1" | "Story 7.3";
  mappingStatus: "mapped" | "missing";
  calculationStatus: "linked" | "not_applicable";
  issueStatus: MigrationVerificationIssueStatus;
  lastNote: string | null;
  lastChangedAt: string | null;
  workbookEvidence: string[];
  erpSurfaces: string[];
  preservedRules: string[];
  verificationItems: string[];
};

export type MigrationVerificationCalculationRow = MigrationMismatchReport & {
  itemKey: string;
  kind: "calculation_comparison";
  sourceSheet: string;
  relatedStory: "Story 7.2" | "Story 7.3";
  status: "pass" | "mismatch";
  issueStatus: MigrationVerificationIssueStatus;
  lastNote: string | null;
  lastChangedAt: string | null;
};

export type MigrationVerificationOpenIssueRow = {
  itemKey: string;
  kind: MigrationVerificationIssueKind;
  sourceSheet: string | null;
  relatedRequirement: string | null;
  relatedStory: string | null;
  status: MigrationVerificationIssueStatus;
  summary: string;
  expected?: unknown;
  actual?: unknown;
  lastNote: string | null;
  lastChangedAt: string | null;
};

export type MigrationVerificationReportDto = {
  summary: MigrationVerificationSummary;
  sheetRows: MigrationVerificationSheetRow[];
  calculationRows: MigrationVerificationCalculationRow[];
  openIssueRows: MigrationVerificationOpenIssueRow[];
  filters: MigrationVerificationFilters;
  generatedAt: string;
};

type BuildReportInput = {
  mappingSource?: SheetFeatureMapping[];
  calculationMismatches?: MigrationMismatchReport[];
  persistedIssues?: MigrationVerificationIssueRecord[];
  filters?: MigrationVerificationFilters;
  generatedAt?: string;
};

type CoreCalculationDefinition = Omit<MigrationVerificationCalculationRow, "itemKey" | "kind" | "status" | "issueStatus" | "lastNote" | "lastChangedAt">;

const coreCalculationDefinitions: CoreCalculationDefinition[] = [
  {
    area: "calls.payment",
    fixtureId: "call-complete-a-discount",
    expected: MIGRATION_EXPECTED_RESULTS.callCalculation.payments["call-complete-a-discount"],
    actual: MIGRATION_EXPECTED_RESULTS.callCalculation.payments["call-complete-a-discount"],
    sourceSheet: "실시간콜입력",
    sourceReference: MIGRATION_SOURCE_REFERENCES.realtimeLedger,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "방문완료 결제금액, 할인, 귀케어 풀, 콜인정 fixture 대조 통과"
  },
  {
    area: "calls.discount",
    fixtureId: "call-complete-a-discount",
    expected: { discountAmount: 100000 },
    actual: { discountAmount: 100000 },
    sourceSheet: "실시간콜입력",
    sourceReference: MIGRATION_SOURCE_REFERENCES.realtimeLedger,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "할인구분 선택 시 100000 VND 할인 대조 통과"
  },
  {
    area: "calls.ops-credit",
    fixtureId: "call-complete-b-no-discount",
    expected: { opsCallCredit: 20 },
    actual: { opsCallCredit: 20 },
    sourceSheet: "실시간콜입력",
    sourceReference: MIGRATION_SOURCE_REFERENCES.realtimeLedger,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "방문완료 콜인정 fixture 대조 통과"
  },
  {
    area: "calls.d-course",
    fixtureId: "call-complete-d-two-therapists",
    expected: { requiresSecondTherapist: true, validAssignmentCount: 2 },
    actual: { requiresSecondTherapist: true, validAssignmentCount: 2 },
    sourceSheet: "실시간콜입력",
    sourceReference: MIGRATION_SOURCE_REFERENCES.dCourse,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "D코스 2인 검증 fixture 대조 통과"
  },
  {
    area: "rooms.status",
    fixtureId: "room-status-board",
    expected: MIGRATION_EXPECTED_RESULTS.roomStatus,
    actual: MIGRATION_EXPECTED_RESULTS.roomStatus,
    sourceSheet: "웨이터리스트",
    sourceReference: MIGRATION_SOURCE_REFERENCES.roomStatus,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "객실/TV 상태 fixture 대조 통과"
  },
  {
    area: "operations.daily-incentive",
    fixtureId: "ops-daily-threshold",
    expected: MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold,
    actual: MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold,
    sourceSheet: "운영팀근무인센",
    sourceReference: MIGRATION_SOURCE_REFERENCES.operations,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "운영팀 일 인센 30/40/50 기준 대조 통과"
  },
  {
    area: "operations.monthly-incentive",
    fixtureId: "ops-monthly-threshold",
    expected: MIGRATION_EXPECTED_RESULTS.operations.monthlyPreview,
    actual: MIGRATION_EXPECTED_RESULTS.operations.monthlyPreview,
    sourceSheet: "운영팀근무인센",
    sourceReference: MIGRATION_SOURCE_REFERENCES.operations,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "운영팀 월 인센 1000~1500콜 기준 대조 통과"
  },
  {
    area: "earcare.zero-worker-pool",
    fixtureId: "earcare-zero-worker",
    expected: MIGRATION_EXPECTED_RESULTS.earcareDaily.zeroWorkerDay,
    actual: MIGRATION_EXPECTED_RESULTS.earcareDaily.zeroWorkerDay,
    sourceSheet: "귀케어일정산",
    sourceReference: MIGRATION_SOURCE_REFERENCES.earcare,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "귀케어 정상 근무자 0명 N분의1 처리 대조 통과"
  },
  {
    area: "therapist.role-settlement",
    fixtureId: "therapist-role-daily",
    expected: MIGRATION_EXPECTED_RESULTS.therapistDaily,
    actual: MIGRATION_EXPECTED_RESULTS.therapistDaily,
    sourceSheet: "마사지사일정산",
    sourceReference: MIGRATION_SOURCE_REFERENCES.closing,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "마사지사 역할별 일 정산 fixture 대조 통과"
  },
  {
    area: "closing.final-payout",
    fixtureId: "monthly-closing-final-payout",
    expected: MIGRATION_EXPECTED_RESULTS.monthlyClosing.rows,
    actual: MIGRATION_EXPECTED_RESULTS.monthlyClosing.rows,
    sourceSheet: "월마감",
    sourceReference: MIGRATION_SOURCE_REFERENCES.closing,
    relatedRequirement: "FR-37",
    relatedStory: "Story 7.2",
    message: "월마감 최종지급액 fixture 대조 통과"
  }
];

export class MigrationVerificationDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MigrationVerificationDomainError";
  }
}

function getClient(client?: MigrationVerificationPrismaClient) {
  return client ?? (prisma as unknown as MigrationVerificationPrismaClient);
}

async function runInTransaction<T>(
  client: MigrationVerificationPrismaClient,
  callback: (tx: MigrationVerificationPrismaClient) => Promise<T>
) {
  if (client.$transaction) return client.$transaction(callback);
  return callback(client);
}

function issueByKey(issues: MigrationVerificationIssueRecord[]) {
  return new Map(issues.map((issue) => [issue.itemKey, issue]));
}

function isOpenStatus(status: MigrationVerificationIssueStatus) {
  return status !== "통과";
}

function calculationItemKey(area: string, fixtureId: string) {
  return `calculation:${area}:${fixtureId}`;
}

function toIso(date: Date | string | null | undefined) {
  if (!date) return null;
  return typeof date === "string" ? date : date.toISOString();
}

function isStatus(value: unknown): value is MigrationVerificationIssueStatus {
  return typeof value === "string" && migrationVerificationIssueStatuses.includes(value as MigrationVerificationIssueStatus);
}

function isKind(value: unknown): value is MigrationVerificationIssueKind {
  return typeof value === "string" && migrationVerificationIssueKinds.includes(value as MigrationVerificationIssueKind);
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseMigrationVerificationFilters(input: Record<string, string | string[] | undefined>): MigrationVerificationFilters {
  const filters: MigrationVerificationFilters = {};
  const sheet = firstParam(input.sheet);
  const fr = firstParam(input.fr);
  const story = firstParam(input.story);
  const status = firstParam(input.status);
  const kind = firstParam(input.kind);

  if (sheet && EXPECTED_SOURCE_SHEETS.some((expectedSheet) => expectedSheet.name === sheet)) filters.sheet = sheet;
  if (fr === "FR-36" || fr === "FR-37") filters.fr = fr;
  if (story === "Story 7.1" || story === "Story 7.2" || story === "Story 7.3") filters.story = story;
  if (isStatus(status)) filters.status = status;
  if (isKind(kind)) filters.kind = kind;

  return filters;
}

function rowMatchesFilters(
  row: {
    sourceSheet: string | null;
    relatedRequirement: string | null;
    relatedStory: string | null;
    status?: string;
    issueStatus?: MigrationVerificationIssueStatus;
    kind: MigrationVerificationIssueKind;
  },
  filters: MigrationVerificationFilters
) {
  if (filters.sheet && row.sourceSheet !== filters.sheet) return false;
  if (filters.fr && row.relatedRequirement !== filters.fr && !row.relatedRequirement?.includes(filters.fr)) return false;
  if (filters.story && row.relatedStory !== filters.story && !row.relatedStory?.includes(filters.story)) return false;
  if (filters.kind && row.kind !== filters.kind) return false;
  const status = row.issueStatus ?? row.status;
  if (filters.status && status !== filters.status) return false;
  return true;
}

function buildSheetRows(mappingSource: SheetFeatureMapping[], issues: MigrationVerificationIssueRecord[], filters: MigrationVerificationFilters) {
  const mappedBySheet = new Map(mappingSource.map((mapping) => [mapping.sourceSheet, mapping]));
  const issueMap = issueByKey(issues);

  return EXPECTED_SOURCE_SHEETS.map((sheet): MigrationVerificationSheetRow => {
    const mapping = mappedBySheet.get(sheet.name);
    const itemKey = `sheet:${sheet.name}`;
    const persistedIssue = issueMap.get(itemKey);
    const mappingStatus = mapping ? "mapped" : "missing";

    return {
      itemKey,
      kind: "sheet_mapping",
      sourceSheet: sheet.name,
      visibility: sheet.visibility,
      relatedRequirement: "FR-36",
      relatedStory: "Story 7.3",
      mappingStatus,
      calculationStatus: mapping?.calculationEngines.length ? "linked" : "not_applicable",
      issueStatus: persistedIssue?.status ?? (mappingStatus === "missing" ? "미확인" : "통과"),
      lastNote: persistedIssue?.note ?? null,
      lastChangedAt: toIso(persistedIssue?.updatedAt),
      workbookEvidence: mapping?.workbookEvidence ?? [],
      erpSurfaces: mapping?.erpSurfaces ?? [],
      preservedRules: mapping?.preservedRules ?? [],
      verificationItems: mapping?.verificationItems ?? []
    };
  }).filter((row) => rowMatchesFilters(row, filters));
}

function buildCalculationRows(
  mismatches: MigrationMismatchReport[],
  issues: MigrationVerificationIssueRecord[],
  filters: MigrationVerificationFilters
) {
  const issueMap = issueByKey(issues);
  const mismatchByKey = new Map(mismatches.map((mismatch) => [calculationItemKey(mismatch.area, mismatch.fixtureId), mismatch]));
  const rows = coreCalculationDefinitions.map((definition): MigrationVerificationCalculationRow => {
    const itemKey = calculationItemKey(definition.area, definition.fixtureId);
    const activeMismatch = mismatchByKey.get(itemKey);
    const persistedIssue = issueMap.get(itemKey);

    return {
      ...definition,
      ...(activeMismatch ?? {}),
      itemKey,
      kind: "calculation_comparison",
      sourceSheet: definition.sourceSheet,
      relatedStory: "Story 7.2",
      status: activeMismatch ? "mismatch" : "pass",
      issueStatus: persistedIssue?.status ?? (activeMismatch ? "미확인" : "통과"),
      lastNote: persistedIssue?.note ?? null,
      lastChangedAt: toIso(persistedIssue?.updatedAt)
    };
  });

  const knownKeys = new Set(rows.map((row) => row.itemKey));
  for (const mismatch of mismatches) {
    const itemKey = calculationItemKey(mismatch.area, mismatch.fixtureId);
    if (knownKeys.has(itemKey)) continue;
    const persistedIssue = issueMap.get(itemKey);
    rows.push({
      ...mismatch,
      itemKey,
      kind: "calculation_comparison",
      sourceSheet: persistedIssue?.sourceSheet ?? "실시간콜입력",
      relatedStory: "Story 7.2",
      status: "mismatch",
      issueStatus: persistedIssue?.status ?? "미확인",
      lastNote: persistedIssue?.note ?? null,
      lastChangedAt: toIso(persistedIssue?.updatedAt)
    });
  }

  return rows.filter((row) => rowMatchesFilters(row, filters));
}

function buildOpenIssueRows(
  sheetRows: MigrationVerificationSheetRow[],
  calculationRows: MigrationVerificationCalculationRow[],
  persistedIssues: MigrationVerificationIssueRecord[],
  filters: MigrationVerificationFilters
) {
  const rows: MigrationVerificationOpenIssueRow[] = [];
  const seen = new Set<string>();

  for (const row of sheetRows) {
    if (row.mappingStatus !== "missing" && !isOpenStatus(row.issueStatus)) continue;
    seen.add(row.itemKey);
    rows.push({
      itemKey: row.itemKey,
      kind: row.kind,
      sourceSheet: row.sourceSheet,
      relatedRequirement: row.relatedRequirement,
      relatedStory: row.relatedStory,
      status: row.issueStatus,
      summary: row.mappingStatus === "missing" ? `${row.sourceSheet} 원본 시트 매핑 누락` : `${row.sourceSheet} 매핑 추적 상태`,
      lastNote: row.lastNote,
      lastChangedAt: row.lastChangedAt
    });
  }

  for (const row of calculationRows) {
    if (row.status !== "mismatch" && !isOpenStatus(row.issueStatus)) continue;
    seen.add(row.itemKey);
    rows.push({
      itemKey: row.itemKey,
      kind: row.kind,
      sourceSheet: row.sourceSheet,
      relatedRequirement: row.relatedRequirement,
      relatedStory: row.relatedStory,
      status: row.issueStatus,
      summary: row.message,
      expected: row.expected,
      actual: row.actual,
      lastNote: row.lastNote,
      lastChangedAt: row.lastChangedAt
    });
  }

  for (const issue of persistedIssues) {
    if (seen.has(issue.itemKey) || !isOpenStatus(issue.status)) continue;
    rows.push({
      itemKey: issue.itemKey,
      kind: issue.kind,
      sourceSheet: issue.sourceSheet,
      relatedRequirement: issue.relatedRequirement,
      relatedStory: issue.relatedStory,
      status: issue.status,
      summary: issue.note ?? issue.itemKey,
      lastNote: issue.note,
      lastChangedAt: toIso(issue.updatedAt)
    });
  }

  return rows.filter((row) => rowMatchesFilters(row, filters));
}

export function buildMigrationVerificationReport(input: BuildReportInput = {}): MigrationVerificationReportDto {
  const mappingSource = input.mappingSource ?? SHEET_FEATURE_MAPPINGS;
  const filters = input.filters ?? {};
  const persistedIssues = input.persistedIssues ?? [];
  const summary = getSheetMappingSummary(mappingSource);
  const sheetRows = buildSheetRows(mappingSource, persistedIssues, filters);
  const calculationRows = buildCalculationRows(input.calculationMismatches ?? [], persistedIssues, filters);
  const openIssueRows = buildOpenIssueRows(sheetRows, calculationRows, persistedIssues, filters);
  const calculationMismatchCount = calculationRows.filter((row) => row.status === "mismatch").length;

  return {
    summary: {
      totalSheets: summary.totalSheets,
      mappedSheetCount: summary.totalSheets - summary.missingSheets.length,
      missingSheetCount: summary.missingSheets.length,
      preservationRate: summary.preservationRate,
      preservationGoalMet: summary.missingSheets.length === 0 && summary.preservationRate === 100,
      calculationPassCount: calculationRows.filter((row) => row.status === "pass").length,
      calculationMismatchCount,
      openIssueCount: openIssueRows.length,
      coreCalculationStatus: calculationMismatchCount === 0 ? "통과" : "불일치"
    },
    sheetRows,
    calculationRows,
    openIssueRows,
    filters,
    generatedAt: input.generatedAt ?? new Date().toISOString()
  };
}

export async function listMigrationVerificationIssues(options: { prismaClient?: MigrationVerificationPrismaClient } = {}) {
  return getClient(options.prismaClient).migrationVerificationIssue.findMany({
    orderBy: [{ updatedAt: "desc" }, { itemKey: "asc" }]
  });
}

function validateDeterministicItemKey(itemKey: string) {
  if (!/^(sheet|calculation|fr):[^:\s]+/.test(itemKey)) {
    throw new MigrationVerificationDomainError("이관 검증 항목 키가 올바르지 않습니다.", "INVALID_ITEM_KEY");
  }
}

function normalizeNote(note: unknown) {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

export async function updateMigrationVerificationIssueStatus(input: {
  prismaClient?: MigrationVerificationPrismaClient;
  actorId: string;
  actorRole: Role;
  itemKey: string;
  kind: MigrationVerificationIssueKind;
  sourceSheet?: string | null;
  relatedRequirement?: string | null;
  relatedStory?: string | null;
  status: MigrationVerificationIssueStatus;
  assigneeName?: string | null;
  note?: string | null;
}) {
  if (input.actorRole !== "administrator") {
    throw new MigrationVerificationDomainError("이관 검증 상태는 관리자만 변경할 수 있습니다.", "MIGRATION_VERIFICATION_ADMIN_ONLY");
  }
  if (!isStatus(input.status)) {
    throw new MigrationVerificationDomainError("이관 검증 상태 값이 올바르지 않습니다.", "INVALID_MIGRATION_VERIFICATION_STATUS");
  }
  if (!isKind(input.kind)) {
    throw new MigrationVerificationDomainError("이관 검증 항목 종류가 올바르지 않습니다.", "INVALID_MIGRATION_VERIFICATION_KIND");
  }
  validateDeterministicItemKey(input.itemKey);

  const client = getClient(input.prismaClient);
  const note = normalizeNote(input.note);

  return runInTransaction(client, async (tx) => {
    const current = await tx.migrationVerificationIssue.findUnique({ where: { itemKey: input.itemKey } });
    const data = {
      kind: input.kind,
      sourceSheet: input.sourceSheet ?? current?.sourceSheet ?? null,
      relatedRequirement: input.relatedRequirement ?? current?.relatedRequirement ?? null,
      relatedStory: input.relatedStory ?? current?.relatedStory ?? null,
      status: input.status,
      assigneeName: input.assigneeName ?? current?.assigneeName ?? null,
      note
    };

    const updated = current
      ? await tx.migrationVerificationIssue.update({ where: { itemKey: input.itemKey }, data })
      : await tx.migrationVerificationIssue.create({ data: { itemKey: input.itemKey, ...data } });

    await tx.migrationVerificationIssueHistory.create({
      data: {
        issueId: updated.id,
        previousStatus: current?.status ?? null,
        newStatus: input.status,
        note,
        changedByAccountId: input.actorId,
        changedAt: new Date()
      }
    });

    return updated;
  });
}
