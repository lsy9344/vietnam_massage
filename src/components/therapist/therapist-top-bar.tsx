import { TherapistMeMenu } from "@/components/therapist/therapist-me-menu";
import type { TherapistProfile } from "@/modules/therapists/therapist-profile-service";

/**
 * Therapist 화면 맨 위 줄: 제목 → 오른쪽 끝 "나" 메뉴. 운영팀 ScreenToolbar와 달리 날짜·운영월
 * 맥락이나 구역 안 탭이 없다(Therapist 탭은 아래 TherapistTabBar가 맡는다, 티켓 01).
 * 로고는 화면 도구줄에는 넣지 않는다(design.md 6.16) — "나" 메뉴 안에서만 보인다.
 */
export function TherapistTopBar({ title, profile }: { title: string; profile: TherapistProfile | null }) {
  return (
    <header className="screen-toolbar">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 className="text-xl font-bold leading-tight text-foreground lg:text-2xl">{title}</h1>
        <div className="ml-auto flex items-center">
          <TherapistMeMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}
