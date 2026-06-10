import { StatusBadge } from "@/components/domain/status-badge";
import { requireRouteAccess } from "@/lib/authorization";
import {
  EXPECTED_SOURCE_SHEETS,
  SHEET_FEATURE_MAPPINGS,
  getSheetMappingSummary,
  type SheetFeatureMapping
} from "@/modules/migration/sheet-feature-mapping";

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
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

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function MappingDetails({ mapping }: { mapping: SheetFeatureMapping }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-brand underline-offset-4 hover:underline">
        원본 근거, ERP 연결, 보존 규칙, 검증 항목 보기
      </summary>
      <div className="mt-3 grid gap-4 border-t border-border pt-3 lg:grid-cols-2">
        <ListBlock title="원본 근거" items={mapping.workbookEvidence} />
        <ListBlock title="ERP 화면" items={mapping.erpSurfaces} />
        <ListBlock title="설정/마스터" items={mapping.settings} />
        <ListBlock title="계산 엔진" items={mapping.calculationEngines} />
        <ListBlock title="보존 규칙" items={mapping.preservedRules} />
        <ListBlock title="검증 항목" items={mapping.verificationItems} />
        <ListBlock title="출처" items={mapping.sourceReferences} />
      </div>
    </details>
  );
}

export default async function SheetMappingPage() {
  await requireRouteAccess("/masters/sheet-mapping");
  const summary = getSheetMappingSummary();
  const missingStatus =
    summary.missingSheets.length === 0
      ? "검증 통과: 숨김 목록 포함 12개 원본 시트가 모두 매핑됐습니다."
      : `검증 실패: 누락된 시트 ${summary.missingSheets.join(", ")}`;

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">마스터 설정</p>
          <h1 className="text-2xl font-semibold text-foreground">시트 기능 매핑표</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            원본 엑셀의 11개 visible sheet와 숨김 목록 sheet가 ERP 화면, 설정, 계산 엔진, 검증 항목으로 어떻게 보존됐는지 확인한다.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>기준: 기능 보존율 100%</div>
          <div>쓰기 작업 없음 · 감사 로그 없음 · DB 변경 없음</div>
        </div>
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="시트 매핑 요약">
        <SummaryTile
          label="전체 원본 시트"
          value={`${formatNumber(summary.totalSheets)}개`}
          note={`visible ${formatNumber(summary.visibleSheets)}개, hidden ${formatNumber(summary.hiddenSheets)}개`}
        />
        <SummaryTile label="누락된 시트" value={`${formatNumber(summary.missingSheets.length)}개`} note={missingStatus} />
        <SummaryTile label="ERP 연결" value={`${formatNumber(summary.linkedTargetCount)}개`} note="화면, 설정, 계산 엔진 연결 수" />
        <SummaryTile
          label="기능 보존율"
          value={`${formatNumber(summary.preservationRate)}%`}
          note={`검증 항목 ${formatNumber(summary.verificationItemCount)}개`}
        />
      </section>

      <section
        className={`mb-5 border px-4 py-4 ${summary.missingSheets.length === 0 ? "border-border bg-surface" : "border-danger bg-surface"}`}
        role={summary.missingSheets.length === 0 ? "status" : "alert"}
      >
        <h2 className="text-base font-semibold text-foreground">원본 시트 포함 여부</h2>
        <p className="mt-2 text-sm text-muted">{missingStatus}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {EXPECTED_SOURCE_SHEETS.map((sheet) => (
            <span className="border border-border bg-background px-2 py-1 text-foreground" key={sheet.name}>
              {sheet.visibility === "hidden" ? "hidden " : "visible "}
              {sheet.name}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-5 border border-border bg-surface px-4 py-4" aria-label="상태 표시 토큰 확인">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">상태/TV 표시값</h2>
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

      <section className="overflow-x-auto border border-border bg-surface" aria-label="원본 시트 기능 매핑표">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold text-muted">
              <th className="w-40 px-4 py-3">원본 시트</th>
              <th className="w-24 px-4 py-3">구분</th>
              <th className="px-4 py-3">ERP 연결 요약</th>
              <th className="w-36 px-4 py-3 text-right">검증 항목</th>
              <th className="w-36 px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {SHEET_FEATURE_MAPPINGS.map((mapping) => {
              const linkedCount = mapping.erpSurfaces.length + mapping.settings.length + mapping.calculationEngines.length;

              return (
                <tr className="border-b border-border align-top last:border-0" key={mapping.sourceSheet}>
                  <td className="px-4 py-4 font-semibold text-foreground">{mapping.sourceSheet}</td>
                  <td className="px-4 py-4">
                    <span className="border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground">
                      {mapping.visibility === "hidden" ? "숨김" : "표시"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="mb-2 text-sm text-foreground">
                      ERP 연결 {formatNumber(linkedCount)}개 · source reference {formatNumber(mapping.sourceReferences.length)}개
                    </p>
                    <MappingDetails mapping={mapping} />
                  </td>
                  <td className="px-4 py-4 text-right [font-variant-numeric:tabular-nums]">
                    {formatNumber(mapping.verificationItems.length)}개
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-semibold text-foreground">매핑 완료</span>
                    <p className="mt-1 text-xs text-muted">모호한 "이관됨" 단독 설명 없음</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
