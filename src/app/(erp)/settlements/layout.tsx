import Link from "next/link";
import type { ReactNode } from "react";
import { canPerform, getAuthorizedAccount } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { countPendingTherapistRequests } from "@/modules/therapists/therapist-request-service";

/**
 * 정산 구역(settlements) 공통 레이아웃. 승인함 대기 건수 배지(티켓 08, 스펙 D24, design.md —
 * 선례 없어 새로 만든다)를 이 구역의 화면을 열 때만 읽는다.
 *
 * 공용 `(erp)/layout.tsx`에 두지 않은 이유: 객실·실시간·TV는 영업시간에 30초마다
 * `router.refresh()`로 레이아웃 트리를 다시 그린다(코드베이스 지도 12절). 그 세 화면은 이 구역
 * 밖이라 이 레이아웃까지는 다시 그리지 않으므로, "화면을 열 때만 읽고 자동으로 새로 읽지 않는다"
 * (티켓 08)를 지킨다.
 */
export default async function SettlementsLayout({ children }: { children: ReactNode }) {
  const account = await getAuthorizedAccount();
  const canApprove = account ? canPerform(account.role, "payout:write") : false;
  const pendingCount = canApprove ? await countPendingTherapistRequests() : 0;
  const { t } = await getServerTranslator();

  return (
    <>
      {canApprove && pendingCount > 0 ? (
        <div className="screen">
          <Link className="inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary" href="/settlements/requests">
            <StatusIndicator label={t("settlements.requests.badge.pending", { count: pendingCount })} tone="warning" />
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}
