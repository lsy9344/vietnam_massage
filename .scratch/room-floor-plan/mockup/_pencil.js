// C3 계열(손으로 그린 평면) 공용 틀: 방 이름표, 마커 동그라미, "지금 빈방 / 곧 비는 방" 줄, 범례, 서랍.
// 선 모양만 페이지마다 다르다. 페이지는 PencilPlan({ file, note, drawing })을 부르고,
// drawing(L, kit)은 <svg> 안에 들어갈 선을 돌려준다. kit은 고정 씨앗 난수와 흔들린 선 도구를 준다.
(function () {
  "use strict";
  const { PLAN, planBox, minimalLine, drawer, bindDrawer, t, esc, badge, room, ROOMS, STATUS_ORDER, state, statusKey, assignee, minutes, mount } = window.FP;
  const { W, H } = PLAN;

  // 다시 그려도 같은 모양이 나오도록 층마다 고정된 씨앗으로 흔든다.
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /** 살짝 휘고 끝이 넘치는 선. extend 하나마다 한 번 긋는다(두 번이면 연필 두 겹). */
  function wobble(x1, y1, x2, y2, rand, amp, extend = [5, -3]) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const jitter = () => (rand() - 0.5) * 2 * amp;
    let d = "";
    for (const e of extend) {
      const bow = (rand() - 0.5) * Math.min(10, len * 0.03);
      const mx = (x1 + x2) / 2 - uy * bow + jitter();
      const my = (y1 + y2) / 2 + ux * bow + jitter();
      const sx = x1 - ux * e + jitter() * 0.6;
      const sy = y1 - uy * e + jitter() * 0.6;
      const ex = x2 + ux * e + jitter() * 0.6;
      const ey = y2 + uy * e + jitter() * 0.6;
      d += `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} `;
    }
    return d;
  }

  const rectSegments = (x, y, w, h) => [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
  /** 바깥벽 네 변(도면 가장자리에서 4 안쪽). */
  const outerSegments = () => rectSegments(4, 4, W - 8, H - 8);
  /** 엘리베이터 상자와 ▲▼ 꺾쇠. */
  function liftSegments(L) {
    const [ex, ey, ew, eh] = L.elevator;
    const cx = ex + ew / 2;
    return {
      box: rectSegments(ex, ey, ew, eh),
      chevrons: [[cx - 9, ey + 24, cx, ey + 14], [cx, ey + 14, cx + 9, ey + 24], [cx - 9, ey + 32, cx, ey + 42], [cx, ey + 42, cx + 9, ey + 32]]
    };
  }

  const loop = `<svg class="loop" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M 16 36 C 8 14, 80 2, 94 24 C 104 46, 34 62, 8 42 C 0 32, 14 16, 36 12"/></svg>`;

  function roomBody(r, tv) {
    const line = minimalLine(r);
    const lineHtml = line
      ? `<span class="room__line">${line.label ? `<span class="room__label">${esc(line.label)}</span>` : ""}<span class="room__value${line.kind === "text" ? " is-text" : ""}">${esc(line.value)}</span></span>`
      : "";
    const marked = r.status === "종료임박" || r.status === "종료확인";
    const who = tv && r.therapists ? `<span class="room__who">${esc(assignee(r))}</span>` : "";
    return `<span class="room__num">${esc(r.id)}${marked ? loop : ""}</span>${badge(r, "sm")}${lineHtml}${who}`;
  }

  function plan(floor, tv, drawing) {
    const L = PLAN.LAYOUTS[floor.layout];
    const kit = { W, H, rand: seeded(floor.n * 7919), wobble, rectSegments, outerSegments, liftSegments };
    const rooms = floor.cells
      .map(([slot, id]) => {
        const r = room(id);
        const cls = `room room--${statusKey(r)}`;
        const pos = planBox(L.slots[slot], 10);
        return tv
          ? `<div class="${cls}" style="${pos}">${roomBody(r, true)}</div>`
          : `<button class="${cls}" style="${pos}" type="button" data-open-room="${r.id}" data-opener="room-${r.id}" aria-haspopup="dialog" aria-expanded="${state.selected === r.id}">${roomBody(r, false)}</button>`;
      })
      .join("");
    return `<section class="fcard" aria-labelledby="floor-${floor.n}">
      <h2 id="floor-${floor.n}">${esc(t("plan.floor", { n: floor.n }))}</h2>
      <div class="plan">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${drawing(L, kit)}</svg>
        <span class="zone zone--vertical" style="${planBox([0, 24, 115, 200])}" aria-hidden="true"><span class="zone__text">${esc(t("plan.elevator"))}</span></span>
        <span class="zone" style="${planBox(L.corridor)}" aria-hidden="true">${esc(t("plan.corridor"))}</span>
        ${rooms}
      </div>
    </section>`;
  }

  /** 지금 빈방 + 남은 분이 적은 순서로 곧 비는 방 3개. 값은 객실 상태 그대로다. */
  function soon(tv) {
    const chip = (r, extra, key) =>
      tv
        ? `<span class="soon__chip">${esc(r.id)}${extra ? `<span>${esc(extra)}</span>` : ""}</span>`
        : `<button class="soon__chip" type="button" data-open-room="${r.id}" data-opener="${key}-${r.id}" aria-haspopup="dialog">${esc(r.id)}${extra ? `<span>${esc(extra)}</span>` : ""}</button>`;
    const free = ROOMS.filter((r) => r.status === "빈방");
    const ending = ROOMS.filter((r) => r.status === "사용중" || r.status === "종료임박").sort((a, b) => a.remaining - b.remaining).slice(0, 3);
    const none = `<span class="soon__none">${esc(t("plan.none"))}</span>`;
    return `<div class="soon" role="group" aria-label="${esc(`${t("plan.freeNow")} · ${t("plan.freeSoon")}`)}">
      <span class="soon__label">${esc(t("plan.freeNow"))}</span>${free.length ? free.map((r) => chip(r, "", "free")).join("") : none}
      <span class="soon__label">${esc(t("plan.freeSoon"))}</span>${ending.length ? ending.map((r) => chip(r, minutes(r.remaining), "soon")).join("") : none}
    </div>`;
  }

  const legend = (size, cls = "") =>
    `<div class="legend ${cls}" aria-hidden="true"><span class="legend__label">${esc(t("plan.legend"))}</span>${STATUS_ORDER.map((s) => badge({ status: s }, size)).join("")}</div>`;

  window.PencilPlan = function ({ file, note, drawing }) {
    mount({
      file,
      note,
      alignToggle: true,
      live: () =>
        `<section aria-label="${esc(t("roomStatusAria"))}">${soon(false)}<div class="c-floors">${PLAN.FLOORS.map((f) => plan(f, false, drawing)).join("")}</div>${legend("sm", "c3-legend")}</section>${drawer()}`,
      tv: () => `<section class="c-floors" aria-label="${esc(t("roomStatusAria"))}">${PLAN.FLOORS.map((f) => plan(f, true, drawing)).join("")}</section>${soon(true)}`,
      afterRender: bindDrawer
    });
  };
})();
