import React from 'react';
import { CircleCheck, Star, UserRound } from 'lucide-react';
import { TASKS, TaskId } from '../lib/questions';
import { loadSession } from '../lib/storage';
import { BEAM, MEAN, itemColor, itemStroke } from '../lib/palette';
import { SolvedProblem } from '../types';

interface HomeProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  solvedProblems: SolvedProblem[];
  onOpen: (activity: 1 | 2) => void;
}

export function Home({ playerName, setPlayerName, solvedProblems, onOpen }: HomeProps) {
  const ready = playerName.trim().length > 0;
  // 활동 2는 판정 대신 탐구를 마쳤는지만 보여 준다
  const a2Done = ready ? (loadSession<{ done?: Partial<Record<TaskId, boolean>> }>(`avg_a2_${playerName.trim()}`, {}).done ?? {}) : {};
  const bestLevel = solvedProblems.reduce((m, s) => Math.max(m, s.level), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl animate-float">👋</div>
          <label className="flex items-center gap-3 bg-white rounded-full shadow-md border-2 border-slate-200 focus-within:border-indigo-400 px-5 py-3">
            <UserRound size={24} className="text-indigo-500" />
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
              placeholder="이름"
              className="outline-none text-xl font-korean text-slate-800 w-48 bg-transparent"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
          <ActivityCard n={1} disabled={!ready} onClick={() => onOpen(1)} illustration={<ScaleArt />}>
            {bestLevel > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-korean">
                <Star size={18} className="fill-amber-400 text-amber-500" /> {bestLevel}
              </span>
            )}
          </ActivityCard>
          <ActivityCard n={2} disabled={!ready} onClick={() => onOpen(2)} illustration={<BarToScaleArt />}>
            <span className="flex items-center gap-1">
              {TASKS.map((t) =>
                a2Done[t.id] ? (
                  <CircleCheck key={t.id} size={18} className="text-emerald-500" />
                ) : (
                  <span key={t.id} className="w-4 h-4 rounded-full border-2 border-slate-300" />
                )
              )}
            </span>
          </ActivityCard>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({
  n,
  disabled,
  onClick,
  illustration,
  children,
}: {
  n: number;
  disabled: boolean;
  onClick: () => void;
  illustration: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group bg-white rounded-[2rem] border-2 border-slate-200 shadow-lg p-6 flex flex-col items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-xl hover:border-indigo-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
    >
      <div className="w-full aspect-[16/9] rounded-2xl bg-sky-50 flex items-center justify-center overflow-hidden">{illustration}</div>
      <div className="font-korean text-3xl text-slate-800">활동 {n}</div>
      <div className="h-6">{children}</div>
    </button>
  );
}

const ART_VALUES = [2, 4, 9];

function ScaleArt() {
  return (
    <svg viewBox="0 0 200 110" className="w-full h-full">
      <rect x="20" y="62" width="160" height="10" rx="5" fill={BEAM.fill} stroke={BEAM.stroke} strokeWidth="2" />
      {ART_VALUES.map((v, i) => (
        <g key={i}>
          <circle cx={20 + v * 16} cy={45} r="3" fill="none" stroke={itemStroke(i)} strokeWidth="2" />
          <rect x={20 + v * 16 - 8} y={48} width="16" height="14" rx="3" fill={itemColor(i)} stroke={itemStroke(i)} strokeWidth="1.5" />
        </g>
      ))}
      <path d="M 100 72 L 114 96 L 86 96 Z" fill={MEAN.stroke} />
      <line x1="10" x2="190" y1="96" y2="96" stroke="#cbd5e1" strokeWidth="2" />
    </svg>
  );
}

function BarToScaleArt() {
  return (
    <svg viewBox="0 0 200 110" className="w-full h-full">
      {ART_VALUES.map((v, i) => (
        <rect key={i} x={14 + i * 20} y={92 - v * 8} width="14" height={v * 8} rx="2" fill={itemColor(i)} stroke={itemStroke(i)} strokeWidth="1.5" />
      ))}
      <line x1="8" x2="76" y1={92 - 5 * 8} y2={92 - 5 * 8} stroke={MEAN.stroke} strokeWidth="3" />
      <path d="M 88 56 C 98 46, 106 46, 114 56" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
      <path d="M 110 50 L 115 57 L 107 58" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="120" y="66" width="74" height="7" rx="3.5" fill={BEAM.fill} stroke={BEAM.stroke} strokeWidth="1.5" />
      {ART_VALUES.map((v, i) => (
        <rect key={i} x={122 + v * 7 - 5} y={56} width="10" height="10" rx="2" fill={itemColor(i)} stroke={itemStroke(i)} strokeWidth="1.2" />
      ))}
      <path d="M 157 73 L 166 88 L 148 88 Z" fill={MEAN.stroke} />
    </svg>
  );
}
