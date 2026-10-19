import type { CSSProperties, MouseEvent } from "react";
import { StatusBadge, type StatusBadgeState } from "@/components/domain/status-badge";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { roomStatusLabel } from "@/lib/i18n/codes";
import type { RoomStatusDto } from "@/modules/rooms/dtos";
import {
  FLOOR_PLAN_HEIGHT,
  FLOOR_PLAN_LAYOUTS,
  FLOOR_PLAN_WIDTH,
  floorPlanFloors,
  floorPlanFreeRooms,
  floorPlanPencilPaths,
  floorPlanRoomLine,
  roomLeadingNumber,
  type FloorPlanFloor,
  type FloorPlanRect,
  type FloorPlanRoomLine
} from "@/modules/rooms/floor-plan";

// 객실 평면도(.scratch/room-floor-plan/spec.md D2–D4). 실시간 화면은 클라이언트 서랍 안에서, TV는 서버 페이지에서
// 그대로 그리므로 "use client"를 붙이지 않는다. onOpenRoom을 받으면 방과 빈방 칩이 서랍을 여는 버튼이 된다.
// 모양은 globals.css의 .floor-plan* 규칙이 정한다.

type Translator = ReturnType<typeof createTranslator>;
type OpenRoom = (roomId: string, opener: HTMLElement) => void;

/** 범례 순서(시안 STATUS_ORDER). */
const LEGEND_ORDER: StatusBadgeState[] = ["사용중", "종료임박", "예약", "청소중", "종료확인", "빈방"];

/** 도면 좌표 사각형을 퍼센트 위치로. inset은 안쪽으로 줄일 도면 단위다. */
function planBox([x, y, w, h]: FloorPlanRect, inset = 0): CSSProperties {
  const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;
  return {
    left: pct(x + inset, FLOOR_PLAN_WIDTH),
    top: pct(y + inset, FLOOR_PLAN_HEIGHT),
    width: pct(w - inset * 2, FLOOR_PLAN_WIDTH),
    height: pct(h - inset * 2, FLOOR_PLAN_HEIGHT)
  };
}

/** 왼쪽 띠에서 엘리베이터 글자를 세로로 둘 자리(시안 값). */
const ELEVATOR_LABEL_BOX: FloorPlanRect = [0, 24, 115, 200];

/** 이름 앞 숫자. 숫자가 없으면 전체 이름이다. */
function roomNumber(status: RoomStatusDto) {
  return String(roomLeadingNumber(status.roomDisplayName) ?? status.roomDisplayName);
}

/** 한 줄의 흐린 라벨과 값. 보이는 글자와 접근 이름이 같은 문구를 쓴다. */
function lineParts(t: Translator, line: FloorPlanRoomLine): { label: string | null; value: string; isText: boolean } {
  if (line.kind === "remaining") return { label: null, value: t("floorPlan.remaining", { minutes: line.minutes }), isText: false };
  if (line.kind === "start") return { label: t("roomCard.field.start"), value: line.time, isText: false };
  return { label: null, value: t("roomCard.guidance.completeCheck"), isText: true };
}

function assigneeLine(status: RoomStatusDto) {
  return [status.therapist1?.displayName, status.therapist2?.displayName].filter(Boolean).join(" / ");
}

/** 종료임박·종료확인 방 번호에 치는 손그림 고리. 움직이지 않는다. */
function MarkerLoop({ tone }: { tone: "ending-soon" | "complete-check" }) {
  return (
    <svg aria-hidden="true" className={`floor-plan-marker floor-plan-marker--${tone}`} focusable="false" preserveAspectRatio="none" viewBox="0 0 100 60">
      <path d="M 16 36 C 8 14, 80 2, 94 24 C 104 46, 34 62, 8 42 C 0 32, 14 16, 36 12" />
    </svg>
  );
}

function RoomTag({
  status,
  name,
  locale,
  tv,
  position,
  selected,
  onOpenRoom
}: {
  status: RoomStatusDto;
  /** 이름표에 크게 쓸 이름(평면 칸은 앞 숫자, 기타 줄은 전체 이름). */
  name: string;
  locale: Locale;
  tv: boolean;
  /** 평면 칸에 놓인 방의 자리. 없으면 기타 줄에 흘려 놓는다. */
  position?: CSSProperties;
  selected: boolean;
  onOpenRoom?: OpenRoom;
}) {
  const t = createTranslator(locale);
  const statusLabel = roomStatusLabel(locale, status.displayStatus);
  const line = floorPlanRoomLine(status);
  const parts = line ? lineParts(t, line) : null;
  const marker = status.displayStatus === "종료임박" ? "ending-soon" : status.displayStatus === "종료확인" ? "complete-check" : null;
  const who = tv ? assigneeLine(status) : "";

  const body = (
    <>
      <span className="floor-plan-room-number">
        {name}
        {marker ? <MarkerLoop tone={marker} /> : null}
      </span>
      <StatusBadge
        ariaLabel={t("roomStatus.aria", { status: statusLabel })}
        className="floor-plan-badge"
        label={statusLabel}
        labelClassName="floor-plan-badge-label"
        state={status.displayStatus}
      />
      {parts ? (
        <span className="floor-plan-room-line">
          {parts.label ? <span className="floor-plan-room-label">{parts.label}</span> : null}
          <span className={cn("floor-plan-room-value", parts.isText && "floor-plan-room-value--text")}>{parts.value}</span>
        </span>
      ) : null}
      {who ? <span className="floor-plan-room-who">{who}</span> : null}
    </>
  );

  const className = cn("floor-plan-room", position && "floor-plan-room--placed");
  if (!onOpenRoom) {
    return (
      <div className={className} data-room-id={status.roomId} data-testid="floor-plan-room" style={position}>
        {body}
      </div>
    );
  }
  return (
    <button
      aria-expanded={selected}
      aria-haspopup="dialog"
      aria-label={[status.roomDisplayName, statusLabel, parts ? [parts.label, parts.value].filter(Boolean).join(" ") : null]
        .filter(Boolean)
        .join(", ")}
      className={className}
      data-room-id={status.roomId}
      data-testid="floor-plan-room"
      onClick={(event: MouseEvent<HTMLButtonElement>) => onOpenRoom(status.roomId, event.currentTarget)}
      style={position}
      type="button"
    >
      {body}
    </button>
  );
}

function FloorCard({
  floor,
  locale,
  tv,
  selectedRoomId,
  onOpenRoom
}: {
  floor: FloorPlanFloor;
  locale: Locale;
  tv: boolean;
  selectedRoomId: string | null;
  onOpenRoom?: OpenRoom;
}) {
  const t = createTranslator(locale);
  const layout = FLOOR_PLAN_LAYOUTS[floor.layout];
  const paths = floorPlanPencilPaths(floor.floor, floor.layout);
  const headingId = `floor-plan-floor-${floor.floor}`;

  return (
    <section aria-labelledby={headingId} className="floor-plan-floor" data-floor={floor.floor}>
      <h2 className="floor-plan-floor-title" id={headingId}>
        {t("floorPlan.floor", { floor: floor.floor })}
      </h2>
      <div className="floor-plan-canvas">
        <svg aria-hidden="true" focusable="false" preserveAspectRatio="none" viewBox={`0 0 ${FLOOR_PLAN_WIDTH} ${FLOOR_PLAN_HEIGHT}`}>
          <path className="floor-plan-pencil" d={paths.walls} />
          <path className="floor-plan-pencil floor-plan-pencil--soft" d={paths.lift} />
        </svg>
        <span aria-hidden="true" className="floor-plan-zone floor-plan-zone--vertical" style={planBox(ELEVATOR_LABEL_BOX)}>
          <span className="floor-plan-zone-text">{t("floorPlan.elevator")}</span>
        </span>
        <span aria-hidden="true" className="floor-plan-zone" style={planBox(layout.corridor)}>
          {t("floorPlan.corridor")}
        </span>
        {floor.cells.map((cell) =>
          cell.status ? (
            <RoomTag
              key={cell.slot}
              locale={locale}
              name={roomNumber(cell.status)}
              onOpenRoom={onOpenRoom}
              position={planBox(cell.rect, 10)}
              selected={cell.status.roomId === selectedRoomId}
              status={cell.status}
              tv={tv}
            />
          ) : null
        )}
      </div>
    </section>
  );
}

function FreeRooms({
  statuses,
  nameOf,
  locale,
  onOpenRoom
}: {
  statuses: RoomStatusDto[];
  /** 칩에 쓸 이름. 이름표와 같다(기타 줄의 방은 전체 이름). */
  nameOf: (status: RoomStatusDto) => string;
  locale: Locale;
  onOpenRoom?: OpenRoom;
}) {
  const t = createTranslator(locale);
  const { freeNow, freeSoon } = floorPlanFreeRooms(statuses);
  const none = <span className="floor-plan-free-none">{t("floorPlan.none")}</span>;

  const chip = (status: RoomStatusDto, minutes: number | null) => {
    const extra = minutes === null ? null : t("roomCard.minutes", { value: Math.max(0, minutes) });
    const body = (
      <>
        {nameOf(status)}
        {extra ? <span className="floor-plan-free-chip-extra">{extra}</span> : null}
      </>
    );
    return onOpenRoom ? (
      <button
        aria-haspopup="dialog"
        aria-label={[status.roomDisplayName, extra].filter(Boolean).join(" ")}
        className="floor-plan-free-chip"
        data-room-id={status.roomId}
        data-testid="floor-plan-free-chip"
        key={status.roomId}
        onClick={(event: MouseEvent<HTMLButtonElement>) => onOpenRoom(status.roomId, event.currentTarget)}
        type="button"
      >
        {body}
      </button>
    ) : (
      <span className="floor-plan-free-chip" data-room-id={status.roomId} data-testid="floor-plan-free-chip" key={status.roomId}>
        {body}
      </span>
    );
  };

  return (
    <div aria-label={`${t("floorPlan.freeNow")} · ${t("floorPlan.freeSoon")}`} className="floor-plan-free" role="group">
      <span className="floor-plan-free-label">{t("floorPlan.freeNow")}</span>
      {freeNow.length > 0 ? freeNow.map((status) => chip(status, null)) : none}
      <span className="floor-plan-free-label">{t("floorPlan.freeSoon")}</span>
      {freeSoon.length > 0 ? freeSoon.map((status) => chip(status, status.remainingMinutes)) : none}
    </div>
  );
}

export function RoomFloorPlan({
  statuses,
  locale,
  variant = "live",
  selectedRoomId = null,
  onOpenRoom
}: {
  statuses: RoomStatusDto[];
  locale: Locale;
  /** tv는 담당 Therapist 줄과 큰 글자, 범례 없음, 빈방 줄은 아래다. */
  variant?: "live" | "tv";
  /** 서랍이 열린 방. 그 방 버튼만 aria-expanded=true다. */
  selectedRoomId?: string | null;
  /** 실시간 화면만 준다. 있으면 방과 빈방 칩이 버튼이 된다. */
  onOpenRoom?: OpenRoom;
}) {
  const t = createTranslator(locale);
  const tv = variant === "tv";
  const { floors, others } = floorPlanFloors(statuses);
  // 기타 줄의 방은 앞 숫자가 칸의 방과 같을 수 있어(예: 301-B) 전체 이름으로 부른다.
  const otherIds = new Set(others.map((status) => status.roomId));
  const nameOf = (status: RoomStatusDto) => (otherIds.has(status.roomId) ? status.roomDisplayName : roomNumber(status));
  const free = <FreeRooms locale={locale} nameOf={nameOf} onOpenRoom={onOpenRoom} statuses={statuses} />;

  return (
    <section aria-label={t("common.roomStatusAria")} className={cn("floor-plan", tv && "floor-plan--tv")} data-testid="room-floor-plan">
      {tv ? null : free}
      <div className="floor-plan-floors">
        {floors.map((floor) => (
          <FloorCard floor={floor} key={floor.floor} locale={locale} onOpenRoom={onOpenRoom} selectedRoomId={selectedRoomId} tv={tv} />
        ))}
      </div>
      {others.length > 0 ? (
        <div aria-label={t("floorPlan.others")} className="floor-plan-others" role="group">
          <span className="floor-plan-free-label">{t("floorPlan.others")}</span>
          {others.map((status) => (
            <RoomTag
              key={status.roomId}
              locale={locale}
              name={status.roomDisplayName}
              onOpenRoom={onOpenRoom}
              selected={status.roomId === selectedRoomId}
              status={status}
              tv={tv}
            />
          ))}
        </div>
      ) : null}
      {tv ? (
        free
      ) : (
        <div aria-hidden="true" className="floor-plan-legend">
          <span className="floor-plan-legend-label">{t("floorPlan.legend")}</span>
          {LEGEND_ORDER.map((state) => (
            <StatusBadge className="floor-plan-legend-badge" key={state} label={roomStatusLabel(locale, state)} state={state} />
          ))}
        </div>
      )}
    </section>
  );
}
