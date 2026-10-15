/**
 * S9: 월 만근·Count King 자격 기준(계산이 아니라 값). monthly-closing-preview-service.ts가 실제 계산에
 * 쓰고, closing/page.tsx와 settlements/statement/monthly-statement-view.tsx가 화면에서 보일 문구를
 * 고르는 분기에 그대로 가져다 쓴다(계산 자체는 서비스가 이미 끝냈으니 다시 하지 않는다). 그 두 화면이
 * 각자 손으로 베낀 숫자를 따로 두던 자리를 이 한 모듈로 모은다.
 *
 * Prisma나 다른 서버 전용 모듈을 전혀 import하지 않는다 — "use client" 화면이 안전하게 가져다 쓸 수
 * 있어야 한다(이 값들을 쓰는 서비스 모듈을 client 쪽에서 직접 import하면 서버 전용 코드가 번들에 섞인다).
 */
export const FULL_ATTENDANCE_THRESHOLD_DAYS = 20;
export const COUNT_KING_MIN_CALLS = 40;
