export type RoomDisplayStatus = "사용중" | "종료임박" | "예약" | "청소중" | "종료확인" | "빈방";

export type RoomStatusAssigneeDto = {
  id: string;
  displayName: string;
  staffCode: string;
};

export type RoomStatusCourseDto = {
  id: string;
  code: string;
  name: string;
  tvDisplayName: string;
  durationMinutes: number;
};

/**
 * 객실 겹침 목록의 한 콜. 콜 서비스의 겹침 판정 결과를 그대로 옮긴다.
 * 고객/메모, 연락처, 금액, 수당은 담지 않는다(웨이터도 보는 목록이다).
 */
export type RoomOverlapCallDto = {
  callId: string;
  startTime: string;
  course: RoomStatusCourseDto | null;
  therapists: RoomStatusAssigneeDto[];
  status: string;
  /** 콜 서비스의 표시 종료. */
  displayEndAt: string | null;
};

export type RoomStatusDto = {
  roomId: string;
  roomDisplayName: string;
  roomSortOrder: number;
  displayStatus: RoomDisplayStatus;
  sourceCallStatus: string | null;
  activeCallId: string | null;
  serviceDate: string;
  startTime: string | null;
  expectedEndAt: string | null;
  remainingMinutes: number | null;
  course: RoomStatusCourseDto | null;
  therapist1: RoomStatusAssigneeDto | null;
  therapist2: RoomStatusAssigneeDto | null;
  guidanceText: string;
  updatedAt: string;
  /** 그 객실에서 겹친 콜 전체(예약시각 순). 비어 있으면 겹침이 없다. */
  overlappingCalls: RoomOverlapCallDto[];
};
