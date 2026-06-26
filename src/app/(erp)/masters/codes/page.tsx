import { requireRouteAccess } from "@/lib/authorization";
import { codeTypes } from "@/modules/masters/code-schema";
import {
  ensureDefaultCodeItems,
  ensureDefaultTimeSlots,
  listCodeItems,
  listTimeSlots,
  type CodeItemDto
} from "@/modules/masters/code-service";
import { CodeManager } from "@/app/(erp)/masters/codes/code-forms";
import { PageHeader } from "@/components/domain/page-header";

const codeTypeLabels = {
  SERVICE_STATUS: "상태",
  PAYMENT_METHOD: "결제수단",
  DISCOUNT_TYPE: "할인구분",
  ATTENDANCE_STATUS: "근무상태",
  CONFIRMATION: "확인값"
} as const;

export default async function CodesPage() {
  const account = await requireRouteAccess("/masters/codes");
  await ensureDefaultCodeItems({ actorId: account.id });
  await ensureDefaultTimeSlots({ actorId: account.id });

  const codeGroups = await Promise.all(
    codeTypes.map(async (codeType) => ({
      codeType,
      label: codeTypeLabels[codeType],
      items: (await listCodeItems({ codeType })) as CodeItemDto[]
    }))
  );
  const timeSlots = await listTimeSlots();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="마스터 설정"
        title="코드/시간 슬롯"
        description="콜 원장과 정산 화면이 공유할 상태, 결제수단, 할인구분, 근무상태, 확인값, 입력 시간 슬롯을 관리한다."
        meta={
          <>
            <div>기본 코드: {codeGroups.reduce((sum, group) => sum + group.items.length, 0)}개</div>
            <div>기본 시간 슬롯: {timeSlots.length}개</div>
          </>
        }
      />

      <CodeManager codeGroups={codeGroups} timeSlots={timeSlots} />
    </main>
  );
}
