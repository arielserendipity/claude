import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BEAM_HALF,
  Layout,
  MAX_U,
  P,
  Pt,
  Region,
  centroid,
  clamp01,
  fmt,
  frameAt,
  innerIntegers,
  lerp,
  localLabel,
  localLine,
  localRect,
  makeLayout,
  phases,
  polyPoints,
  segmentRow,
  tiltDegrees,
  groundLimitDegrees,
  weightRect,
} from '../lib/geometry';
import { BEAM, DEFICIT, EXCESS, MEAN, itemColor, itemLabel, itemStroke } from '../lib/palette';
import type { HintRef } from '../lib/hints';

export type ViewMode = 'side' | 'morph';

export interface ActiveHint extends HintRef {
  nonce: number;
}

export const VIEWBOX = { w: 1100, h: 470 };
const SIDE_LEFT: Region = { x: 14, y: 10, w: 516, h: 450 };
const SIDE_RIGHT: Region = { x: 570, y: 10, w: 516, h: 450 };
const MORPH_REGION: Region = { x: 190, y: 10, w: 720, h: 450 };

type DragKind = 'line' | 'fulcrum' | 'bar' | 'weight';

interface DragState {
  kind: DragKind;
  L: Layout;
  index?: number;
  from: number;
}

interface ModelStageProps {
  values: number[];
  p: number;
  onPChange: (p: number) => void;
  onPDragEnd?: (from: number, to: number) => void;
  view: ViewMode;
  morphT: number;
  showCells: boolean;
  selected: number | null;
  onSelect: (i: number | null) => void;
  editable: boolean;
  onValueChange?: (i: number, v: number) => void;
  onValueDragEnd?: (i: number, from: number, to: number) => void;
  onAddValue?: (v: number) => void;
  onRemoveValue?: (i: number) => void;
  hint: ActiveHint | null;
  // 같은 자료를 같은 색·이름표로 보여 주고, 하나를 누르면 짝을 함께 강조한다.
  // 끄면 막대·추를 같은 중립색으로 그리고 짝 강조를 하지 않는다 (학생이 대응을 스스로 찾을 때).
  pairCues?: boolean;
  hideBalance?: boolean; // 시소 그림을 가린다 (예상한 뒤 공개)
  hideBars?: boolean; // 막대 그림을 가린다 (시소 그림을 보고 예상한 뒤 공개)
  lockP?: boolean; // 초록색(초록 선·받침점)을 끌어 옮기지 못하게
  allowAddRemove?: boolean; // 막대·추를 더하거나 지울 수 있는지 (끄면 값만 바꿈)
  tiltScale?: number; // 시소가 기우는 정도 (0~1, 공개할 때 0→1로 움직임)
}

export const MAX_ITEMS = 10;
const NEUTRAL = { fill: '#cbd5e1', stroke: '#475569' };
// 새 자료의 막대 높이·추 위치는 0부터 10(MAX_U)까지
const MIN_V = 0;
const clampV = (u: number) => Math.max(MIN_V, Math.min(MAX_U, Math.round(u)));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const ModelStage: React.FC<ModelStageProps> = ({
  values,
  p,
  onPChange,
  onPDragEnd,
  view,
  morphT,
  showCells,
  selected,
  onSelect,
  editable,
  onValueChange,
  onValueDragEnd,
  onAddValue,
  onRemoveValue,
  hint,
  pairCues = true,
  hideBalance = false,
  hideBars = false,
  lockP = false,
  allowAddRemove = true,
  tiltScale = 1,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const lastRef = useRef<number>(0);
  const movedRef = useRef(false);

  const mean = useMemo(() => (values.length ? sum(values) / values.length : NaN), [values]);
  // 새 자료 만들기: 막대 그림 끝에 '+' 자리를 하나 비워 둔다
  const canAdd = editable && allowAddRemove && !!onAddValue && values.length < MAX_ITEMS;
  const extra = canAdd ? 1 : 0;
  const left = useMemo(() => makeLayout(SIDE_LEFT, values, extra), [values, extra]);
  const right = useMemo(() => makeLayout(SIDE_RIGHT, values, extra), [values, extra]);
  const center = useMemo(() => makeLayout(MORPH_REGION, values, extra), [values, extra]);

  const toSvg = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  // 초록색(초록 선·받침점)은 0.5칸 단위로 움직인다. 평균에 저절로 붙지 않는다 (학생의 판단을 그대로 남기기 위해).
  const snapP = (u: number) => {
    const c = Math.max(0, Math.min(MAX_U, u));
    return Math.round(c * 2) / 2;
  };

  const startDrag = (e: React.PointerEvent, kind: DragKind, L: Layout, index?: number) => {
    e.stopPropagation();
    e.preventDefault();
    if ((kind === 'line' || kind === 'fulcrum') && lockP) return;
    movedRef.current = false;
    const from = kind === 'line' || kind === 'fulcrum' ? p : values[index ?? 0];
    lastRef.current = from;
    setDrag({ kind, L, index, from });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const pt = toSvg(e.clientX, e.clientY);
      if (!pt) return;
      const { L } = drag;
      let next = lastRef.current;
      if (drag.kind === 'line') next = snapP((L.O0.y - pt.y) / L.U0);
      if (drag.kind === 'fulcrum') next = snapP((pt.x - L.bx) / L.U1);
      if (drag.kind === 'bar') next = clampV((L.O0.y - pt.y) / L.U0);
      if (drag.kind === 'weight') next = clampV((pt.x - L.bx) / L.U1);
      if (next === lastRef.current) return;
      movedRef.current = true;
      lastRef.current = next;
      if (drag.kind === 'line' || drag.kind === 'fulcrum') onPChange(next);
      else if (drag.index != null) onValueChange?.(drag.index, next);
    };
    const up = () => {
      const to = lastRef.current;
      if (to !== drag.from) {
        if (drag.kind === 'line' || drag.kind === 'fulcrum') onPDragEnd?.(drag.from, to);
        else if (drag.index != null) onValueDragEnd?.(drag.index, drag.from, to);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const select = (i: number, kind: 'bar' | 'weight') => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (!pairCues) return; // 짝 강조는 짝을 보여 주는 도움이 켜졌을 때만
    onSelect(selected === i ? null : i);
  };

  // 빈 '+' 자리를 누른 높이에 막대를 새로 세운다
  const addBarAt = (e: React.PointerEvent, L: Layout) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = toSvg(e.clientX, e.clientY);
    if (!pt || !onAddValue) return;
    onAddValue(clampV((L.O0.y - pt.y) / L.U0));
  };
  const addWeight = (v: number) => onAddValue?.(v);
  const removeItem = (i: number) => {
    onRemoveValue?.(i);
    onSelect(null);
  };

  const common = {
    values,
    p,
    mean,
    showCells,
    selected: pairCues ? selected : null,
    hint,
    pairCues,
    lockP,
    allowAddRemove,
    tiltScale,
    editable,
    canAdd,
    select,
    startDrag,
    addBarAt,
    addWeight,
    removeItem,
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="w-full h-full select-none"
      style={{ touchAction: 'none', overflow: 'visible', fontFamily: "'Jua', sans-serif" }}
      onClick={() => onSelect(null)}
    >
      <Defs />
      {view === 'side' ? (
        <>
          <RegionBg region={SIDE_LEFT} />
          <RegionBg region={SIDE_RIGHT} />
          <LinkBadge x={(SIDE_LEFT.x + SIDE_LEFT.w + SIDE_RIGHT.x) / 2} y={SIDE_LEFT.y + SIDE_LEFT.h / 2} />
          {/* 가린 그림은 아예 그리지 않는다 (초록 선 손잡이처럼 영역 밖으로 나오는 부분까지 감추기 위해) */}
          {!hideBars && <ModelView L={left} t={0} {...common} />}
          {!hideBalance && <ModelView L={right} t={1} {...common} />}
          {!hideBalance && !hideBars && <Connectors left={left} right={right} values={values} p={p} hint={hint} />}
          {hideBalance && <Cover region={SIDE_RIGHT} title="시소 그림은 잠깐 가려 두었어요" />}
          {hideBars && <Cover region={SIDE_LEFT} title="막대 그림은 잠깐 가려 두었어요" />}
        </>
      ) : (
        <>
          <RegionBg region={MORPH_REGION} />
          <ModelView L={center} t={morphT} {...common} />
        </>
      )}
    </svg>
  );
};

const Defs = () => (
  <defs>
    <pattern id="hatch-excess" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <rect width="8" height="8" fill={EXCESS.fill} />
      <line x1="0" y1="0" x2="0" y2="8" stroke={EXCESS.strong} strokeWidth="3" />
    </pattern>
    {[
      ['mean', MEAN.stroke],
      ['excess', EXCESS.stroke],
      ['deficit', DEFICIT.stroke],
    ].map(([id, c]) => (
      <marker key={id} id={`arrow-${id}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
      </marker>
    ))}
  </defs>
);

const RegionBg = ({ region }: { region: Region }) => (
  <rect x={region.x} y={region.y} width={region.w} height={region.h} rx={24} fill="#ffffff" stroke="#e2e8f0" strokeWidth={2} />
);

const LinkBadge = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x},${y})`} pointerEvents="none">
    <circle r={17} fill="#eef2ff" stroke="#c7d2fe" strokeWidth={2} />
    <path d="M -8 -4 L 8 -4 M 4 -8 L 8 -4 L 4 0 M 8 4 L -8 4 M -4 0 L -8 4 L -4 8" stroke="#6366f1" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

interface ModelViewProps {
  L: Layout;
  t: number;
  values: number[];
  p: number;
  mean: number;
  showCells: boolean;
  selected: number | null;
  hint: ActiveHint | null;
  pairCues: boolean;
  lockP: boolean;
  allowAddRemove: boolean;
  tiltScale: number;
  editable: boolean;
  canAdd: boolean;
  select: (i: number, kind: 'bar' | 'weight') => void;
  startDrag: (e: React.PointerEvent, kind: DragKind, L: Layout, index?: number) => void;
  addBarAt: (e: React.PointerEvent, L: Layout) => void;
  addWeight: (v: number) => void;
  removeItem: (i: number) => void;
}

function ModelView({
  L,
  t,
  values,
  p,
  mean,
  showCells,
  selected,
  hint,
  pairCues,
  lockP,
  allowAddRemove,
  tiltScale,
  editable,
  canAdd,
  select,
  startDrag,
  addBarAt,
  addWeight,
  removeItem,
}: ModelViewProps) {
  const { s, r1, r2 } = phases(t);
  const n = values.length;
  const g = L.barGap;
  const f = L.barFrac;
  const atBar = t <= 0.001;
  const atBalance = t >= 0.999;
  const F = frameAt(L, s);
  const pivot = { x: L.bx + p * L.U1, y: L.beamY + BEAM_HALF };
  const baseY = pivot.y + 42;
  const arm = Math.max(pivot.x - (L.bx - 16), L.bx + MAX_U * L.U1 + 16 - pivot.x);
  const tilt = tiltDegrees(mean, p, groundLimitDegrees(arm, baseY - pivot.y - 2)) * r2 * tiltScale;
  // 같은 자료의 색·이름표는 짝을 보여 주는 도움이 켜졌을 때만
  const fillOf = (i: number) => (pairCues ? itemColor(i) : NEUTRAL.fill);
  const strokeOf = (i: number) => (pairCues ? itemStroke(i) : NEUTRAL.stroke);
  const lateR = clamp01((r2 - 0.6) / 0.4);
  const early = 1 - clamp01(r1 * 1.6);

  const hk = hint?.key;
  const targetIdx = hint?.target != null ? values.indexOf(hint.target) : -1;
  const focusIdx = (hk === 'EXCESS_TO_DISTANCE' || hk === 'DEFICIT_TO_GAP') && targetIdx >= 0 ? targetIdx : null;
  const dimRef = focusIdx ?? selected;
  const op = (i: number) => (dimRef == null || dimRef === i ? 1 : 0.28);
  const pIsInt = Math.abs(p - Math.round(p)) < 1e-9;
  const leveling = hk === 'LEVELING' && atBar && pIsInt;
  const sumStrips = hk === 'SUM_BALANCE' && atBalance;
  const segOn = (i: number) =>
    showCells || hk === 'SUM_BALANCE' || hk === 'LEVELING' || hk === 'CELLS_TO_DISTANCE' || focusIdx === i;
  const pulseSeg = (i: number) => focusIdx === i || hk === 'CELLS_TO_DISTANCE';

  // 자료값 축 (막대 그림의 세로축 → 저울대)
  const axis: [Pt, Pt] =
    t <= 0.5
      ? [P(F, 0, 0), P(F, MAX_U + 0.35, 0)]
      : [
          { x: L.bx, y: lerp(L.rowTop, L.beamY, r2) },
          { x: L.bx + (MAX_U + 0.35) * L.U1, y: lerp(L.rowTop, L.beamY, r2) },
        ];
  const W = L.n; // 막대 그림 가로 칸 수 ('+' 자리 포함)
  const baseline = localLine(L, t, 0, 0, W, { y0: L.beamY, y1: L.beamY });

  const meanLine = localLine(L, t, p, -0.25, W + 0.25, { y0: pivot.y, y1: pivot.y });
  const handle = localLabel(L, t, p, W + 0.25, { x: 26, y: 0 }, { x: 0, y: 26 });

  return (
    <g>
      <g transform={`rotate(${tilt.toFixed(3)} ${pivot.x.toFixed(2)} ${pivot.y.toFixed(2)})`}>
        {/* 눈금 격자 (막대 그림) */}
        {r2 < 1 &&
          Array.from({ length: MAX_U }, (_, k) => k + 1).map((u) => {
            const [a, b] = localLine(L, t, u, 0, W, { y0: L.beamY, y1: L.beamY });
            return (
              <line key={`grid-${u}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e2e8f0" strokeWidth={1.5} opacity={1 - r2} pointerEvents="none" />
            );
          })}

        {/* 축 → 저울대 */}
        <line x1={axis[0].x} y1={axis[0].y} x2={axis[1].x} y2={axis[1].y} stroke="#94a3b8" strokeWidth={2.5} opacity={1 - r2} />
        <line x1={baseline[0].x} y1={baseline[0].y} x2={baseline[1].x} y2={baseline[1].y} stroke="#94a3b8" strokeWidth={2.5} opacity={1 - r2} />
        {r2 > 0 && (
          <g opacity={r2} pointerEvents="none">
            <rect
              x={L.bx - 16}
              y={L.beamY - BEAM_HALF}
              width={MAX_U * L.U1 + 32}
              height={BEAM_HALF * 2}
              rx={BEAM_HALF}
              fill={BEAM.fill}
              stroke={BEAM.stroke}
              strokeWidth={2}
            />
            {Array.from({ length: MAX_U + 1 }, (_, u) => (
              <line
                key={`tick-${u}`}
                x1={L.bx + u * L.U1}
                x2={L.bx + u * L.U1}
                y1={L.beamY + BEAM_HALF - 5}
                y2={L.beamY + BEAM_HALF}
                stroke={BEAM.stroke}
                strokeWidth={2}
              />
            ))}
          </g>
        )}
        {Array.from({ length: MAX_U + 1 }, (_, u) => {
          const pos = localLabel(L, t, u, 0, { x: -22, y: 5 }, { x: 0, y: -12 }, { x: L.bx + u * L.U1, y: L.beamY + 5 });
          return (
            <text key={`ul-${u}`} x={pos.x} y={pos.y} fontSize={14} textAnchor="middle" fill={r2 > 0.5 ? BEAM.text : '#64748b'} pointerEvents="none">
              {u}
            </text>
          );
        })}

        {/* 막대 (→ 추) */}
        {values.map((v, i) => {
          const top = leveling ? Math.min(v, p) : v;
          const pts = localRect(L, t, 0, top, i + g, i + g + f, weightRect(L, i, v));
          const canDrag = editable && atBar && !hk;
          const labelV = localLabel(L, t, v, i + g + f / 2, { x: 0, y: -10 }, { x: 16, y: 5 });
          const labelI = localLabel(L, t, 0, i + g + f / 2, { x: 0, y: 24 }, { x: -20, y: 5 });
          return (
            <g key={`bar-${i}`} opacity={op(i)}>
              <polygon
                data-bar={i}
                points={polyPoints(pts)}
                fill={fillOf(i)}
                stroke={strokeOf(i)}
                strokeWidth={selected === i ? 3.5 : 1.5}
                strokeLinejoin="round"
                opacity={1 - lateR}
                pointerEvents={lateR > 0.5 ? 'none' : 'auto'}
                style={{ cursor: canDrag ? 'ns-resize' : 'pointer' }}
                onPointerDown={canDrag ? (e) => startDrag(e, 'bar', L, i) : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  select(i, 'bar');
                }}
              />
              {v === 0 && lateR < 1 && (() => {
                // 높이가 0인 막대도 보이도록 바닥에 굵은 선을 긋는다
                const [a, b] = localLine(L, t, 0, i + g, i + g + f);
                return (
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={strokeOf(i)} strokeWidth={6} strokeLinecap="round" opacity={1 - lateR} pointerEvents="none" />
                );
              })()}
              {canDrag && (
                // 막대 윗부분(0인 막대는 바닥 바로 위)을 잡아 끌 수 있는 넉넉한 손잡이 영역
                <polygon
                  points={polyPoints(localRect(L, t, top, Math.min(top + 0.8, MAX_U + 0.4), i + g, i + g + f, weightRect(L, i, v)))}
                  fill="transparent"
                  style={{ cursor: 'ns-resize' }}
                  onPointerDown={(e) => startDrag(e, 'bar', L, i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(i, 'bar');
                  }}
                />
              )}
              {early > 0 &&
                innerIntegers(0, top).map((k) => {
                  const [a, b] = localLine(L, t, k, i + g, i + g + f);
                  return (
                    <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={0.65 * early} strokeWidth={1.5} pointerEvents="none" />
                  );
                })}
              {canDrag && (
                <g transform={`translate(${labelV.x},${labelV.y - 16})`} pointerEvents="none">
                  <path d="M -6 0 L 0 -7 L 6 0 Z" fill={strokeOf(i)} />
                </g>
              )}
              {pairCues && (
                <text x={labelI.x} y={labelI.y} fontSize={15} textAnchor="middle" fill={itemStroke(i)} opacity={early} pointerEvents="none">
                  {itemLabel(i)}
                </text>
              )}
            </g>
          );
        })}

        {/* 새 자료: 막대 그림 끝의 '+' 자리 — 누른 높이에 막대가 생긴다 */}
        {canAdd && atBar && (
          <AddBarSlot L={L} slot={n} empty={n === 0} onPointerDown={(e) => addBarAt(e, L)} />
        )}
        {editable && allowAddRemove && atBar && !hk &&
          values.map((_, i) => {
            const pos = localLabel(L, t, 0, i + g + f / 2, { x: 0, y: 46 }, { x: -20, y: 5 });
            return <DeleteButton key={`del-bar-${i}`} x={pos.x} y={pos.y} onClick={() => removeItem(i)} />;
          })}

        {/* 새 자료: 저울대 위 점선 추를 누르면 그 자리에 추가 놓인다 */}
        {canAdd && atBalance && !hk && <GhostWeights L={L} values={values} onAdd={addWeight} />}

        {/* 추 */}
        {lateR > 0 &&
          values.map((v, i) => {
            const wr = weightRect(L, i, v);
            const x0 = L.bx + wr.ua * L.U1;
            const x1 = L.bx + wr.ub * L.U1;
            const w = x1 - x0;
            const h = wr.y1 - wr.y0;
            const cx = (x0 + x1) / 2;
            const inset = w * 0.12;
            const canDrag = editable && atBalance && !hk;
            const d = `M ${x0 + inset} ${wr.y0 + 1} L ${x1 - inset} ${wr.y0 + 1} L ${x1} ${wr.y1 - 3} Q ${x1} ${wr.y1} ${x1 - 3} ${wr.y1} L ${x0 + 3} ${wr.y1} Q ${x0} ${wr.y1} ${x0} ${wr.y1 - 3} Z`;
            return (
              <g
                key={`w-${i}`}
                data-weight={i}
                opacity={lateR * op(i)}
                style={{ cursor: canDrag ? 'ew-resize' : 'pointer' }}
                onPointerDown={canDrag ? (e) => startDrag(e, 'weight', L, i) : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  select(i, 'weight');
                }}
              >
                <circle cx={cx} cy={wr.y0 - 2} r={4.5} fill="none" stroke={strokeOf(i)} strokeWidth={2.5} />
                <path d={d} fill={fillOf(i)} stroke={strokeOf(i)} strokeWidth={selected === i ? 3.5 : 1.5} strokeLinejoin="round" />
                {pairCues && (
                  <text x={cx} y={wr.y0 + h / 2 + 5} fontSize={Math.min(14, h * 0.62)} textAnchor="middle" fill="#1e293b" pointerEvents="none">
                    {itemLabel(i)}
                  </text>
                )}
                {canDrag && (
                  <>
                    <path d={`M ${x0 - 3} ${(wr.y0 + wr.y1) / 2} l -6 -5 l 0 10 z`} fill={strokeOf(i)} />
                    <path d={`M ${x1 + 3} ${(wr.y0 + wr.y1) / 2} l 6 -5 l 0 10 z`} fill={strokeOf(i)} />
                  </>
                )}
              </g>
            );
          })}

        {editable && allowAddRemove && atBalance && !hk && selected != null && selected < values.length && (() => {
          const wr = weightRect(L, selected, values[selected]);
          return (
            <DeleteButton
              x={L.bx + wr.ub * L.U1 + 6}
              y={wr.y0 - 6}
              onClick={() => removeItem(selected)}
            />
          );
        })()}

        {/* 초록 선보다 넘친 칸(주황) / 모자란 칸(파랑) → 추와 받침점 사이 거리 */}
        {!leveling &&
          values.map((v, i) => {
            if (Math.abs(v - p) < 1e-9 || !segOn(i)) return null;
            const lo = Math.min(v, p);
            const hi = Math.max(v, p);
            const excess = v > p;
            const row = segmentRow(L, i);
            const pts = localRect(L, t, lo, hi, i + g, i + g + f, { ua: lo, ub: hi, y0: row.y0, y1: row.y1 });
            const col = excess ? EXCESS : DEFICIT;
            const focus = focusIdx === i;
            const numPos = localLabel(L, t, (lo + hi) / 2, i + g + f, { x: 18, y: 6 }, { x: 0, y: 24 }, {
              x: L.bx + ((lo + hi) / 2) * L.U1,
              y: row.y0 - 7,
            });
            const wr = weightRect(L, i, v);
            return (
              <g key={`seg-${i}`} opacity={op(i)} pointerEvents="none">
                <g className={pulseSeg(i) ? 'hint-pulse' : undefined}>
                  <polygon
                    points={polyPoints(pts)}
                    fill={excess ? 'url(#hatch-excess)' : DEFICIT.fill}
                    fillOpacity={excess ? 1 : 0.85}
                    stroke={col.stroke}
                    strokeWidth={focus ? 3 : 2}
                    strokeDasharray={excess ? undefined : '5 4'}
                    strokeLinejoin="round"
                  />
                  {innerIntegers(lo, hi).map((k) => {
                    const [a, b] = localLine(L, t, k, i + g, i + g + f, { y0: row.y0, y1: row.y1 });
                    return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col.stroke} strokeWidth={1.5} strokeDasharray={excess ? undefined : '3 3'} />;
                  })}
                </g>
                {focus && (
                  <text x={numPos.x} y={numPos.y} fontSize={20} textAnchor="middle" fill={col.stroke} stroke="#fff" strokeWidth={4} paintOrder="stroke">
                    {fmt(hi - lo)}
                  </text>
                )}
                {focus && lateR > 0 && (
                  <g opacity={lateR} stroke={col.stroke} strokeWidth={2} strokeDasharray="4 4">
                    <line x1={L.bx + v * L.U1} x2={L.bx + v * L.U1} y1={row.y1} y2={wr.y0 - 8} />
                    <line x1={pivot.x} x2={pivot.x} y1={row.y1} y2={L.beamY - BEAM_HALF} />
                  </g>
                )}
              </g>
            );
          })}

        {/* 막대 값 (칸 위에 보이도록 마지막에) */}
        {!leveling &&
          early > 0 &&
          values.map((v, i) => {
            const pos = localLabel(L, t, v, i + g + f / 2, { x: 0, y: -10 }, { x: 16, y: 5 });
            return (
              <text
                key={`val-${i}`}
                x={pos.x}
                y={pos.y}
                fontSize={16}
                textAnchor="middle"
                fill="#334155"
                stroke="#ffffff"
                strokeWidth={4}
                paintOrder="stroke"
                opacity={early * op(i)}
                pointerEvents="none"
              >
                {v}
              </text>
            );
          })}

        {leveling && <LevelingOverlay L={L} values={values} p={p} nonce={hint?.nonce ?? 0} fillOf={fillOf} />}
      </g>

      {sumStrips && <SumStripsOverlay L={L} values={values} p={p} nonce={hint?.nonce ?? 0} />}

      {/* 초록 선 (막대 그림의 기준선) */}
      {r2 < 1 && (
        <g opacity={1 - r2}>
          {hk === 'MEAN_LINK' && (
            <line x1={meanLine[0].x} y1={meanLine[0].y} x2={meanLine[1].x} y2={meanLine[1].y} stroke={MEAN.strong} strokeLinecap="round" className="glow-line" pointerEvents="none" />
          )}
          <line x1={meanLine[0].x} y1={meanLine[0].y} x2={meanLine[1].x} y2={meanLine[1].y} stroke={MEAN.stroke} strokeWidth={4} strokeLinecap="round" pointerEvents="none" />
          {atBar && !lockP && (
            <line
              x1={meanLine[0].x}
              y1={meanLine[0].y}
              x2={meanLine[1].x}
              y2={meanLine[1].y}
              stroke="transparent"
              strokeWidth={26}
              style={{ cursor: 'ns-resize' }}
              onPointerDown={(e) => startDrag(e, 'line', L)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <g
            transform={`translate(${handle.x},${handle.y})`}
            style={{ cursor: atBar && !lockP ? 'ns-resize' : 'default' }}
            onPointerDown={atBar && !lockP ? (e) => startDrag(e, 'line', L) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {hk === 'MEAN_LINK' && <circle r={27} fill={MEAN.strong} opacity={0.35} className="hint-pulse" />}
            <circle r={18} fill={MEAN.stroke} stroke="#fff" strokeWidth={3} />
            <text y={6} textAnchor="middle" fontSize={16} fill="#fff">
              {fmt(p)}
            </text>
            {atBar && !lockP && (
              <>
                <path d="M -6 -23 L 0 -30 L 6 -23 Z" fill={MEAN.stroke} />
                <path d="M -6 23 L 0 30 L 6 23 Z" fill={MEAN.stroke} />
              </>
            )}
          </g>
        </g>
      )}

      {/* 받침점 (시소 그림) */}
      {r2 > 0 && (
        <g opacity={r2}>
          <line x1={L.region.x + 14} x2={L.region.x + L.region.w - 14} y1={baseY} y2={baseY} stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" pointerEvents="none" />
          <g
            transform={`translate(${pivot.x},${pivot.y}) scale(${Math.max(0.01, r2)})`}
            style={{ cursor: atBalance && !lockP ? 'ew-resize' : 'default' }}
            onPointerDown={atBalance && !lockP ? (e) => startDrag(e, 'fulcrum', L) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {hk === 'MEAN_LINK' && <circle cy={24} r={34} fill={MEAN.strong} opacity={0.35} className="hint-pulse" />}
            <rect x={-34} y={0} width={68} height={42} fill="transparent" />
            <path d="M 0 0 L 25 42 L -25 42 Z" fill={MEAN.stroke} stroke="#14532d" strokeWidth={2} strokeLinejoin="round" />
          </g>
          <g
            transform={`translate(${pivot.x},${baseY + 22})`}
            style={{ cursor: atBalance && !lockP ? 'ew-resize' : 'default' }}
            onPointerDown={atBalance && !lockP ? (e) => startDrag(e, 'fulcrum', L) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 초록 선 손잡이와 같은 초록 동그라미: 두 그림의 '초록색'이 같은 것임을 보여 준다 */}
            <circle r={18} fill={MEAN.stroke} stroke="#fff" strokeWidth={3} />
            <text y={6} textAnchor="middle" fontSize={16} fill="#fff">
              {fmt(p)}
            </text>
            {atBalance && !lockP && (
              <>
                <path d="M -23 -6 L -30 0 L -23 6 Z" fill={MEAN.stroke} />
                <path d="M 23 -6 L 30 0 L 23 6 Z" fill={MEAN.stroke} />
              </>
            )}
          </g>
        </g>
      )}
    </g>
  );
}

// 넘친 칸이 날아가 모자란 칸을 채우는 애니메이션 (막대 그림)
function LevelingOverlay({ L, values, p, nonce, fillOf }: { L: Layout; values: number[]; p: number; nonce: number; fillOf: (i: number) => string }) {
  const g = L.barGap;
  const f = L.barFrac;
  const X = (i: number) => L.O0.x + (i + g) * L.S0;
  const Y = (u: number) => L.O0.y - u * L.U0;
  const w = f * L.S0;
  const h = L.U0;
  const cells: { i: number; u: number }[] = [];
  values.forEach((v, i) => {
    for (let u = v - 1; u >= p - 1e-9; u--) cells.push({ i, u });
  });
  const slots: { i: number; u: number }[] = [];
  values.forEach((v, i) => {
    for (let u = v; u <= p - 1 + 1e-9; u++) slots.push({ i, u });
  });
  return (
    <g key={nonce} pointerEvents="none">
      {slots.map((sl, k) => (
        <rect key={`slot-${k}`} x={X(sl.i)} y={Y(sl.u + 1)} width={w} height={h} fill={DEFICIT.fill} fillOpacity={0.7} stroke={DEFICIT.stroke} strokeWidth={2} strokeDasharray="5 4" />
      ))}
      {cells.map((c, k) => {
        const target = slots[k];
        const dx = target ? X(target.i) - X(c.i) : 0;
        const dy = target ? Y(target.u + 1) - Y(c.u + 1) : 0;
        return (
          <motion.rect
            key={`cell-${nonce}-${k}`}
            x={X(c.i)}
            y={Y(c.u + 1)}
            width={w}
            height={h}
            rx={3}
            fill={fillOf(c.i)}
            stroke={EXCESS.stroke}
            strokeWidth={2.5}
            initial={{ x: 0, y: 0 }}
            animate={{ x: dx, y: dy }}
            transition={{ delay: 0.9 + k * 0.4, duration: 0.8, ease: 'easeInOut' }}
          />
        );
      })}
    </g>
  );
}

// 왼쪽 거리들(파랑)과 오른쪽 거리들(주황)을 각각 한 줄로 이어 붙여 길이를 견주기 (시소 그림)
function SumStripsOverlay({ L, values, p, nonce }: { L: Layout; values: number[]; p: number; nonce: number }) {
  const leftItems = values.map((v, i) => ({ v, i })).filter((o) => o.v < p - 1e-9);
  const rightItems = values.map((v, i) => ({ v, i })).filter((o) => o.v > p + 1e-9);
  const D = sum(leftItems.map((o) => p - o.v));
  const E = sum(rightItems.map((o) => o.v - p));
  const k = Math.min(1, MAX_U / Math.max(D, E, 1));
  const unit = L.U1 * k;
  const H = 16;
  const rows = [
    { items: leftItems, y: L.stripY, col: DEFICIT, total: D, dir: -1 },
    { items: rightItems, y: L.stripY + H + 10, col: EXCESS, total: E, dir: 1 },
  ];
  let order = 0;
  const nPieces = leftItems.length + rightItems.length;
  const doneDelay = 0.5 + nPieces * 0.3 + 0.8;
  return (
    <g key={nonce} pointerEvents="none">
      {rows.map((row, ri) => {
        let cum = 0;
        return (
          <g key={ri}>
            <path
              d={row.dir < 0 ? `M ${L.bx - 10} ${row.y + H / 2} l 8 -7 l 0 14 z` : `M ${L.bx - 2} ${row.y + H / 2} l -8 -7 l 0 14 z`}
              fill={row.col.stroke}
            />
            {row.items.map((o) => {
              const lo = Math.min(o.v, p);
              const len = Math.abs(o.v - p);
              const seg = segmentRow(L, o.i);
              const fx = L.bx + cum * unit;
              const fw = len * unit;
              cum += len;
              const sx = L.bx + lo * L.U1;
              const sw = len * L.U1;
              const delay = 0.5 + order++ * 0.3;
              return (
                <motion.rect
                  key={`${nonce}-${o.i}`}
                  x={fx}
                  y={row.y}
                  width={fw}
                  height={H}
                  fill={row.dir < 0 ? DEFICIT.fill : 'url(#hatch-excess)'}
                  stroke={row.col.stroke}
                  strokeWidth={2}
                  style={{ originX: 0, originY: 0 }}
                  initial={{ x: sx - fx, y: seg.y0 - row.y, scaleX: sw / Math.max(fw, 0.001), scaleY: L.segThick / H }}
                  animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1 }}
                  transition={{ delay, duration: 0.7, ease: 'easeInOut' }}
                />
              );
            })}
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: doneDelay }}>
              {innerIntegers(0, row.total).map((u) => (
                <line key={u} x1={L.bx + u * unit} x2={L.bx + u * unit} y1={row.y} y2={row.y + H} stroke={row.col.stroke} strokeWidth={1.5} />
              ))}
              <text x={L.bx + row.total * unit + 12} y={row.y + H - 2} fontSize={18} fill={row.col.stroke}>
                {fmt(row.total)}
              </text>
            </motion.g>
          </g>
        );
      })}
    </g>
  );
}

// 예상하기: 한 그림을 가려 둔다 (평평하게 고정된 시소나 빈 막대를 보여 주면 그 모습으로 오해할 수 있어 아예 덮는다)
function Cover({ region, title }: { region: Region; title: string }) {
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  return (
    <g onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <rect x={region.x} y={region.y} width={region.w} height={region.h} rx={24} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="10 8" />
      <circle cx={cx} cy={cy - 40} r={44} fill="#e2e8f0" />
      <text x={cx} y={cy - 22} fontSize={56} textAnchor="middle" fill="#94a3b8">
        ?
      </text>
      <text x={cx} y={cy + 44} fontSize={22} textAnchor="middle" fill="#64748b">
        {title}
      </text>
      <text x={cx} y={cy + 76} fontSize={18} textAnchor="middle" fill="#94a3b8">
        예상한 뒤 ‘확인하기’를 누르면 보여요
      </text>
    </g>
  );
}

// 함께 보기에서 두 그림의 같은 부분을 화살표로 잇기
function Connectors({ left, right, values, p, hint }: { left: Layout; right: Layout; values: number[]; p: number; hint: ActiveHint | null }) {
  if (!hint) return null;
  const g = left.barGap;
  const f = left.barFrac;
  let A: Pt | null = null;
  let B: Pt | null = null;
  let marker = 'mean';
  let color = MEAN.stroke;
  if (hint.key === 'MEAN_LINK') {
    const h = P(frameAt(left, 0), p, left.n + 0.25);
    A = { x: h.x + 26, y: h.y + 20 };
    B = { x: right.bx + p * right.U1 - 26, y: right.beamY + BEAM_HALF + 64 };
  } else if (hint.key === 'EXCESS_TO_DISTANCE' || hint.key === 'DEFICIT_TO_GAP') {
    const i = hint.target != null ? values.indexOf(hint.target) : -1;
    if (i < 0) return null;
    const v = values[i];
    if (Math.abs(v - p) < 1e-9) return null;
    const lo = Math.min(v, p);
    const hi = Math.max(v, p);
    const barPart = centroid(localRect(left, 0, lo, hi, i + g, i + g + f));
    const row = segmentRow(right, i);
    const seg = { x: right.bx + ((lo + hi) / 2) * right.U1, y: row.y0 - 2 };
    const barAnchor = { x: barPart.x + (f * left.S0) / 2 + 4, y: barPart.y };
    if (hint.key === 'EXCESS_TO_DISTANCE') {
      A = barAnchor;
      B = seg;
      marker = 'excess';
      color = EXCESS.stroke;
    } else {
      A = seg;
      B = barAnchor;
      marker = 'deficit';
      color = DEFICIT.stroke;
    }
  }
  if (!A || !B) return null;
  const top = Math.max(20, Math.min(A.y, B.y) - 110);
  const d = `M ${A.x} ${A.y} C ${lerp(A.x, B.x, 0.25)} ${top}, ${lerp(A.x, B.x, 0.75)} ${top}, ${B.x} ${B.y}`;
  return (
    <g key={hint.nonce} pointerEvents="none">
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" opacity={0.8} />
      <path d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" className="marching" markerEnd={`url(#arrow-${marker})`} />
      <circle cx={A.x} cy={A.y} r={6} fill={color} />
    </g>
  );
}

// 새 자료 만들기: 막대를 세울 빈 자리
function AddBarSlot({ L, slot, empty, onPointerDown }: { L: Layout; slot: number; empty: boolean; onPointerDown: (e: React.PointerEvent) => void }) {
  const x = L.O0.x + (slot + L.barGap) * L.S0;
  const w = L.barFrac * L.S0;
  const top = L.O0.y - MAX_U * L.U0;
  const cy = L.O0.y - (MAX_U - 1) * L.U0; // '+'는 평균선과 겹치지 않게 위쪽에
  return (
    <g
      className={empty ? 'soft-pulse' : 'ghost'}
      style={{ cursor: 'copy' }}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <rect x={x} y={top} width={w} height={MAX_U * L.U0} rx={8} fill="#eef2ff" fillOpacity={0.6} stroke="#818cf8" strokeWidth={2} strokeDasharray="7 6" />
      <circle cx={x + w / 2} cy={cy} r={Math.min(18, w / 2 - 2)} fill="#6366f1" />
      <path d={`M ${x + w / 2 - 8} ${cy} h 16 M ${x + w / 2} ${cy - 8} v 16`} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

// 새 자료 만들기: 각 눈금 위의 점선 추 (누르면 그 자리에 추가 놓임)
function GhostWeights({ L, values, onAdd }: { L: Layout; values: number[]; onAdd: (v: number) => void }) {
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const base = L.beamY - BEAM_HALF;
  return (
    <g>
      {Array.from({ length: MAX_U - MIN_V + 1 }, (_, k) => k + MIN_V).map((u) => {
        const k = counts.get(u) ?? 0;
        const cx = L.bx + u * L.U1;
        const y0 = base - (k + 1) * L.wH;
        return (
          <g
            key={`ghost-${u}`}
            data-ghost={u}
            className={values.length === 0 ? 'ghost soft-pulse' : 'ghost'}
            style={{ cursor: 'copy' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAdd(u);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <rect x={cx - L.wW / 2} y={y0} width={L.wW} height={L.wH - 2} rx={5} fill="#eef2ff" stroke="#818cf8" strokeWidth={1.8} strokeDasharray="4 3" />
            <path d={`M ${cx - 5} ${y0 + L.wH / 2 - 1} h 10 M ${cx} ${y0 + L.wH / 2 - 6} v 10`} stroke="#6366f1" strokeWidth={2.2} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function DeleteButton({ x, y, onClick }: { x: number; y: number; onClick: () => void }) {
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <circle r={11} fill="#fff1f2" stroke="#fb7185" strokeWidth={2} />
      <path d="M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5" stroke="#e11d48" strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}
