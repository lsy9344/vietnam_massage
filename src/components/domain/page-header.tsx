import type { ReactNode } from "react";

type PageHeaderProps = {
  /** 작은 분류 라벨(예: "콜 원장", "정산"). 메뉴/영역을 빠르게 구분하는 배지로 표시한다. */
  eyebrow: string;
  /** 화면 대제목(h1). */
  title: string;
  /** 대제목 아래 보조 설명. */
  description?: ReactNode;
  /** 우측 메타 정보(운영월 상태, 날짜 범위 등). */
  meta?: ReactNode;
  /** 필터/탭 등 헤더 우측에 함께 두고 싶은 액션 영역. */
  actions?: ReactNode;
};

/**
 * 모든 ERP 화면이 공유하는 대제목 영역(REQ-001).
 *
 * 작은 muted 라벨 + 평범한 h1 구조 대신, 좌측 강조 바와 옅은 브랜드 배경 밴드로
 * 대제목을 본문/카드/표 제목과 확실히 구분한다. 직원이 화면을 처음 봤을 때
 * 현재 보고 있는 영역을 즉시 인지할 수 있게 한다.
 */
export function PageHeader({ eyebrow, title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="page-header-band mb-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 py-4 lg:px-5 lg:py-5">
        <div className="min-w-0">
          <span className="page-header-eyebrow">{eyebrow}</span>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-foreground lg:text-[1.75rem]">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm text-muted">{description}</p> : null}
        </div>
        {meta ? <div className="shrink-0 text-right text-xs text-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="border-t border-border px-4 py-3 lg:px-5">{actions}</div> : null}
    </header>
  );
}
