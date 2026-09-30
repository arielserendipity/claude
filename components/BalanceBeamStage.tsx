import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { AppState, Block } from '../types';
import { fmt, groundLimitDegrees, innerIntegers, tiltDegrees } from '../lib/geometry';
import { BEAM, DEFICIT, EXCESS, MEAN } from '../lib/palette';

interface BalanceBeamStageProps {
  blocks: Block[];
  fulcrumPosition: number;
  setFulcrumPosition: (pos: number) => void;
  onFulcrumDragStart?: (startPos: number) => void;
  onFulcrumDragEnd?: (startPos: number, finalPos: number) => void;
  appState: AppState;
  average: number;
  hintLevel: 0 | 1 | 2; // 1: 추-받침점 거리 곡선, 2: + 왼쪽/오른쪽 거리의 합 막대
  hintVisible: boolean;
  showDragCue: boolean;
}

const VB_W = 1000;
const VB_H = 470;
const MAX_U = 10;
const U = 84;
const BX = (VB_W - MAX_U * U) / 2;
const BEAM_Y = 300;
const BH = 12;
const APEX_Y = BEAM_Y + BH;
const GROUND_Y = APEX_Y + 54;
const WW = 46;

const xOf = (u: number) => BX + u * U;

export const BalanceBeamStage: React.FC<BalanceBeamStageProps> = ({
  blocks,
  fulcrumPosition,
  setFulcrumPosition,
  onFulcrumDragStart,
  onFulcrumDragEnd,
  appState,
  average,
  hintLevel,
  hintVisible,
  showDragCue,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragFromRef = useRef(0);
  const dragLastRef = useRef(0);

  const canDrag = appState === 'PLAYING';
  const locked = appState === 'LOBBY' || appState === 'PLAYING';
  // 저울대 끝이 바닥에 닿을 때까지만 기운다
  const arm = Math.max(xOf(fulcrumPosition) - (BX - 18), BX + MAX_U * U + 18 - xOf(fulcrumPosition));
  const tiltTarget =
    appState === 'EVALUATING' || appState === 'GAME_OVER'
      ? tiltDegrees(average, fulcrumPosition, groundLimitDegrees(arm, GROUND_Y - APEX_Y - 2))
      : 0;

  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);
  useEffect(() => {
    const controls = animate(angleRef.current, tiltTarget, {
      type: 'spring',
      stiffness: 55,
      damping: 7,
      onUpdate: (v) => {
        angleRef.current = v;
        setAngle(v);
      },
    });
    return () => controls.stop();
  }, [tiltTarget]);

  const { stacks, wH } = useMemo(() => {
    const counts = new Map<number, number>();
    const stacks = blocks.map((b) => {
      const k = counts.get(b.position) ?? 0;
      counts.set(b.position, k + 1);
      return k;
    });
    const maxStack = Math.max(1, ...Array.from(counts.values()));
    return { stacks, wH: Math.min(26, 190 / maxStack) };
  }, [blocks]);

  const xp = xOf(fulcrumPosition);

  const toU = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const r = pt.matrixTransform(ctm.inverse());
    return (r.x - BX) / U;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canDrag) return;
    e.preventDefault();
    dragFromRef.current = fulcrumPosition;
    dragLastRef.current = fulcrumPosition;
    onFulcrumDragStart?.(fulcrumPosition);
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const u = toU(e.clientX, e.clientY);
      if (u == null) return;
      const snapped = Math.round(Math.max(0, Math.min(MAX_U, u)) * 2) / 2;
      if (snapped !== dragLastRef.current) {
        dragLastRef.current = snapped;
        setFulcrumPosition(snapped);
      }
    };
    const up = () => {
      onFulcrumDragEnd?.(dragFromRef.current, dragLastRef.current);
      setDragging(false);
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
  }, [dragging]);

  const weightTop = (i: number) => APEX_Y - 2 * BH - (stacks[i] + 1) * wH;

  // 거리 곡선: 가까운 추부터 낮게, 먼 추일수록 높게
  const curves = blocks
    .map((b, i) => ({ b, i, d: Math.abs(b.position - fulcrumPosition) }))
    .filter((c) => c.d > 1e-9)
    .sort((a, b) => a.d - b.d);

  const leftTotal = blocks.filter((b) => b.position < fulcrumPosition).reduce((a, b) => a + (fulcrumPosition - b.position), 0);
  const rightTotal = blocks.filter((b) => b.position > fulcrumPosition).reduce((a, b) => a + (b.position - fulcrumPosition), 0);
  const stripUnit = U * Math.min(1, MAX_U / Math.max(leftTotal, rightTotal, 1));

  const showCurves = hintVisible && hintLevel >= 1 && appState !== 'LEVEL_CLEAR' && appState !== 'LOBBY';
  const showStrips = hintVisible && hintLevel >= 2 && appState !== 'LEVEL_CLEAR' && appState !== 'LOBBY';

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full select-none"
      style={{ touchAction: 'none', fontFamily: "'Jua', sans-serif" }}
    >
      <defs>
        <linearGradient id="a1-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
        <pattern id="a1-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill={EXCESS.fill} />
          <line x1="0" y1="0" x2="0" y2="8" stroke={EXCESS.strong} strokeWidth="3" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#a1-sky)" />
      <rect x={0} y={GROUND_Y} width={VB_W} height={VB_H - GROUND_Y} fill="#ecfccb" />
      <line x1={0} x2={VB_W} y1={GROUND_Y} y2={GROUND_Y} stroke="#bef264" strokeWidth={3} />

      {/* 왼쪽/오른쪽 거리의 합 (힌트 2단계) */}
      {showStrips && (
        <g pointerEvents="none">
          {[
            { total: leftTotal, y: 26, col: DEFICIT, fill: DEFICIT.fill, dir: -1 },
            { total: rightTotal, y: 56, col: EXCESS, fill: 'url(#a1-hatch)', dir: 1 },
          ].map((row, k) => (
            <g key={k}>
              <path
                d={row.dir < 0 ? `M ${BX - 12} ${row.y + 9} l 9 -8 l 0 16 z` : `M ${BX - 3} ${row.y + 9} l -9 -8 l 0 16 z`}
                fill={row.col.stroke}
              />
              <rect
                x={BX}
                y={row.y}
                width={Math.max(0, row.total * stripUnit)}
                height={18}
                rx={3}
                fill={row.fill}
                stroke={row.col.stroke}
                strokeWidth={2}
                style={{ transition: 'width 0.25s ease-out' }}
              />
              {innerIntegers(0, row.total).map((u) => (
                <line key={u} x1={BX + u * stripUnit} x2={BX + u * stripUnit} y1={row.y} y2={row.y + 18} stroke={row.col.stroke} strokeWidth={1.5} />
              ))}
              <text x={BX + row.total * stripUnit + 12} y={row.y + 16} fontSize={20} fill={row.col.stroke}>
                {fmt(row.total)}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* 저울을 붙잡고 있는 받침대 (확인 전에는 수평으로 고정) */}
      <motion.g
        initial={false}
        animate={locked ? { y: 0, opacity: 1 } : { y: 70, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeIn' }}
        pointerEvents="none"
      >
        {[0.35, MAX_U - 0.35].map((u) => (
          <g key={u}>
            <rect x={xOf(u) - 9} y={APEX_Y} width={18} height={GROUND_Y - APEX_Y} rx={4} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={2} />
          </g>
        ))}
      </motion.g>

      {/* 저울대 + 추 (받침점 꼭짓점을 중심으로 기울어짐) */}
      <g transform={`rotate(${angle.toFixed(3)} ${xp} ${APEX_Y})`}>
        <rect x={BX - 18} y={BEAM_Y - BH} width={MAX_U * U + 36} height={BH * 2} rx={BH} fill={BEAM.fill} stroke={BEAM.stroke} strokeWidth={2.5} />
        {Array.from({ length: MAX_U + 1 }, (_, u) => (
          <g key={u} pointerEvents="none">
            <line x1={xOf(u)} x2={xOf(u)} y1={BEAM_Y + BH - 5} y2={BEAM_Y + BH} stroke={BEAM.stroke} strokeWidth={2} />
            <text x={xOf(u)} y={BEAM_Y + 5} fontSize={15} textAnchor="middle" fill={BEAM.text}>
              {u}
            </text>
          </g>
        ))}

        {blocks.map((b, i) => {
          const x0 = xOf(b.position) - WW / 2;
          const x1 = xOf(b.position) + WW / 2;
          const y0 = weightTop(i);
          const y1 = y0 + wH;
          const inset = WW * 0.12;
          const d = `M ${x0 + inset} ${y0 + 1} L ${x1 - inset} ${y0 + 1} L ${x1} ${y1 - 3} Q ${x1} ${y1} ${x1 - 3} ${y1} L ${x0 + 3} ${y1} Q ${x0} ${y1} ${x0} ${y1 - 3} Z`;
          return (
            <g key={b.id} pointerEvents="none">
              <circle cx={xOf(b.position)} cy={y0 - 2} r={4.5} fill="none" stroke="#475569" strokeWidth={2.5} />
              {b.isNew && <path d={d} fill="none" stroke="#facc15" strokeWidth={7} className="hint-pulse" />}
              <path d={d} fill={b.color} stroke="#334155" strokeWidth={1.5} strokeLinejoin="round" />
            </g>
          );
        })}

        {/* 추와 받침점 사이 거리 곡선 (힌트 1단계) */}
        {showCurves &&
          curves.map((c, order) => {
            const sx = xOf(c.b.position);
            const sy = weightTop(c.i) - 6;
            const ex = xp;
            const ey = BEAM_Y - BH;
            const cx = (sx + ex) / 2;
            const cy = Math.min(sy, ey) - 50 - order * 22;
            const midX = 0.25 * sx + 0.5 * cx + 0.25 * ex;
            const midY = 0.25 * sy + 0.5 * cy + 0.25 * ey;
            const col = c.b.position < fulcrumPosition ? DEFICIT : EXCESS;
            return (
              <g key={`curve-${c.b.id}`} pointerEvents="none">
                <path d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`} fill="none" stroke={col.stroke} strokeWidth={3} strokeDasharray="7 6" />
                <circle cx={sx} cy={sy} r={4.5} fill={col.stroke} />
                <circle cx={midX} cy={midY} r={13} fill="#fff" stroke={col.stroke} strokeWidth={2.5} />
                <text x={midX} y={midY + 5} fontSize={14} textAnchor="middle" fill={col.stroke}>
                  {fmt(c.d)}
                </text>
              </g>
            );
          })}
      </g>

      {/* 균형을 찾았을 때: 받침점 위로 별 */}
      {appState === 'LEVEL_CLEAR' && (
        <g pointerEvents="none">
          <line x1={xp} x2={xp} y1={60} y2={BEAM_Y - BH - 4} stroke="#facc15" strokeWidth={4} strokeDasharray="2 8" strokeLinecap="round" />
          <g transform={`translate(${xp},52)`}>
            <g className="pop">
              <path
                d="M 0 -30 L 8.8 -12.1 L 28.5 -9.3 L 14.3 4.6 L 17.6 24.3 L 0 15 L -17.6 24.3 L -14.3 4.6 L -28.5 -9.3 L -8.8 -12.1 Z"
                fill="#facc15"
                stroke="#ca8a04"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </g>
          </g>
        </g>
      )}

      {/* 받침점 */}
      <g style={{ cursor: canDrag ? 'ew-resize' : 'default' }} onPointerDown={handlePointerDown}>
        <rect x={xp - 44} y={APEX_Y - 4} width={88} height={GROUND_Y - APEX_Y + 60} fill="transparent" />
        <path
          d={`M ${xp} ${APEX_Y} L ${xp + 30} ${GROUND_Y} L ${xp - 30} ${GROUND_Y} Z`}
          fill={MEAN.stroke}
          stroke="#14532d"
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{ transition: dragging ? 'none' : 'd 0.15s' }}
        />
        <g transform={`translate(${xp},${GROUND_Y + 28})`}>
          <rect x={-28} y={-17} width={56} height={34} rx={17} fill={MEAN.fill} stroke={MEAN.stroke} strokeWidth={2.5} />
          <text y={7} fontSize={19} textAnchor="middle" fill="#14532d">
            {fmt(fulcrumPosition)}
          </text>
          {canDrag && (
            <>
              <path d="M -43 0 L -35 -7 L -35 7 Z" fill={MEAN.stroke} />
              <path d="M 43 0 L 35 -7 L 35 7 Z" fill={MEAN.stroke} />
            </>
          )}
        </g>
      </g>

      {/* 처음 한 번: 받침점을 끌어 보라는 손 모양 */}
      {showDragCue && canDrag && (
        <g transform={`translate(${xp},${GROUND_Y + 78})`} pointerEvents="none">
          <g className="nudge-x">
            <text fontSize={34} textAnchor="middle">
              👆
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};
