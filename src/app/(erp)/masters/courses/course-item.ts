/**
 * 코스·수당 화면에서 고른 항목. 주소의 item 매개변수 하나에 종류와 id를 함께 담는다(id는 cuid라 ":"가 없다).
 * 서버 페이지와 클라이언트 작업면이 함께 쓰므로 "use client"가 없는 모듈에 둔다.
 */
export type CourseScreenItem =
  | { kind: "course"; courseId: string }
  | { kind: "rate"; therapistId: string; courseId: string }
  | { kind: "daily"; ruleId: string }
  | { kind: "monthly"; ruleId: string };

export function courseItemKey(item: CourseScreenItem) {
  switch (item.kind) {
    case "course":
      return `course:${item.courseId}`;
    case "rate":
      return `rate:${item.therapistId}:${item.courseId}`;
    case "daily":
      return `daily:${item.ruleId}`;
    case "monthly":
      return `monthly:${item.ruleId}`;
  }
}

export function parseCourseItem(value: string | null): CourseScreenItem | null {
  if (!value) return null;
  const [kind, ...ids] = value.split(":");
  if (ids.some((id) => id === "")) return null;
  if (kind === "course" && ids.length === 1) return { kind, courseId: ids[0] };
  if (kind === "rate" && ids.length === 2) return { kind, therapistId: ids[0], courseId: ids[1] };
  if (kind === "daily" && ids.length === 1) return { kind, ruleId: ids[0] };
  if (kind === "monthly" && ids.length === 1) return { kind, ruleId: ids[0] };
  return null;
}
