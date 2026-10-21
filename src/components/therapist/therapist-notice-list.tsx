"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalPanel } from "@/components/ui/panel";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { markTherapistNoticeReadAction } from "@/app/therapist/notices/actions";
import type { TherapistNoticeListItemDto } from "@/modules/therapists/therapist-notice-service";

function noticeDateTime(locale: Locale, value: string) {
  return `${formatDateTime(locale, value, { dateStyle: "short" })} · ${formatDateTime(locale, value, { timeStyle: "short" })}`;
}

/**
 * 목록 행 카드(design.md 6.10) 한 줄 — 눌러 ModalPanel로 연다. 열리는 순간 읽음으로 기록한다(D25, 107).
 * 이미 읽었으면 다시 열어도 서버를 또 부르지 않는다(markTherapistNoticeRead가 멱등이라 불러도 안전하지만,
 * 불필요한 요청을 보내지 않는다).
 */
function NoticeRow({ locale, notice }: { locale: Locale; notice: TherapistNoticeListItemDto }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [readAt, setReadAt] = useState(notice.readAt);
  const [, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next || readAt) {
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          const updated = await markTherapistNoticeReadAction(notice.id);
          setReadAt(updated.readAt);
          // 공지 탭 숫자 자리(TherapistTabBar)는 레이아웃이 읽은 값이라, 내가 지금 읽었다는 것을
          // 바로 반영하려면 다시 읽어야 한다. D8이 막는 건 주기적인 자동 새로고침이고, 이건 내가
          // 공지를 연 결과다.
          router.refresh();
        } catch {
          // 네트워크 실패면 안읽음으로 남는다. 다시 열면 또 시도한다.
        }
      })();
    });
  }

  return (
    <li>
      <ModalPanel
        description={t("therapist.notices.detail.sentAt", { time: noticeDateTime(locale, notice.sentAt) })}
        onOpenChange={handleOpenChange}
        open={open}
        placement="center"
        title={t("therapist.notices.detail.title")}
        trigger={
          <button
            className="flex min-h-14 w-full items-start gap-3 rounded-md bg-surface px-4 py-2.5 text-left transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
            type="button"
          >
            <span className="grid flex-1 gap-1">
              <span className={`line-clamp-2 text-sm ${readAt ? "text-foreground" : "font-semibold text-foreground"}`}>{notice.body}</span>
              <span className="text-xs text-muted">{noticeDateTime(locale, notice.sentAt)}</span>
            </span>
            {!readAt ? <StatusIndicator label={t("therapist.notices.unread")} size="sm" tone="info" /> : null}
          </button>
        }
      >
        <p className="whitespace-pre-wrap text-sm text-foreground">{notice.body}</p>
      </ModalPanel>
    </li>
  );
}

export function TherapistNoticeList({ locale, notices }: { locale: Locale; notices: TherapistNoticeListItemDto[] }) {
  const t = useT();
  if (notices.length === 0) {
    return <ScreenState description={t("therapist.notices.empty.description")} kind="empty" label={t("common.screenState.empty")} title={t("therapist.notices.empty.title")} />;
  }

  return (
    <ul className="grid gap-2">
      {notices.map((notice) => (
        <NoticeRow key={notice.id} locale={locale} notice={notice} />
      ))}
    </ul>
  );
}
