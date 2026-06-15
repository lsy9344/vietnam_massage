import { StatusBadge } from "@/components/domain/status-badge";
import { canPerform, requireRouteAccess } from "@/lib/authorization";
import { MigrationIssueStatusForm } from "@/app/(erp)/masters/sheet-mapping/issue-status-form";
import {
  buildMigrationVerificationReport,
  listMigrationVerificationIssues,
  migrationVerificationIssueKinds,
  migrationVerificationIssueStatuses,
  parseMigrationVerificationFilters,
  type MigrationVerificationCalculationRow,
  type MigrationVerificationFilters,
  type MigrationVerificationSheetRow
} from "@/modules/migration/migration-verification-report";
import { PageHeader } from "@/components/domain/page-header";

// Story 7.1 compatibility marker: report service still consumes getSheetMappingSummary().

type SheetMappingSearchParams = Record<string, string | string[] | undefined>;

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatEvidence(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function SummaryTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

function IssueStatusBadge({ status }: { status: string }) {
  const className =
    status === "통과"
      ? "border-success text-success"
      : status === "재검증 필요"
        ? "border-danger text-danger"
        : "border-border text-foreground";

  return <span className={`inline-flex border bg-background px-2 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function FilterSelect({
  name,
  label,
  value,
  options
}: {
  name: keyof MigrationVerificationFilters;
  label: string;
  value?: string;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted">
      {label}
      <select className="min-w-36 border border-border bg-background px-2 py-2 text-sm font-normal text-foreground" defaultValue={value ?? ""} name={name}>
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterPanel({ filters, sheetOptions }: { filters: MigrationVerificationFilters; sheetOptions: string[] }) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-3 border border-border bg-surface px-4 py-4" action="/masters/sheet-mapping">
      <FilterSelect label="시트" name="sheet" options={sheetOptions} value={filters.sheet} />
      <FilterSelect label="FR" name="fr" options={["FR-36", "FR-37"]} value={filters.fr} />
      <FilterSelect label="Story" name="story" options={["Story 7.1", "Story 7.2", "Story 7.3"]} value={filters.story} />
      <FilterSelect label="상태" name="status" options={[...migrationVerificationIssueStatuses]} value={filters.status} />
      <FilterSelect label="종류" name="kind" options={[...migrationVerificationIssueKinds]} value={filters.kind} />
      <button className="border border-border bg-foreground px-4 py-2 text-sm font-semibold text-background">필터 적용</button>
      <a className="border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground" href="/masters/sheet-mapping">
        초기화
      </a>
    </form>
  );
}

function VerificationTable({
  sheetRows,
  calculationRows
}: {
  sheetRows: MigrationVerificationSheetRow[];
  calculationRows: MigrationVerificationCalculationRow[];
}) {
  const rows = [
    ...sheetRows.map((row) => ({
      key: row.itemKey,
      sourceSheet: row.sourceSheet,
      visibility: row.visibility === "hidden" ? "숨김" : "표시",
      related: `${row.relatedRequirement} / ${row.relatedStory}`,
      mappingStatus: row.mappingStatus === "mapped" ? "매핑 완료" : "누락",
      calculationStatus: row.calculationStatus === "linked" ? "계산 연결" : "해당 없음",
      issueStatus: row.issueStatus,
      note: row.lastNote,
      changedAt: row.lastChangedAt
    })),
    ...calculationRows.map((row) => ({
      key: row.itemKey,
      sourceSheet: row.sourceSheet,
      visibility: "-",
      related: `${row.relatedRequirement} / ${row.relatedStory}`,
      mappingStatus: "매핑 참조",
      calculationStatus: row.status === "pass" ? "계산 통과" : "계산 불일치",
      issueStatus: row.issueStatus,
      note: row.lastNote ?? row.message,
      changedAt: row.lastChangedAt
    }))
  ];

  return (
    <section className="mb-5 overflow-x-auto border border-border bg-surface" aria-label="이관 검증 리포트 표">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold text-muted">
            <th className="px-4 py-3">source sheet</th>
            <th className="px-4 py-3">visibility</th>
            <th className="px-4 py-3">FR / story</th>
            <th className="px-4 py-3">mapping status</th>
            <th className="px-4 py-3">calculation status</th>
            <th className="px-4 py-3">issue status</th>
            <th className="px-4 py-3">마지막 메모/변경 시각</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border align-top last:border-0" key={row.key}>
              <td className="px-4 py-4 font-semibold text-foreground">{row.sourceSheet}</td>
              <td className="px-4 py-4 text-foreground">{row.visibility}</td>
              <td className="px-4 py-4 text-foreground">{row.related}</td>
              <td className="px-4 py-4 text-foreground">{row.mappingStatus}</td>
              <td className="px-4 py-4 text-foreground">{row.calculationStatus}</td>
              <td className="px-4 py-4">
                <IssueStatusBadge status={row.issueStatus} />
              </td>
              <td className="px-4 py-4 text-muted">
                <div>{row.note ?? "-"}</div>
                <div className="mt-1 text-xs">{formatDateTime(row.changedAt)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {items.length === 0 ? (
          <li>-</li>
        ) : (
          items.map((item) => <li key={item}>- {item}</li>)
        )}
      </ul>
    </div>
  );
}

function SheetEvidenceDetails({ rows }: { rows: MigrationVerificationSheetRow[] }) {
  return (
    <section className="mb-5 border border-border bg-surface px-4 py-4" aria-label="시트 매핑 증거">
      <h2 className="text-base font-semibold text-foreground">원본 근거와 보존 규칙</h2>
      <div className="mt-3 grid gap-3">
        {rows.map((row) => (
          <details className="border border-border bg-background px-3 py-3" key={row.itemKey}>
            <summary className="cursor-pointer text-sm font-semibold text-brand underline-offset-4 hover:underline">
              {row.sourceSheet} 원본 근거, ERP 연결, 보존 규칙, 검증 항목 보기
            </summary>
            <div className="mt-3 grid gap-4 border-t border-border pt-3 lg:grid-cols-2">
              <ListBlock title="원본 근거" items={row.workbookEvidence} />
              <ListBlock title="ERP 연결" items={row.erpSurfaces} />
              <ListBlock title="보존 규칙" items={row.preservedRules} />
              <ListBlock title="검증 항목" items={row.verificationItems} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function CalculationDetails({ rows }: { rows: MigrationVerificationCalculationRow[] }) {
  return (
    <section className="mb-5 overflow-x-auto border border-border bg-surface" aria-label="계산 대조 상세">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">계산 대조 상세</h2>
      </div>
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold text-muted">
            <th className="px-4 py-3">area</th>
            <th className="px-4 py-3">fixture</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">기대값</th>
            <th className="px-4 py-3">ERP 결과값</th>
            <th className="px-4 py-3">출처</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border align-top last:border-0" key={row.itemKey}>
              <td className="px-4 py-4 font-semibold text-foreground">{row.area}</td>
              <td className="px-4 py-4 text-foreground">{row.fixtureId}</td>
              <td className="px-4 py-4">
                <IssueStatusBadge status={row.status === "pass" ? "통과" : "미확인"} />
              </td>
              <td className="max-w-80 px-4 py-4 text-muted">{formatEvidence(row.expected)}</td>
              <td className="max-w-80 px-4 py-4 text-muted">{formatEvidence(row.actual)}</td>
              <td className="max-w-80 px-4 py-4 text-muted">{row.sourceReference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OpenIssueTable({
  canWrite,
  issues
}: {
  canWrite: boolean;
  issues: ReturnType<typeof buildMigrationVerificationReport>["openIssueRows"];
}) {
  return (
    <section className="mb-5 overflow-x-auto border border-border bg-surface" aria-label="누락과 불일치 추적">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">누락/불일치 추적</h2>
      </div>
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold text-muted">
            <th className="px-4 py-3">항목</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">기대값</th>
            <th className="px-4 py-3">ERP 결과값</th>
            <th className="px-4 py-3">담당자 메모</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-sm font-medium text-foreground" colSpan={5}>
                열린 누락 또는 불일치 항목이 없습니다.
              </td>
            </tr>
          ) : (
            issues.map((issue) => (
              <tr className="border-b border-border align-top last:border-0" key={issue.itemKey}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{issue.summary}</p>
                  <p className="mt-1 text-xs text-muted">
                    {issue.itemKey} · {issue.relatedRequirement ?? "-"} · {issue.relatedStory ?? "-"}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <IssueStatusBadge status={issue.status} />
                </td>
                <td className="max-w-72 px-4 py-4 text-muted">{formatEvidence(issue.expected)}</td>
                <td className="max-w-72 px-4 py-4 text-muted">{formatEvidence(issue.actual)}</td>
                <td className="px-4 py-4">
                  {canWrite ? (
                    <MigrationIssueStatusForm issue={issue} />
                  ) : (
                    <div className="text-muted">
                      <div>{issue.lastNote ?? "-"}</div>
                      <div className="mt-1 text-xs">{formatDateTime(issue.lastChangedAt)}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export default async function SheetMappingPage({ searchParams }: { searchParams: Promise<SheetMappingSearchParams> }) {
  const account = await requireRouteAccess("/masters/sheet-mapping");
  const params = await searchParams;
  const filters = parseMigrationVerificationFilters(params);
  const persistedIssues = await listMigrationVerificationIssues();
  const report = buildMigrationVerificationReport({ filters, persistedIssues });
  const canWrite = canPerform(account.role, "migration:write");
  const hiddenListRow = report.sheetRows.find((row) => row.sourceSheet === "목록");

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="마스터 설정"
        title="시트 기능 매핑표"
        description="원본 엑셀 11개 visible sheet와 숨김 목록 sheet의 매핑, Story 7.2 계산 대조, 출시 전 열린 위험을 한 화면에서 확인한다."
        meta={
          <>
            <div>기준: 기능 보존율 100%</div>
            <div>생성 {formatDateTime(report.generatedAt)}</div>
            <div>{canWrite ? "관리자 상태 변경 가능" : "조회 전용"}</div>
            <div>read_only_viewer 쓰기 작업 없음 · 운영 DB 변경 없음</div>
          </>
        }
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="이관 검증 요약">
        <SummaryTile
          label="기능 보존율"
          value={`${formatNumber(report.summary.preservationRate)}%`}
          note={report.summary.preservationGoalMet ? "100% 목표 달성" : "100% 목표 미달성"}
        />
        <SummaryTile label="누락 항목" value={`${formatNumber(report.summary.missingSheetCount)}개`} note="누락된 시트 · 숨김 목록 포함 원본 12개 기준" />
        <SummaryTile
          label="계산 통과"
          value={`${formatNumber(report.summary.calculationPassCount)}개`}
          note={`핵심 계산 ${report.summary.coreCalculationStatus}`}
        />
        <SummaryTile label="계산 불일치" value={`${formatNumber(report.summary.calculationMismatchCount)}개`} note="Story 7.2 mismatch shape 보존" />
        <SummaryTile label="열린 추적" value={`${formatNumber(report.summary.openIssueCount)}개`} note="미확인/수정중/재검증 필요" />
      </section>

      <section
        className={`mb-5 border px-4 py-4 ${hiddenListRow?.mappingStatus === "mapped" ? "border-border bg-surface" : "border-danger bg-surface"}`}
        role={hiddenListRow?.mappingStatus === "mapped" ? "status" : "alert"}
      >
        <h2 className="text-base font-semibold text-foreground">숨김 목록 100% gate</h2>
        <p className="mt-2 text-sm text-muted">
          숨김 시트 목록은 visible sheet와 동일 가중치로 기능 보존율에 포함된다. 현재 상태: {hiddenListRow?.mappingStatus === "mapped" ? "매핑 완료" : "누락"}
        </p>
      </section>

      <section className="mb-5 border border-border bg-surface px-4 py-4" aria-label="상태 표시 토큰 확인">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">객실/TV 상태 표시값</h2>
            <p className="mt-1 text-sm text-muted">TV설정과 객실 상태는 기존 StatusBadge 토큰, 텍스트 라벨, glyph를 함께 사용한다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge state="사용중" />
            <StatusBadge state="예약" />
            <StatusBadge state="청소중" />
            <StatusBadge state="종료확인" />
            <StatusBadge state="빈방" />
          </div>
        </div>
      </section>

      <FilterPanel filters={report.filters} sheetOptions={report.sheetRows.map((row) => row.sourceSheet)} />
      <VerificationTable calculationRows={report.calculationRows} sheetRows={report.sheetRows} />
      <SheetEvidenceDetails rows={report.sheetRows} />
      <CalculationDetails rows={report.calculationRows} />
      <OpenIssueTable canWrite={canWrite} issues={report.openIssueRows} />
    </main>
  );
}
