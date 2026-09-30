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
  hint: ActiveHint | null;
}

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
  hint,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const lastRef = useRef<number>(0);
  const movedRef = useRef(false);

  const mean = useMemo(() => sum(values) / Math.max(1, values.length), [values]);
  const left = useMemo(() => makeLayout(SIDE_LEFT, values), [values]);
  const right = useMemo(() => makeLayout(SIDE_RIGHT, values), [values]);
  const center = useMemo(() => makeLayout(MORPH_REGION, values), [values]);

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

  // 평균선/받침점은 0.5칸 단위로 움직이고, 실제 평균 가까이에서는 평균에 딱 붙는다.
  const snapP = (u: number) => {
    const c = Math.max(0, Math.min(MAX_U, u));
    if (Math.abs(c - mean) < 0.2) return mean;
    return Math.round(c * 2) / 2;
  };

  const startDrag = (e: React.PointerEvent, kind: DragKind, L: Layout, index?: number) => {
    e.stopPropagation();
    e.preventDefault();
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
      if (drag.kind === 'bar') next = Math.max(1, Math.min(MAX_U, Math.round((L.O0.y - pt.y) / L.U0)));
      if (drag.kind === 'weight') next = Math.max(1, Math.min(MAX_U, Math.round((pt.x - L.bx) / L.U1)));
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

  const select = (i: number) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onSelect(selected === i ? null : i);
  };

  const common = { values, p, mean, showCells, selected, hint, editable, select, startDrag };

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
          <ModelView L={left} t={0} {...common} />
          <ModelView L={right} t={1} {...common} />
          <Connectors left={left} right={right} values={values} p={p} hint={hint} />
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
  editable: boolean;
  select: (i: number) => void;
  startDrag: (e: React.PointerEvent, kind: DragKind, L: Layout, index?: number) => void;
}

function ModelView({ L, t, values, p, mean, showCells, selected, hint, editable, select, startDrag }: ModelViewProps) {
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
  const tilt = tiltDegrees(mean, p, groundLimitDegrees(arm, baseY - pivot.y - 2)) * r2;
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
  const baseline = localLine(L, t, 0, 0, n, { y0: L.beamY, y1: L.beamY });

  const meanLine = localLine(L, t, p, -0.25, n + 0.25, { y0: pivot.y, y1: pivot.y });
  const handle = localLabel(L, t, p, n + 0.25, { x: 26, y: 0 }, { x: 0, y: 26 });

  return (
    <g>
      <g transform={`rotate(${tilt.toFixed(3)} ${pivot.x.toFixed(2)} ${pivot.y.toFixed(2)})`}>
        {/* 눈금 격자 (막대 그림) */}
        {r2 < 1 &&
          Array.from({ length: MAX_U }, (_, k) => k + 1).map((u) => {
            const [a, b] = localLine(L, t, u, 0, n, { y0: L.beamY, y1: L.beamY });
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
                points={polyPoints(pts)}
                fill={itemColor(i)}
                stroke={itemStroke(i)}
                strokeWidth={selected === i ? 3.5 : 1.5}
                strokeLinejoin="round"
                opacity={1 - lateR}
                pointerEvents={lateR > 0.5 ? 'none' : 'auto'}
                style={{ cursor: canDrag ? 'ns-resize' : 'pointer' }}
                onPointerDown={canDrag ? (e) => startDrag(e, 'bar', L, i) : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  select(i);
                }}
              />
              {early > 0 &&
                innerIntegers(0, top).map((k) => {
                  const [a, b] = localLine(L, t, k, i + g, i + g + f);
                  return (
                    <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={0.65 * early} strokeWidth={1.5} pointerEvents="none" />
                  );
                })}
              {canDrag && (
                <g transform={`translate(${labelV.x},${labelV.y - 16})`} pointerEvents="none">
                  <path d="M -6 0 L 0 -7 L 6 0 Z" fill={itemStroke(i)} />
                </g>
              )}
              <text x={labelI.x} y={labelI.y} fontSize={15} textAnchor="middle" fill={itemStroke(i)} opacity={early} pointerEvents="none">
                {itemLabel(i)}
              </text>
            </g>
          );
        })}

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
                opacity={lateR * op(i)}
                style={{ cursor: canDrag ? 'ew-resize' : 'pointer' }}
                onPointerDown={canDrag ? (e) => startDrag(e, 'weight', L, i) : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  select(i);
                }}
              >
                <circle cx={cx} cy={wr.y0 - 2} r={4.5} fill="none" stroke={itemStroke(i)} strokeWidth={2.5} />
                <path d={d} fill={itemColor(i)} stroke={itemStroke(i)} strokeWidth={selected === i ? 3.5 : 1.5} strokeLinejoin="round" />
                <text x={cx} y={wr.y0 + h / 2 + 5} fontSize={Math.min(14, h * 0.62)} textAnchor="middle" fill="#1e293b" pointerEvents="none">
                  {itemLabel(i)}
                </text>
                {canDrag && (
                  <>
                    <path d={`M ${x0 - 3} ${(wr.y0 + wr.y1) / 2} l -6 -5 l 0 10 z`} fill={itemStroke(i)} />
                    <path d={`M ${x1 + 3} ${(wr.y0 + wr.y1) / 2} l 6 -5 l 0 10 z`} fill={itemStroke(i)} />
                  </>
                )}
              </g>
            );
          })}

        {/* 평균선보다 넘친 칸(주황) / 모자란 칸(파랑) → 추와 받침점 사이 거리 */}
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

        {leveling && <LevelingOverlay L={L} values={values} p={p} nonce={hint?.nonce ?? 0} />}
      </g>

      {sumStrips && <SumStripsOverlay L={L} values={values} p={p} nonce={hint?.nonce ?? 0} />}

      {/* 평균선 (막대 그림) */}
      {r2 < 1 && (
        <g opacity={1 - r2}>
          {hk === 'MEAN_LINK' && (
            <line x1={meanLine[0].x} y1={meanLine[0].y} x2={meanLine[1].x} y2={meanLine[1].y} stroke={MEAN.strong} strokeLinecap="round" className="glow-line" pointerEvents="none" />
          )}
          <line x1={meanLine[0].x} y1={meanLine[0].y} x2={meanLine[1].x} y2={meanLine[1].y} stroke={MEAN.stroke} strokeWidth={4} strokeLinecap="round" pointerEvents="none" />
          {atBar && (
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
            style={{ cursor: atBar ? 'ns-resize' : 'default' }}
            onPointerDown={atBar ? (e) => startDrag(e, 'line', L) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {hk === 'MEAN_LINK' && <circle r={27} fill={MEAN.strong} opacity={0.35} className="hint-pulse" />}
            <circle r={18} fill={MEAN.stroke} stroke="#fff" strokeWidth={3} />
            <text y={6} textAnchor="middle" fontSize={16} fill="#fff">
              {fmt(p)}
            </text>
            {atBar && (
              <>
                <path d="M -6 -23 L 0 -30 L 6 -23 Z" fill={MEAN.stroke} />
                <path d="M -6 23 L 0 30 L 6 23 Z" fill={MEAN.stroke} />
              </>
            )}
          </g>
        </g>
      )}

      {/* 받침점 (균형점 그림) */}
      {r2 > 0 && (
        <g opacity={r2}>
          <line x1={L.region.x + 14} x2={L.region.x + L.region.w - 14} y1={baseY} y2={baseY} stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" pointerEvents="none" />
          <g
            transform={`translate(${pivot.x},${pivot.y}) scale(${Math.max(0.01, r2)})`}
            style={{ cursor: atBalance ? 'ew-resize' : 'default' }}
            onPointerDown={atBalance ? (e) => startDrag(e, 'fulcrum', L) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {hk === 'MEAN_LINK' && <circle cy={24} r={34} fill={MEAN.strong} opacity={0.35} className="hint-pulse" />}
            <rect x={-34} y={0} width={68} height={42} fill="transparent" />
            <path d="M 0 0 L 25 42 L -25 42 Z" fill={MEAN.stroke} stroke="#14532d" strokeWidth={2} strokeLinejoin="round" />
          </g>
          <g
            transform={`translate(${pivot.x},${baseY + 22})`}
            style={{ cursor: atBalance ? 'ew-resize' : 'default' }}
            onPointerDown={atBalance ? (e) => startDrag(e, 'fulcrum', L) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <rect x={-24} y={-15} width={48} height={30} rx={15} fill={MEAN.fill} stroke={MEAN.stroke} strokeWidth={2} />
            <text y={6} textAnchor="middle" fontSize={16} fill="#14532d">
              {fmt(p)}
            </text>
            {atBalance && (
              <>
                <path d="M -38 0 L -30 -6 L -30 6 Z" fill={MEAN.stroke} />
                <path d="M 38 0 L 30 -6 L 30 6 Z" fill={MEAN.stroke} />
              </>
            )}
          </g>
        </g>
      )}
    </g>
  );
}

// 넘친 칸이 날아가 모자란 칸을 채우는 애니메이션 (막대 그림)
function LevelingOverlay({ L, values, p, nonce }: { L: Layout; values: number[]; p: number; nonce: number }) {
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
            fill={itemColor(c.i)}
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

// 왼쪽 거리들(파랑)과 오른쪽 거리들(주황)을 각각 한 줄로 이어 붙여 길이를 견주기 (균형점 그림)
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

// 함께 보기에서 두 그림의 같은 부분을 화살표로 잇기
function Connectors({ left, right, values, p, hint }: { left: Layout; right: Layout; values: number[]; p: number; hint: ActiveHint | null }) {
  if (!hint) return null;
  const n = values.length;
  const g = left.barGap;
  const f = left.barFrac;
  let A: Pt | null = null;
  let B: Pt | null = null;
  let marker = 'mean';
  let color = MEAN.stroke;
  if (hint.key === 'MEAN_LINK') {
    const h = P(frameAt(left, 0), p, n + 0.25);
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
