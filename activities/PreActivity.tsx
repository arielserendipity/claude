import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChartColumn, Play, Repeat, RotateCcw, Trash2 } from 'lucide-react';
import { MAX_ITEMS, ModelStage, ViewMode } from '../components/ModelStage';
import { SeesawIcon } from '../components/SeesawIcon';
import { DEFAULT_VALUES, meanOf } from '../lib/questions';
import { fmt } from '../lib/geometry';
import { AddLog, SolvedProblem } from '../types';
import { CellsIcon } from './Activity2';

// ---------------------------------------------------------------------------
// 사전 활동: 본 활동(탐구 1~4)에 들어가기 전에 두 그림에 익숙해지는 시간
// 1. 막대 그림이 시소 그림으로 바뀌는 모습 보기 (애니메이션)
// 2. 내 자료를 만들어 보기: 자료를 더하고 지우고 옮기며 자유롭게 조작
// - 정답·판정·글쓰기가 없고, 진행 조건도 없다(본 활동과 따로 기록된다).
// ---------------------------------------------------------------------------

interface PreActivityProps {
  addLog: AddLog;
  solvedProblems: SolvedProblem[]; // 활동 1에서 푼 문제 (내 자료로 불러오기)
}

type PreItem = 1 | 2;

const DEMO_VALUES = DEFAULT_VALUES;
const DEMO_P = meanOf(DEMO_VALUES); // 처음 자료의 평균: 시소가 평평해지는 자리
const START_P = 5;
// 사전 활동의 변환 애니메이션은 천천히 (막대 하나하나가 어디로 가는지 볼 수 있도록)
const MORPH_AUTO_MS = 9000;
const MORPH_PLAY_MS = 7000;

export function PreActivity({ addLog, solvedProblems }: PreActivityProps) {
  const [item, setItem] = useState<PreItem>(1);
  const [view, setView] = useState<ViewMode>('morph');
  const [morphT, setMorphT] = useState(0);
  const [showCells, setShowCells] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState<number[]>(() => [...DEFAULT_VALUES]);
  const [p2, setP2] = useState(START_P);

  const values = item === 1 ? DEMO_VALUES : custom;
  const p = item === 1 ? DEMO_P : p2;
  const mean = meanOf(values);
  const log = (action: string, details = '') => addLog(action, details, { activity: 'A2' });

  // ---------- 막대 → 시소 변환 애니메이션 ----------
  const morphRaf = useRef<number | null>(null);
  const morphTRef = useRef(0);
  morphTRef.current = morphT;
  const stopMorph = () => {
    if (morphRaf.current != null) cancelAnimationFrame(morphRaf.current);
    morphRaf.current = null;
  };
  const animateMorph = (to: number, durationMs = MORPH_PLAY_MS, delayMs = 0) => {
    stopMorph();
    const from = morphTRef.current;
    const start = performance.now() + delayMs;
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - start) / durationMs));
      setMorphT(from + (to - from) * k);
      if (k < 1) morphRaf.current = requestAnimationFrame(step);
      else morphRaf.current = null;
    };
    morphRaf.current = requestAnimationFrame(step);
  };
  useEffect(() => stopMorph, []);

  // 1번은 열자마자 한 번 보여 준다
  const autoPlay = () => {
    stopMorph();
    setMorphT(0);
    morphTRef.current = 0;
    animateMorph(1, MORPH_AUTO_MS, 700);
  };
  useEffect(() => {
    autoPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openItem = (n: PreItem) => {
    if (n === item) return;
    setItem(n);
    setSelected(null);
    setShowCells(false);
    if (n === 1) {
      setView('morph');
      autoPlay();
    } else {
      stopMorph();
      setView('side');
      setMorphT(0);
      morphTRef.current = 0;
    }
    log('PRE_OPEN', n === 1 ? '사전 활동 1. 막대 그림이 시소 그림으로 바뀌는 모습 보기' : '사전 활동 2. 내 자료를 만들어 보기');
  };

  const changeView = (v: ViewMode) => {
    if (v === view) return;
    setView(v);
    if (v === 'morph') {
      stopMorph();
      setMorphT(0);
      morphTRef.current = 0;
    }
    log('PRE_VIEW', v === 'side' ? '함께 보기' : '바꿔 보기');
  };
  const playMorph = () => {
    if (view !== 'morph') setView('morph');
    const to = morphT < 0.5 ? 1 : 0;
    animateMorph(to, MORPH_PLAY_MS);
    log('PRE_MORPH_PLAY', to === 1 ? '막대 그림 → 시소 그림' : '시소 그림 → 막대 그림');
  };
  const replay = () => {
    if (view !== 'morph') setView('morph');
    autoPlay();
    log('PRE_MORPH_REPLAY', '처음부터 다시 보기');
  };
  const toggleCells = () => {
    setShowCells((v) => !v);
    log('PRE_TOGGLE_CELLS', String(!showCells));
  };

  // ---------- 내 자료 (사전 활동 2) ----------
  const changeCustom = (next: number[], action: string) => {
    setCustom(next);
    setSelected(null);
    log('PRE_DATA_CHANGE', `${action}: [${next.join(', ')}] (평균 ${Number.isFinite(meanOf(next)) ? fmt(meanOf(next)) : '-'})`);
  };
  const addValue = (v: number) => {
    if (custom.length >= MAX_ITEMS) return;
    changeCustom([...custom, v], `추가 ${v}`);
  };
  const removeValue = (i: number) => changeCustom(custom.filter((_, k) => k !== i), `삭제 #${i + 1}`);
  const editValue = (i: number, v: number) => {
    setCustom((cs) => cs.map((x, k) => (k === i ? v : x)));
  };
  const importable = solvedProblems.filter((s) => s.values.length >= 2 && s.values.length <= MAX_ITEMS);

  const segBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-korean transition-all ${
      active ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
    }`;

  const card = (n: PreItem, title: string, body: React.ReactNode) => {
    const open = item === n;
    return (
      <div className={`rounded-2xl border-2 bg-white shadow-sm transition-all ${open ? 'border-sky-300' : 'border-slate-200'}`}>
        <button onClick={() => openItem(n)} className="w-full text-left px-4 pt-3 pb-3 flex items-start gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-korean text-base bg-sky-100 text-sky-700">{n}</span>
          <span className="flex-1 font-korean text-[17px] text-slate-800 pt-1">{title}</span>
        </button>
        {open && <div className="px-4 pb-4 font-korean text-slate-600 leading-relaxed space-y-3">{body}</div>}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 w-full max-w-[1500px] mx-auto p-3 md:p-4 flex flex-col lg:flex-row lg:items-start gap-4 overflow-y-auto">
      {/* ---------- 그림 ---------- */}
      <section className="sticky top-0 z-10 shrink-0 lg:flex-1 min-w-0 bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 pt-4">
          <div className="flex bg-slate-100 rounded-2xl p-1">
            <button className={segBtn(view === 'side')} onClick={() => changeView('side')}>
              <ArrowLeftRight size={16} /> 함께 보기
            </button>
            <button className={segBtn(view === 'morph')} onClick={() => changeView('morph')}>
              <Repeat size={16} /> 바꿔 보기
            </button>
          </div>

          <button
            onClick={toggleCells}
            aria-label="힌트 on/off"
            aria-pressed={showCells}
            className={`h-11 pl-2 pr-3 rounded-xl border-2 flex items-center gap-1.5 font-korean transition-all ${
              showCells ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <CellsIcon active={showCells} />
            <span>
              힌트{' '}
              <b className={showCells ? 'text-orange-700' : 'text-slate-300'}>on</b>
              <span className="text-slate-300">/</span>
              <b className={showCells ? 'text-slate-300' : 'text-slate-600'}>off</b>
            </span>
          </button>

          {item === 2 && (
            <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
              {importable.map((s) => (
                <button
                  key={`${s.level}-${s.solvedAt}`}
                  onClick={() => changeCustom(s.values, `활동 1 · ${s.level}단계 불러오기`)}
                  className="px-3 py-1.5 rounded-full text-sm font-korean border bg-white border-sky-200 text-sky-800 hover:bg-sky-50 flex items-center gap-1"
                >
                  <SeesawIcon size={14} /> 활동 1 · {s.level}
                </button>
              ))}
              <button
                onClick={() => {
                  changeCustom([...DEFAULT_VALUES], '처음 자료로');
                  setP2(START_P);
                }}
                aria-label="처음 자료로"
                title="처음 자료로"
                className="h-9 px-3 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-korean flex items-center gap-1 hover:bg-slate-50"
              >
                <RotateCcw size={14} /> 처음 자료
              </button>
              <button
                onClick={() => changeCustom([], '모두 지우기')}
                disabled={custom.length === 0}
                aria-label="모두 지우기"
                className="w-9 h-9 rounded-full border border-rose-200 bg-white text-rose-500 flex items-center justify-center hover:bg-rose-50 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* 그림 이름 */}
        <div className="relative h-7 mt-2 font-korean text-slate-500">
          {view === 'side' ? (
            <>
              <span className="absolute left-[25%] -translate-x-1/2 flex items-center gap-1.5">
                <ChartColumn size={18} /> 막대 그림
              </span>
              <span className="absolute left-[75%] -translate-x-1/2 flex items-center gap-1.5">
                <SeesawIcon size={18} /> 시소 그림
              </span>
            </>
          ) : (
            <>
              <span className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-opacity" style={{ opacity: Math.max(0, 1 - morphT * 2.5) }}>
                <ChartColumn size={18} /> 막대 그림
              </span>
              <span className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-opacity" style={{ opacity: Math.max(0, (morphT - 0.6) * 2.5) }}>
                <SeesawIcon size={18} /> 시소 그림
              </span>
            </>
          )}
        </div>

        <div className="relative w-full px-2 aspect-[1100/470]">
          <ModelStage
            values={values}
            p={p}
            onPChange={item === 2 ? setP2 : () => {}}
            onPDragEnd={(from, to) => log('PRE_DRAG_GREEN', `${from} -> ${to} (자료 평균 ${Number.isFinite(mean) ? fmt(mean) : '-'})`)}
            view={view}
            morphT={morphT}
            showCells={showCells}
            selected={selected}
            onSelect={setSelected}
            editable={item === 2}
            allowAddRemove={item === 2}
            onValueChange={item === 2 ? editValue : undefined}
            onValueDragEnd={(i, from, to) => log('PRE_EDIT_VALUE', `#${i + 1}: ${from} -> ${to}`)}
            onAddValue={item === 2 ? addValue : undefined}
            onRemoveValue={item === 2 ? removeValue : undefined}
            hint={null}
            lockP={item === 1}
          />
        </div>

        {view === 'morph' ? (
          <div className="flex items-center gap-3 px-6 pb-4 pt-1">
            <button
              onClick={playMorph}
              aria-label="재생"
              className="w-12 h-12 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 active:scale-95"
            >
              <Play size={22} fill="currentColor" className={morphT >= 0.5 ? 'rotate-180' : ''} />
            </button>
            <ChartColumn size={26} className="text-slate-500 shrink-0" />
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(morphT * 1000)}
              aria-label="막대 그림과 시소 그림 사이"
              onChange={(e) => {
                stopMorph();
                setMorphT(Number(e.target.value) / 1000);
              }}
              onPointerUp={() => log('PRE_MORPH_SLIDE', `t=${morphT.toFixed(2)}`)}
              className="flex-1 accent-indigo-600 h-3"
            />
            <SeesawIcon size={26} className="text-slate-500 shrink-0" />
          </div>
        ) : (
          <div className="h-3" />
        )}
      </section>

      {/* ---------- 사전 활동 ---------- */}
      <aside className="lg:w-[430px] shrink-0 flex flex-col gap-3 pb-4">
        {card(
          1,
          '막대 그림이 시소 그림으로 바뀌는 모습 보기',
          <>
            <p>막대 그림이 천천히 시소 그림으로 바뀌어요. 막대 하나하나가 시소 위에서 어디에 놓이는지 잘 보세요.</p>
            <ul className="text-[15px] text-slate-500 space-y-1 list-disc pl-5">
              <li>
                <Play size={14} className="inline -mt-0.5" fill="currentColor" /> 단추를 누르면 바뀌는 모습이 다시 나와요.
              </li>
              <li>아래 줄을 끌어서 내가 원하는 속도로 바꾸어 볼 수도 있어요.</li>
              <li>‘함께 보기’를 누르면 두 그림을 나란히 볼 수 있어요.</li>
            </ul>
            <button
              onClick={replay}
              className="h-11 px-4 rounded-xl bg-indigo-600 text-white flex items-center gap-2 hover:bg-indigo-700 active:scale-95 shadow"
            >
              <RotateCcw size={16} /> 처음부터 다시 보기
            </button>
          </>
        )}
        {card(
          2,
          '내 자료를 만들어 보기',
          <>
            <p>자료를 마음대로 더하고, 지우고, 옮겨 보세요. 막대 그림과 시소 그림이 어떻게 함께 달라지는지 살펴보세요.</p>
          </>
        )}
        <p className="px-2 text-sm text-slate-400 font-korean">사전 활동은 마음껏 해 봐도 돼요. 다 해 봤으면 위의 ‘본 활동’을 눌러 시작하세요.</p>
      </aside>
    </div>
  );
}
