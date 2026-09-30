// 막대 그림 ↔ 균형점 그림 변신(morph)을 위한 좌표 계산.
//
// 막대 하나는 "자료값 축(u)"과 "막대 순서 축(w)"으로 이루어진 지역 좌표계 위의 직사각형이다.
//   t = 0    : 막대 그림   (u 축이 위쪽, w 축이 오른쪽)
//   t = 0.5  : 눕힌 막대   (그림 전체를 시계 방향으로 90° 돌림 → u 축이 오른쪽, 막대가 한 줄씩 아래로)
//   t = 0.75 : 막대가 끝(자료값)만 남기고 줄어듦 → 평균선과 막대 끝 사이의 칸만 남는다
//   t = 1    : 균형점 그림 (막대 끝이 추가 되어 저울대 위로 떨어지고, 평균선은 받침점이 됨)
// 막대에서 평균선 위/아래의 칸(u가 p와 자료값 사이)은 그대로 남아 "추와 받침점 사이의 거리"가 된다.

export interface Pt {
  x: number;
  y: number;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_U = 10;
export const BEAM_HALF = 11; // 저울대 두께의 절반

export interface Layout {
  n: number;
  region: Region;
  // 막대 그림
  O0: Pt;
  U0: number;
  S0: number;
  // 눕힌 막대 / 균형점 그림
  bx: number;
  U1: number;
  rowTop: number;
  S1: number;
  beamY: number;
  wW: number;
  wH: number;
  segTop: number;
  segStep: number;
  segThick: number;
  stripY: number;
  barGap: number;
  barFrac: number;
  stackIdx: number[];
  maxStack: number;
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

export function stackIndices(values: number[]) {
  const counts = new Map<number, number>();
  const idx = values.map((v) => {
    const k = counts.get(v) ?? 0;
    counts.set(v, k + 1);
    return k;
  });
  const maxStack = Math.max(1, ...Array.from(counts.values()));
  return { idx, maxStack };
}

// extraSlots: 새 자료 만들기에서 막대 그림 끝에 '+' 자리를 비워 둘 칸 수
export function makeLayout(region: Region, values: number[], extraSlots = 0): Layout {
  const n = Math.max(1, values.length + extraSlots);
  const { idx: stackIdx, maxStack } = stackIndices(values);

  // 막대 그림
  const padL = 48;
  const padR = 18;
  const padT = 42;
  const padB = 46;
  const S0 = Math.min(84, (region.w - padL - padR) / n);
  const chartW = padL + n * S0 + padR;
  const O0 = { x: region.x + (region.w - chartW) / 2 + padL, y: region.y + region.h - padB };
  const U0 = (region.h - padT - padB) / MAX_U;

  // 균형점 그림
  const U1 = Math.min(60, (region.w - 56) / MAX_U);
  const bx = region.x + (region.w - MAX_U * U1) / 2;
  const beamY = region.y + region.h - 112;
  const wW = Math.min(U1 * 0.78, 40);
  const wH = Math.min(24, 120 / maxStack);
  const segBottom = beamY - BEAM_HALF - maxStack * wH - 14;
  const segAreaTop = region.y + 70;
  const segStep = Math.max(6, Math.min(13, (segBottom - segAreaTop) / n));
  const segThick = Math.max(4, Math.min(9, segStep - 3));
  const segTop = segBottom - n * segStep;

  // 눕힌 막대
  const rowTop = region.y + 36;
  const S1 = Math.min(46, (beamY - 30 - rowTop) / n);

  return {
    n,
    region,
    O0,
    U0,
    S0,
    bx,
    U1,
    rowTop,
    S1,
    beamY,
    wW,
    wH,
    segTop,
    segStep,
    segThick,
    stripY: region.y + 16,
    barGap: 0.2,
    barFrac: 0.6,
    stackIdx,
    maxStack,
  };
}

// s: 돌리기(0~0.5), r1: 막대가 끝만 남기고 줄어들기(0.5~0.75), r2: 추가 저울대로 떨어지기(0.75~1)
export function phases(t: number) {
  return {
    s: ease(clamp01(t / 0.5)),
    r1: ease(clamp01((t - 0.5) / 0.25)),
    r2: ease(clamp01((t - 0.75) / 0.25)),
  };
}

export interface Frame {
  cos: number;
  sin: number;
  Cx: number;
  Cy: number;
  uc: number;
  wc: number;
  U: number;
  S: number;
}

// 그림 가운데를 중심으로 돌리고, 도는 동안 살짝 작아져서 화면 밖으로 나가지 않게 한다.
export function frameAt(L: Layout, s: number): Frame {
  const th = (s * Math.PI) / 2;
  const uc = MAX_U / 2;
  const wc = L.n / 2;
  const dip = 1 - 0.34 * Math.sin(Math.PI * s);
  return {
    cos: Math.cos(th),
    sin: Math.sin(th),
    Cx: lerp(L.O0.x + wc * L.S0, L.bx + uc * L.U1, s),
    Cy: lerp(L.O0.y - uc * L.U0, L.rowTop + wc * L.S1, s),
    uc,
    wc,
    U: lerp(L.U0, L.U1, s) * dip,
    S: lerp(L.S0, L.S1, s) * dip,
  };
}

// 1단계(돌리기) 좌표 변환
export function P(F: Frame, u: number, w: number): Pt {
  const dw = (w - F.wc) * F.S;
  const du = (u - F.uc) * F.U;
  return {
    x: F.Cx + dw * F.cos + du * F.sin,
    y: F.Cy + dw * F.sin - du * F.cos,
  };
}

export interface BeamRect {
  ua: number;
  ub: number;
  y0: number;
  y1: number;
}

// 지역 좌표 직사각형 → 화면 다각형. target은 균형점 그림에서의 최종 위치.
// 눕힌 뒤에는 먼저 가로 범위(u)가 target으로 바뀌고(r1), 그다음 세로 위치가 target으로 내려간다(r2).
export function localRect(
  L: Layout,
  t: number,
  ua: number,
  ub: number,
  wa: number,
  wb: number,
  target?: BeamRect
): Pt[] {
  const { s, r1, r2 } = phases(t);
  if (t <= 0.5) {
    const F = frameAt(L, s);
    return [P(F, ua, wa), P(F, ub, wa), P(F, ub, wb), P(F, ua, wb)];
  }
  let u0 = ua;
  let u1 = ub;
  let y0 = L.rowTop + wa * L.S1;
  let y1 = L.rowTop + wb * L.S1;
  if (target) {
    u0 = lerp(u0, target.ua, r1);
    u1 = lerp(u1, target.ub, r1);
    y0 = lerp(y0, target.y0, r2);
    y1 = lerp(y1, target.y1, r2);
  }
  const x0 = L.bx + u0 * L.U1;
  const x1 = L.bx + u1 * L.U1;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

// u가 일정한 선분 (눈금선, 칸 나눔선, 평균선)
export function localLine(
  L: Layout,
  t: number,
  u: number,
  wa: number,
  wb: number,
  target?: { y0: number; y1: number }
): [Pt, Pt] {
  const { s, r2 } = phases(t);
  if (t <= 0.5) {
    const F = frameAt(L, s);
    return [P(F, u, wa), P(F, u, wb)];
  }
  const x = L.bx + u * L.U1;
  let y0 = L.rowTop + wa * L.S1;
  let y1 = L.rowTop + wb * L.S1;
  if (target) {
    y0 = lerp(y0, target.y0, r2);
    y1 = lerp(y1, target.y1, r2);
  }
  return [
    { x, y: y0 },
    { x, y: y1 },
  ];
}

// 글자 위치: 막대 그림에서의 픽셀 오프셋 → 눕힌 막대에서의 오프셋 → (선택) 균형점 그림의 절대 위치
export function localLabel(
  L: Layout,
  t: number,
  u: number,
  w: number,
  offBar: Pt,
  offLying: Pt,
  target?: Pt
): Pt {
  const { s, r2 } = phases(t);
  const F = frameAt(L, s);
  const base = P(F, u, w);
  const off = { x: lerp(offBar.x, offLying.x, s), y: lerp(offBar.y, offLying.y, s) };
  const p = { x: base.x + off.x, y: base.y + off.y };
  if (r2 <= 0 || !target) return p;
  return { x: lerp(p.x, target.x, r2), y: lerp(p.y, target.y, r2) };
}

export const polyPoints = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

export const centroid = (pts: Pt[]): Pt => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});

export function weightRect(L: Layout, i: number, v: number): BeamRect {
  const k = L.stackIdx[i] ?? 0;
  const half = L.wW / 2 / L.U1;
  const base = L.beamY - BEAM_HALF;
  return { ua: v - half, ub: v + half, y0: base - (k + 1) * L.wH, y1: base - k * L.wH };
}

export function segmentRow(L: Layout, i: number) {
  const y0 = L.segTop + i * L.segStep;
  return { y0, y1: y0 + L.segThick };
}

// 평균선에서 넘치거나 모자란 부분의 칸 나눔 위치 (정수 눈금)
export function innerIntegers(a: number, b: number) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const out: number[] = [];
  for (let k = Math.floor(lo) + 1; k < hi - 1e-9; k++) out.push(k);
  return out;
}

// 저울이 기우는 각도. maxDeg는 저울대 끝이 바닥에 닿는 각도로 정한다.
export function tiltDegrees(mean: number, p: number, maxDeg = 12) {
  if (!Number.isFinite(mean)) return 0;
  const d = mean - p;
  if (Math.abs(d) < 1e-6) return 0;
  return Math.max(-maxDeg, Math.min(maxDeg, d * 6));
}

export function groundLimitDegrees(arm: number, drop: number) {
  return (Math.asin(Math.min(1, drop / Math.max(arm, 1))) * 180) / Math.PI;
}

export const fmt = (x: number) => String(parseFloat(x.toFixed(2)));
