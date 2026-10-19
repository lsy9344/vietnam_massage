// 룸 평면도 시안 공용 스크립트: 예시 데이터, 문구(ko·vi), 화면 골격(도구줄·요약·도크·TV 머리말), 객실 카드.
// 문구는 src/lib/i18n/messages/ko·vi.ts의 값을 옮겼다. "plan."으로 시작하는 문구만 이 시안에서 새로 붙였다.
(function () {
  "use strict";

  const MSG = {
    ko: {
      "nav.live": "첫화면 실시간 현황",
      "nav.tv": "TV 현황판",
      "tv.eyebrowFull": "운영 현황 · fullscreen · 읽기 전용",
      "shell.openTv": "TV 화면 열기",
      "refresh.lastUpdated": "마지막 갱신",
      "refresh.refresh": "새로고침",
      "date.prev": "이전",
      "date.today": "오늘",
      "date.next": "다음",
      "month.status": "검토중",
      "live.reservationCount": "예약건수",
      "live.inUse": "사용중",
      "live.paymentTotal": "결제합계",
      "live.netSales": "순매출",
      "live.summary": "오늘 상태 요약",
      "live.payment": "결제수단별 집계",
      "live.courseCompleted": "코스별 방문완료",
      "live.cleaning": "청소중",
      "live.completed": "방문완료",
      "live.noShow": "노쇼",
      "live.canceled": "취소",
      "pay.cash": "현금",
      "pay.card": "카드",
      "pay.bank": "계좌",
      "pay.other": "기타",
      "count": "{n}건",
      "status.사용중": "사용중",
      "status.종료임박": "종료임박",
      "status.예약": "예약",
      "status.청소중": "청소중",
      "status.종료확인": "종료확인",
      "status.빈방": "빈방",
      "status.aria": "상태: {status}",
      "guide.사용중": "서비스가 진행 중입니다.",
      "guide.종료임박": "곧 종료",
      "guide.예약": "예약 고객 입실 준비가 필요합니다.",
      "guide.청소중": "정리 후 입실 가능합니다.",
      "guide.종료확인": "결제·확인 필요",
      "guide.빈방": "즉시 가능",
      "field.course": "코스",
      "field.assignee": "담당자",
      "field.start": "시작",
      "field.expectedEnd": "종료예정",
      "field.remaining": "남은분",
      "minutes": "{n}분",
      "openInLedger": "원장에서 콜 상세 열기",
      "zone.ledger": "원장",
      "zone.floor": "현장",
      "zone.customers": "고객",
      "zone.settlements": "정산",
      "zone.closing": "마감",
      "zone.reports": "보고",
      "zone.settings": "설정",
      "dock.more": "더보기",
      "dock.me": "나",
      "roomStatusAria": "객실 상태",
      "plan.floor": "{n}층",
      "plan.stairs": "계단",
      "plan.corridor": "복도",
      "plan.window": "창",
      "plan.waiting": "대기실",
      "plan.earcare": "귀케어",
      "plan.reception": "리셉션",
      "plan.stairsSide": "계단 쪽",
      "plan.windowSide": "창 쪽",
      "plan.selected": "선택한 객실",
      "plan.close": "닫기",
      "plan.legend": "상태",
      "plan.elevator": "엘리베이터",
      "plan.freeNow": "지금 빈방",
      "plan.freeSoon": "곧 비는 방",
      "plan.none": "없음",
      "plan.remainingShort": "{n}분 남음"
    },
    vi: {
      "nav.live": "Trạng thái thời gian thực",
      "nav.tv": "Bảng trạng thái TV",
      "tv.eyebrowFull": "Tình hình vận hành · toàn màn hình · chỉ đọc",
      "shell.openTv": "Mở màn hình TV",
      "refresh.lastUpdated": "Cập nhật gần nhất",
      "refresh.refresh": "Làm mới",
      "date.prev": "Trước",
      "date.today": "Hôm nay",
      "date.next": "Sau",
      "month.status": "Đang xem xét",
      "live.reservationCount": "Số lượt đặt trước",
      "live.inUse": "Đang sử dụng",
      "live.paymentTotal": "Tổng thanh toán",
      "live.netSales": "Doanh thu thuần",
      "live.summary": "Tóm tắt trạng thái hôm nay",
      "live.payment": "Tổng hợp theo phương thức thanh toán",
      "live.courseCompleted": "Hoàn tất theo gói dịch vụ",
      "live.cleaning": "Đang dọn",
      "live.completed": "Hoàn tất",
      "live.noShow": "Không đến",
      "live.canceled": "Đã hủy",
      "pay.cash": "Tiền mặt",
      "pay.card": "Thẻ",
      "pay.bank": "Chuyển khoản",
      "pay.other": "Khác",
      "count": "{n} ca",
      "status.사용중": "Đang sử dụng",
      "status.종료임박": "Sắp kết thúc",
      "status.예약": "Đặt trước",
      "status.청소중": "Đang dọn",
      "status.종료확인": "Cần xác nhận kết thúc",
      "status.빈방": "Phòng trống",
      "status.aria": "Trạng thái: {status}",
      "guide.사용중": "Dịch vụ đang diễn ra.",
      "guide.종료임박": "Sắp kết thúc",
      "guide.예약": "Cần chuẩn bị đón khách đã đặt trước.",
      "guide.청소중": "Có thể vào sau khi dọn dẹp.",
      "guide.종료확인": "Cần thanh toán·xác nhận",
      "guide.빈방": "Có thể vào ngay",
      "field.course": "Gói dịch vụ",
      "field.assignee": "Người phụ trách",
      "field.start": "Bắt đầu",
      "field.expectedEnd": "Dự kiến kết thúc",
      "field.remaining": "Số phút còn lại",
      "minutes": "{n} phút",
      "openInLedger": "Mở chi tiết cuộc gọi trong Sổ gọi",
      "zone.ledger": "Sổ gọi",
      "zone.floor": "Vận hành",
      "zone.customers": "Khách",
      "zone.settlements": "Đối soát",
      "zone.closing": "Chốt tháng",
      "zone.reports": "Báo cáo",
      "zone.settings": "Thiết lập",
      "dock.more": "Thêm",
      "dock.me": "Tôi",
      "roomStatusAria": "Tình trạng phòng",
      "plan.floor": "Tầng {n}",
      "plan.stairs": "Cầu thang",
      "plan.corridor": "Hành lang",
      "plan.window": "Cửa sổ",
      "plan.waiting": "Phòng chờ",
      "plan.earcare": "Ráy tai",
      "plan.reception": "Lễ tân",
      "plan.stairsSide": "Phía cầu thang",
      "plan.windowSide": "Phía cửa sổ",
      "plan.selected": "Phòng đã chọn",
      "plan.close": "Đóng",
      "plan.legend": "Trạng thái",
      "plan.elevator": "Thang máy",
      "plan.freeNow": "Trống ngay",
      "plan.freeSoon": "Sắp trống",
      "plan.none": "Không có",
      "plan.remainingShort": "còn {n} phút"
    }
  };

  const STATUS = {
    사용중: { key: "active", glyph: "●" },
    종료임박: { key: "ending", glyph: "◴" },
    예약: { key: "reserved", glyph: "◷" },
    청소중: { key: "cleaning", glyph: "◐" },
    종료확인: { key: "check", glyph: "⚠" },
    빈방: { key: "empty", glyph: "○" }
  };
  const STATUS_ORDER = ["사용중", "종료임박", "예약", "청소중", "종료확인", "빈방"];

  // 2026-10-19 21:14 기준 예시. 코스 이름은 course-schema.ts의 tvDisplayName이다.
  const ROOMS = [
    { id: "401", name: "401 호실", status: "사용중", course: "D 2:1 90", therapists: ["Linh", "Vy"], start: "20:30", end: "22:00", remaining: 46 },
    { id: "402", name: "402 호실", status: "종료임박", course: "A 누루60", therapists: ["Mai"], start: "20:20", end: "21:20", remaining: 6 },
    { id: "301", name: "301 호실", status: "종료확인", course: "C 때밀이90", therapists: ["Thảo"], start: "19:40", end: "21:10", remaining: 0 },
    { id: "302", name: "302 호실", status: "예약", course: "A 누루60", therapists: ["Ngọc"], start: "21:40", end: "22:40", remaining: null },
    { id: "303", name: "303 호실", status: "빈방" },
    { id: "201", name: "201 호실", status: "사용중", course: "C 때밀이90", therapists: ["Hương"], start: "20:50", end: "22:20", remaining: 66 },
    { id: "202", name: "202 호실", status: "청소중", course: "A 누루60", therapists: ["Trang"], start: "20:00", end: "21:00", remaining: null },
    { id: "203", name: "203 호실", status: "사용중", course: "A 누루60", therapists: ["Lan"], start: "20:45", end: "21:45", remaining: 31 },
    { id: "101", name: "101 호실", status: "예약", course: "D 2:1 90", therapists: ["Hà", "My"], start: "22:00", end: "23:30", remaining: null },
    { id: "102", name: "102 호실", status: "빈방" },
    { id: "103", name: "103 호실", status: "종료임박", course: "A 누루60", therapists: ["Nhung"], start: "20:22", end: "21:22", remaining: 8 }
  ];

  // 1차: 배치 방식 셋. 2차: 1차 C를 가구 없이 단순하게 다시 그린 셋.
  const ROUNDS = [
    {
      title: "룸 평면도 시안 · 1차",
      variants: [
        { file: "a-plan-strips.html", label: "A · 층별 평면 띠" },
        { file: "b-building-section.html", label: "B · 건물 단면" },
        { file: "c-blueprint.html", label: "C · 도면 그대로" }
      ],
      others: [{ file: "c1-ink-line.html", label: "2차 시안 보기" }]
    },
    {
      title: "룸 평면도 시안 · 2차 (C 단순화)",
      variants: [
        { file: "c1-ink-line.html", label: "C1 · 잉크 선" },
        { file: "c2-soft-blocks.html", label: "C2 · 둥근 블록" },
        { file: "c3-pencil.html", label: "C3 · 연필 스케치" }
      ],
      others: [
        { file: "c-blueprint.html", label: "1차 C 보기" },
        { file: "c3a-brush.html", label: "3차 시안 보기" }
      ]
    },
    {
      title: "룸 평면도 시안 · 3차 (C3 선 스타일)",
      variants: [
        { file: "c3a-brush.html", label: "C3-a · 붓펜" },
        { file: "c3b-architect.html", label: "C3-b · 건축가 스케치" },
        { file: "c3c-marker.html", label: "C3-c · 마커" }
      ],
      others: [{ file: "c3-pencil.html", label: "2차 C3(연필) 보기" }]
    }
  ];

  // 2차 평면 좌표(가로 1165 × 세로 400). 왼쪽 띠는 엘리베이터와 복도(사용자 확인), 아래는 복도, 오른쪽 벽은 창이다.
  // walls는 방과 복도 사이 칸막이이고, 끊긴 자리가 문이다.
  const PLAN = {
    W: 1165,
    H: 400,
    FLOORS: [
      { n: 4, layout: "top", cells: [["03", "402"], ["wide", "401"]] },
      { n: 3, layout: "std", cells: [["03", "303"], ["02", "302"], ["01", "301"]] },
      { n: 2, layout: "std", cells: [["03", "203"], ["02", "202"], ["01", "201"]] },
      { n: 1, layout: "std", cells: [["03", "103"], ["02", "102"], ["01", "101"]] }
    ],
    LAYOUTS: {
      std: {
        slots: { "03": [115, 0, 343, 300], "02": [458, 0, 382, 300], "01": [840, 0, 325, 400] },
        corridor: [115, 300, 725, 100],
        hall: [0, 0, 115, 400],
        elevator: [30, 232, 56, 56],
        walls: [[115, 0, 115, 300], [458, 0, 458, 300], [840, 0, 840, 320], [840, 380, 840, 400], [115, 300, 360, 300], [420, 300, 760, 300], [820, 300, 840, 300]]
      },
      top: {
        slots: { "03": [115, 0, 345, 300], wide: [460, 0, 705, 400] },
        corridor: [115, 300, 345, 100],
        hall: [0, 0, 115, 400],
        elevator: [30, 232, 56, 56],
        walls: [[115, 0, 115, 300], [460, 0, 460, 320], [460, 380, 460, 400], [115, 300, 360, 300], [420, 300, 460, 300]]
      }
    }
  };

  const pct = (value, total) => `${((value / total) * 100).toFixed(3)}%`;
  /** 도면 좌표 사각형을 절대 위치 style 문자열로 바꾼다. inset은 안쪽으로 줄일 도면 단위. */
  function planBox([x, y, w, h], inset = 0) {
    return `left:${pct(x + inset, PLAN.W)};top:${pct(y + inset, PLAN.H)};width:${pct(w - inset * 2, PLAN.W)};height:${pct(h - inset * 2, PLAN.H)}`;
  }

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  /** 코스 길이 대비 남은 비율(0–1). 손님이 없으면 null. */
  function remainingRatio(r) {
    if (r.remaining === null || r.remaining === undefined || !r.start || !r.end) return null;
    const total = toMinutes(r.end) - toMinutes(r.start);
    return total > 0 ? Math.min(1, Math.max(0, r.remaining / total)) : null;
  }

  /** 2차 시안의 방 안 한 줄: 남은 분, 예약 시각, 할 일만. 청소중·빈방은 배지로 충분해 줄이 없다. */
  function minimalLine(r) {
    if (r.status === "종료확인") return { label: "", value: t("guide.종료확인"), kind: "text" };
    if (r.status === "사용중" || r.status === "종료임박") return { label: "", value: t("plan.remainingShort", { n: Math.max(0, r.remaining) }), kind: "big" };
    if (r.status === "예약") return { label: t("field.start"), value: r.start, kind: "big" };
    return null;
  }

  const params = new URLSearchParams(location.search);
  const state = {
    view: params.get("view") === "tv" ? "tv" : "live",
    lang: params.get("lang") === "vi" ? "vi" : "ko",
    chrome: params.get("chrome") !== "0",
    align: ["center", "top"].includes(params.get("align")) ? params.get("align") : "left",
    selected: params.get("room")
  };

  function t(key, vars) {
    let text = MSG[state.lang][key] ?? MSG.ko[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
    return text;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  const room = (id) => ROOMS.find((r) => r.id === id);
  const statusKey = (r) => STATUS[r.status].key;
  const statusLabel = (r) => t(`status.${r.status}`);
  const isOccupied = (r) => r.status === "사용중" || r.status === "종료임박" || r.status === "종료확인";
  const isAttention = (r) => r.status === "종료임박" || r.status === "종료확인";
  const assignee = (r) => (r.therapists && r.therapists.length ? r.therapists.join(" / ") : "-");
  const minutes = (n) => t("minutes", { n: Math.max(0, n) });

  /** StatusBadge: 기호 + 글자 + 고정 상태색. size는 "", "sm", "tv", "tv-sm". */
  function badge(r, size) {
    const cls = `badge badge--${statusKey(r)}${size ? ` badge--${size}` : ""}`;
    return `<span class="${cls}" aria-label="${esc(t("status.aria", { status: statusLabel(r) }))}"><span aria-hidden="true">${STATUS[r.status].glyph}︎</span><span class="badge__text">${esc(statusLabel(r))}</span></span>`;
  }

  /** 방 안에 크게 보일 한 가지 값: 손님이 있으면 남은 분, 예약이면 시작 시각, 나머지는 안내 문구. */
  function headline(r) {
    if (r.status === "종료확인") return { label: t("field.expectedEnd"), value: r.end, note: t("guide.종료확인") };
    if (isOccupied(r)) return { label: t("field.remaining"), value: minutes(r.remaining) };
    if (r.status === "예약") return { label: t("field.start"), value: r.start };
    return { label: "", value: t(`guide.${r.status}`), quiet: true };
  }

  /** 지금 실시간 화면의 RoomStatusCard 본문. */
  function roomCard(r, opts = {}) {
    const stateClass = r.status === "빈방" ? " is-empty" : r.status === "종료임박" ? " is-ending attention" : r.status === "종료확인" ? " is-check attention" : "";
    const times =
      r.status === "빈방"
        ? ""
        : `<p class="room-card__times">
            <span class="capsule"><span>${esc(t("field.start"))}</span>${esc(r.start ?? "-")}</span>
            <span class="capsule"><span>${esc(t("field.expectedEnd"))}</span>${esc(r.end ?? "-")}</span>
            ${isOccupied(r) ? `<span class="remain"><span>${esc(t("field.remaining"))}</span>${esc(minutes(r.remaining))}</span>` : ""}
          </p>`;
    const link = r.status !== "빈방" && opts.ledger !== false ? `<a class="ledger-link" href="#">${esc(t("openInLedger"))}</a>` : "";
    const Tag = opts.headingLevel ?? "h3";
    return `<article class="room-card${stateClass}${opts.className ? ` ${opts.className}` : ""}" aria-label="${esc(`${r.name} ${statusLabel(r)}`)}">
      <div class="room-card__head"><${Tag} class="room-card__name"${opts.headingId ? ` id="${opts.headingId}"` : ""}>${esc(r.name)}</${Tag}>${badge(r)}</div>
      <p class="room-card__guide">${esc(t(`guide.${r.status}`))}</p>
      <dl class="room-card__fields">
        <div><dt>${esc(t("field.course"))}</dt><dd>${esc(r.course ?? "-")}</dd></div>
        <div><dt>${esc(t("field.assignee"))}</dt><dd>${esc(assignee(r))}</dd></div>
      </dl>
      ${times}
      ${link}
    </article>`;
  }

  function chrome(currentFile, note, alignToggle) {
    const round = ROUNDS.find((r) => r.variants.some((v) => v.file === currentFile)) ?? ROUNDS[0];
    const href = (file) => `${file}?view=${state.view}&lang=${state.lang}${state.align !== "left" ? `&align=${state.align}` : ""}`;
    const variantLinks =
      round.variants
        .map((v) => `<a class="pill" href="${href(v.file)}"${v.file === currentFile ? ' aria-current="page"' : ""}>${esc(v.label)}</a>`)
        .join("") + round.others.map((o) => `<a class="pill pill--quiet" href="${href(o.file)}">${esc(o.label)}</a>`).join("");
    const viewButtons = [
      ["live", "실시간 화면 (/live)"],
      ["tv", "TV 현황판 (/tv)"]
    ]
      .map(([value, label]) => `<button class="pill" type="button" data-set-view="${value}" aria-pressed="${state.view === value}">${label}</button>`)
      .join("");
    const langButtons = [
      ["ko", "한국어"],
      ["vi", "Tiếng Việt"]
    ]
      .map(([value, label]) => `<button class="pill" type="button" data-set-lang="${value}" aria-pressed="${state.lang === value}">${label}</button>`)
      .join("");
    return `<div class="mock-bar" lang="ko">
      <span class="mock-bar__title">${esc(round.title)}</span>
      <nav class="mock-group" aria-label="시안">${variantLinks}</nav>
      <div class="mock-group" role="group" aria-label="화면"><span class="mock-group__label">화면</span>${viewButtons}</div>
      <div class="mock-group" role="group" aria-label="언어"><span class="mock-group__label">언어</span>${langButtons}</div>
      ${alignToggle ? `<div class="mock-group" role="group" aria-label="글자 정렬"><span class="mock-group__label">글자 정렬</span>${[["left", "왼쪽 위"], ["top", "위 가운데"], ["center", "가운데"]].map(([value, label]) => `<button class="pill" type="button" data-set-align="${value}" aria-pressed="${state.align === value}">${label}</button>`).join("")}</div>` : ""}
      <details class="mock-note"><summary>이 시안 설명</summary><div class="mock-note__body">${note}</div></details>
    </div>`;
  }

  function toolbar() {
    return `<header class="toolbar">
      <h1>${esc(t("nav.live"))}</h1>
      <div class="toolbar__dates">
        <span class="field-pill">2026-10 (${esc(t("month.status"))})</span>
        <span class="field-pill">2026-10-19</span>
        <a class="btn" href="#">${esc(t("date.prev"))}</a>
        <a class="btn" href="#">${esc(t("date.today"))}</a>
        <a class="btn" href="#">${esc(t("date.next"))}</a>
      </div>
      <div class="toolbar__end">
        <span class="meta">${esc(t("refresh.lastUpdated"))} 21:14:05</span>
        <button class="btn" type="button">${esc(t("refresh.refresh"))}</button>
        <a class="btn btn--primary" href="?view=tv&lang=${state.lang}">${esc(t("shell.openTv"))}</a>
      </div>
    </header>`;
  }

  function summary() {
    const card = (accent, label, value, unit) =>
      `<div class="summary-card summary-card--${accent}"><p class="summary-card__label">${esc(label)}</p><p class="summary-card__value">${esc(value)}${unit ? `<span class="summary-card__unit">${unit}</span>` : ""}</p></div>`;
    return `<div class="summary" role="group" aria-label="KPI">
      ${card("mint", t("live.reservationCount"), t("count", { n: 38 }))}
      ${card("mint", t("live.inUse"), t("count", { n: 6 }))}
      ${card("lavender", t("live.paymentTotal"), "12,450,000", "VND")}
      ${card("lavender", t("live.netSales"), "9,820,000", "VND")}
    </div>`;
  }

  function details() {
    const rows = (pairs) => pairs.map(([k, v]) => `<div class="detail-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    return `<div class="details">
      <section class="card"><h2>${esc(t("live.summary"))}</h2><dl>${rows([
        [t("live.reservationCount"), t("count", { n: 38 })],
        [t("live.inUse"), t("count", { n: 6 })],
        [t("live.cleaning"), t("count", { n: 1 })],
        [t("live.completed"), t("count", { n: 24 })],
        [t("live.noShow"), t("count", { n: 1 })],
        [t("live.canceled"), t("count", { n: 2 })]
      ])}</dl></section>
      <section class="card"><h2>${esc(t("live.payment"))}</h2><dl>${rows([
        [t("pay.cash"), "6,200,000 VND"],
        [t("pay.card"), "3,150,000 VND"],
        [t("pay.bank"), "3,100,000 VND"],
        [t("pay.other"), "0 VND"]
      ])}</dl></section>
      <section class="card"><h2>${esc(t("live.courseCompleted"))}</h2><dl>${rows([
        ["A", t("count", { n: 14 })],
        ["C", t("count", { n: 7 })],
        ["D", t("count", { n: 3 })]
      ])}</dl></section>
    </div>`;
  }

  function dock() {
    const item = (key, extra = "") => `<a class="dock-item${extra}" href="#"${key === "floor" ? ' aria-current="page"' : ""}>${esc(t(`zone.${key}`))}</a>`;
    return `<nav class="dock" aria-label="dock">
      ${item("ledger")}${item("floor")}${item("customers")}
      ${item("settlements", " dock-gap")}${item("closing")}
      ${item("reports", " dock-gap dock-wide")}${item("settings", " dock-wide")}
      <a class="dock-item dock-end" href="#">${esc(t("dock.more"))}</a>
      <a class="dock-item" href="#">${esc(t("dock.me"))}</a>
    </nav>`;
  }

  function tvHeader() {
    return `<header class="tv-head">
      <div class="tv-brand">
        <span class="tv-brand__bar" aria-hidden="true"></span>
        <div>
          <p class="tv-eyebrow">${esc(t("tv.eyebrowFull"))}</p>
          <h1 class="tv-title">${esc(t("nav.tv"))}</h1>
          <p class="tv-sub">2026-10 · 2026-10-19 · ${esc(t("month.status"))}</p>
        </div>
      </div>
      <div class="tv-refresh">
        <span class="tv-refresh__time">${esc(t("refresh.lastUpdated"))} 21:14:05</span>
        <button class="btn" type="button">${esc(t("refresh.refresh"))}</button>
      </div>
    </header>`;
  }

  function syncUrl() {
    const next = new URLSearchParams();
    if (state.view === "tv") next.set("view", "tv");
    if (state.lang === "vi") next.set("lang", "vi");
    if (!state.chrome) next.set("chrome", "0");
    if (state.align !== "left") next.set("align", state.align);
    if (state.selected) next.set("room", state.selected);
    const query = next.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }

  /**
   * 화면을 그린다. page = { file, note, live(), tv(), afterRender?(root) }.
   * live()는 요약 카드와 아래 상세 사이의 객실판, tv()는 TV 머리말 아래 전부를 돌려준다.
   */
  function mount(page) {
    const root = document.getElementById("app");
    const noteOpen = () => root.querySelector(".mock-note")?.open ?? false;

    function render(keepNoteOpen) {
      document.documentElement.lang = state.lang;
      document.body.dataset.view = state.view;
      document.body.dataset.align = state.align;
      const bar = state.chrome ? chrome(page.file, page.note, page.alignToggle) : "";
      const body =
        state.view === "tv"
          ? `<main class="tv">${tvHeader()}${page.tv()}</main>`
          : `<main class="screen live-main">${toolbar()}${summary()}${page.live()}${details()}</main>${dock()}`;
      root.innerHTML = bar + body;
      if (keepNoteOpen) root.querySelector(".mock-note").open = true;
      page.afterRender?.(root, render);
    }

    root.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-set-view]");
      const langButton = event.target.closest("[data-set-lang]");
      const alignButton = event.target.closest("[data-set-align]");
      if (!viewButton && !langButton && !alignButton) return;
      const keep = noteOpen();
      if (viewButton) state.view = viewButton.dataset.setView;
      if (langButton) state.lang = langButton.dataset.setLang;
      if (alignButton) state.align = alignButton.dataset.setAlign;
      syncUrl();
      render(keep);
    });

    render(false);
  }

  /** 오른쪽 서랍(ModalPanel 모양). state.selected가 열린 방이다. */
  function drawer() {
    const r = state.selected && room(state.selected);
    if (!r) return "";
    return `<div class="scrim" data-close></div>
      <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div class="drawer__head"><p class="drawer__eyebrow">${esc(t("plan.selected"))}</p><button class="btn" type="button" data-close>${esc(t("plan.close"))}</button></div>
        ${roomCard(r, { headingLevel: "h2", headingId: "drawer-title" })}
      </div>`;
  }

  let lastOpener = null;
  /** data-open-room="방번호" data-opener="고유키"인 요소를 누르면 서랍을 연다. 닫으면 연 요소로 포커스를 돌린다. */
  function bindDrawer(root, render) {
    const rerender = (id) => {
      state.selected = id;
      syncUrl();
      render(root.querySelector(".mock-note")?.open);
    };
    root.querySelectorAll("[data-open-room]").forEach((el) =>
      el.addEventListener("click", () => {
        lastOpener = el.dataset.opener;
        rerender(el.dataset.openRoom);
      })
    );
    const dialog = root.querySelector(".drawer");
    document.body.style.overflow = dialog ? "hidden" : "";
    if (!dialog) return;
    const close = () => {
      const opener = lastOpener ?? `room-${state.selected}`;
      rerender(null);
      root.querySelector(`[data-opener="${opener}"]`)?.focus();
    };
    root.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
    dialog.querySelector("button[data-close]").focus();
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("a[href], button")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  window.FP = { PLAN, planBox, remainingRatio, minimalLine, drawer, bindDrawer, t, esc, badge, headline, roomCard, room, ROOMS, STATUS, STATUS_ORDER, state, statusKey, statusLabel, isOccupied, isAttention, assignee, minutes, syncUrl, mount };
})();
