import { StatusBadge, statusBadgeStates } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const sidebarGroups = [
  "운영 현황",
  "콜 원장",
  "정산",
  "월마감",
  "대시보드",
  "마스터 설정",
  "감사 로그"
];

export default function Home() {
  return (
    <main className="erp-shell bg-background text-foreground">
      <aside className="border-r border-border bg-surface px-4 py-5">
        <div className="mb-6">
          <p className="text-sm font-semibold text-muted">Vietnam Massage</p>
          <h1 className="mt-1 text-2xl font-semibold">ERP 운영</h1>
        </div>
        <nav aria-label="ERP 도메인 메뉴" className="space-y-1">
          {sidebarGroups.map((group, index) => (
            <Button
              key={group}
              aria-current={index === 0 ? "page" : undefined}
              className="w-full justify-start"
              variant={index === 0 ? "secondary" : "ghost"}
            >
              {group}
            </Button>
          ))}
        </nav>
      </aside>

      <section className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
          <div>
            <p className="text-sm font-medium text-muted">오늘 운영 기준</p>
            <h2 className="text-lg font-semibold">앱 쉘 준비 상태</h2>
          </div>
          <div className="rounded-md border border-border bg-readonly px-3 py-2 text-sm text-muted">
            인증 연결 전
          </div>
        </header>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_340px] gap-6 p-6">
          <section className="space-y-6">
            <div className="rounded-md border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted">공통 화면 구조</p>
                  <h3 className="mt-1 text-xl font-semibold">좌측 메뉴, 상단 바, 업무 콘텐츠 영역</h3>
                </div>
                <span className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">
                  Royal Gold
                </span>
              </div>
              <Separator className="my-5" />
              <div className="grid grid-cols-3 gap-4" aria-label="앱 쉘 영역 미리보기">
                <div className="rounded-md border border-border bg-readonly p-4">
                  <p className="text-sm font-semibold">운영 현황</p>
                  <p className="mt-2 text-sm text-muted">객실 상태 화면과 TV route가 이어질 기준 영역</p>
                </div>
                <div className="rounded-md border border-border bg-readonly p-4">
                  <p className="text-sm font-semibold">콜 원장</p>
                  <p className="mt-2 text-sm text-muted">예약, 방문, 결제 흐름이 들어올 원장 영역</p>
                </div>
                <div className="rounded-md border border-border bg-readonly p-4">
                  <p className="text-sm font-semibold">정산/월마감</p>
                  <p className="mt-2 text-sm text-muted">계산과 잠금 흐름 연결 대기</p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted">상태 토큰</p>
                  <h3 className="mt-1 text-xl font-semibold">객실/콜 상태 표시 규칙</h3>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3" aria-label="상태 배지 토큰">
                {statusBadgeStates.map((state) => (
                  <StatusBadge key={state} state={state} />
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-md border border-border bg-surface p-5" aria-label="연결 대기 영역">
            <p className="text-sm font-medium text-muted">데이터 연결 상태</p>
            <h3 className="mt-1 text-lg font-semibold">후속 기능 연결 대기</h3>
            <p className="mt-3 text-sm leading-6 text-muted">
              실제 인증, 원장, 객실, 정산 데이터는 연결 대기 중이다.
            </p>
            <div className="mt-5 space-y-3" aria-label="로딩 상태 예시">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Separator className="my-5" />
            <div className="rounded-md border border-dashed border-border bg-readonly p-4 text-sm text-muted">
              표시할 운영 데이터가 아직 없다.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
