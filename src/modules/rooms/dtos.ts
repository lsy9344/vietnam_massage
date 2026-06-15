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
  earcare: RoomStatusAssigneeDto | null;
  guidanceText: string;
  updatedAt: string;
};
