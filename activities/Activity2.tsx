import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeftRight,
  ChartColumn,
  Circle,
  CircleCheck,
  Lightbulb,
  Lock,
  Play,
  Repeat,
  RotateCcw,
  Scale,
  Search,
  Send,
  Sparkles,
  Star,
  StarHalf,
  Trash2,
  X,
} from 'lucide-react';
import { ActiveHint, MAX_ITEMS, ModelStage, ViewMode } from '../components/ModelStage';
import {
  DEFAULT_VALUES,
  EvalResult,
  QUESTIONS,
  Question,
  QuestionId,
  Verdict,
  hintsForMissing,
  ruleEvaluate,
} from '../lib/questions';
import type { HintRef } from '../lib/hints';
import { AddLog, SolvedProblem, TeacherNote } from '../types';
import { loadStored, saveStored } from '../lib/storage';
import { DEFICIT, EXCESS, MEAN } from '../lib/palette';
import { fmt } from '../lib/geometry';

type AnswerStatus = 'idle' | 'loading' | Verdict;

interface AnswerState {
  text: string;
  status: AnswerStatus;
  hints: HintRef[];
  attempts: number;
  retries: number; // 🔍(핵심 내용이 하나도 없는 답) 받은 횟수 — 2회부터 시각 힌트
  cleared: boolean; // 반쪽 별 이상을 한 번이라도 받음 → 다음 문항이 열림
  found: string[]; // 마지막 답에서 확인된 '꼭 쓸 것' (체크 표시)
}

type Answers = Record<QuestionId, AnswerState>;
type DataMode = 'default' | 'custom';

const HINT_STEP_MS = 7000;
const HINT_AFTER_RETRIES = 2;

const emptyAnswer = (): AnswerState => ({
  text: '',
  status: 'idle',
  hints: [],
  attempts: 0,
  retries: 0,
  cleared: false,
  found: [],
});

function loadAnswers(key: string): Answers {
  const stored = loadStored<Partial<Record<QuestionId, Partial<AnswerState>>>>(key, {});
  return Object.fromEntries(
    QUESTIONS.map((q) => {
      const a = { ...emptyAnswer(), ...(stored[q.id] ?? {}) };
      // 예전 저장본에는 cleared가 없으므로 판정으로 채운다
      if (stored[q.id]?.cleared == null) a.cleared = a.status === 'PASS' || a.status === 'PARTIAL';
      if (a.status === 'loading') a.status = 'idle';
      return [q.id, a];
    })
  ) as Answers;
}

const meanOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

interface Activity2Props {
  playerName: string;
  teacherMode: boolean;
  addLog: AddLog;
  onTeacherNote: (note: Omit<TeacherNote, 'id' | 'timestamp' | 'playerName'>) => void;
  solvedProblems: SolvedProblem[];
}

export function Activity2({ playerName, teacherMode, addLog, onTeacherNote, solvedProblems }: Activity2Props) {
  const storeKey = `avg_a2_${playerName}`;
  const customKey = `avg_a2_custom_${playerName}`;
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(storeKey));
  useEffect(() => saveStored(storeKey, answers), [answers, storeKey]);

  const [dataMode, setDataMode] = useState<DataMode>('default');
  const [customValues, setCustomValues] = useState<number[]>(() => loadStored<number[]>(customKey, []));
  useEffect(() => saveStored(customKey, customValues), [customValues, customKey]);
  const values = dataMode === 'custom' ? customValues : DEFAULT_VALUES;

  const [view, setView] = useState<ViewMode>('side');
  const [morphT, setMorphT] = useState(0);
  const [showCells, setShowCells] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hintQueue, setHintQueue] = useState<ActiveHint[]>([]);
  const [usedMorph, setUsedMorph] = useState(false);
  const [openId, setOpenId] = useState<QuestionId>(() => {
    const firstOpen = QUESTIONS.find((q) => !answers[q.id].cleared);
    return firstOpen?.id ?? 'q1';
  });
  // 평균선·받침점 위치. 문항마다 처음 위치가 다를 수 있다 (1번은 직접 수평을 찾도록 3에서 시작)
  const startOf = (id: QuestionId) => QUESTIONS.find((q) => q.id === id)?.startP ?? 5;
  const [p, setP] = useState(() => startOf(openId));

  const mean = useMemo(() => meanOf(values), [values]);
  const activeHint = hintQueue[0] ?? null;

  // 반쪽 별 이상을 받아야 다음 문항이 열린다 (교사 코드로 들어오면 모두 열림)
  const isUnlocked = (idx: number) => teacherMode || idx === 0 || answers[QUESTIONS[idx - 1].id].cleared;
  const q4Index = QUESTIONS.findIndex((q) => q.usesCustomData);
  const exploring = openId === QUESTIONS[q4Index].id && isUnlocked(q4Index);

  // ---------- 변신(morph) 애니메이션 ----------
  const morphRaf = useRef<number | null>(null);
  const morphTRef = useRef(0);
  morphTRef.current = morphT;
  const stopMorph = () => {
    if (morphRaf.current != null) cancelAnimationFrame(morphRaf.current);
    morphRaf.current = null;
  };
  const animateMorph = (to: number, durationMs = 3200, delayMs = 0) => {
    stopMorph();
    const from = morphTRef.current;
    const start = performance.now() + delayMs;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / durationMs));
      setMorphT(from + (to - from) * k);
      if (k < 1) morphRaf.current = requestAnimationFrame(step);
      else morphRaf.current = null;
    };
    morphRaf.current = requestAnimationFrame(step);
  };
  useEffect(() => stopMorph, []);

  // ---------- 시각 힌트 재생 ----------
  const hintNonce = useRef(1);
  const playHints = (hints: HintRef[], q: Question) => {
    if (hints.length === 0) return;
    // 1~3번 문항 힌트는 처음 자료, 평균 위치에서 보여준다
    if (!q.usesCustomData) {
      setDataMode('default');
      setP(5);
    } else if (Number.isFinite(mean)) {
      setP(mean);
    }
    setSelected(null);
    setHintQueue(hints.map((h) => ({ ...h, nonce: hintNonce.current++ })));
    addLog('VISUAL_HINT', hints.map((h) => `${h.key}${h.target != null ? `(${h.target})` : ''}`).join(', '), {
      activity: 'A2',
      questionId: q.id,
      hint: hints.map((h) => h.key).join(', '),
    });
  };

  useEffect(() => {
    if (!activeHint) return;
    if (activeHint.key === 'CELLS_TO_DISTANCE') {
      setView('morph');
      stopMorph();
      setMorphT(0);
      morphTRef.current = 0;
      animateMorph(1, 4200, 600);
    } else {
      stopMorph();
      setView('side');
    }
    if (hintQueue.length > 1) {
      const timer = setTimeout(() => setHintQueue((qs) => qs.slice(1)), HINT_STEP_MS);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHint?.nonce]);

  const clearHints = () => setHintQueue([]);

  // ---------- 조작 ----------
  const changeView = (v: ViewMode) => {
    setView(v);
    if (v === 'morph') setUsedMorph(true);
    clearHints();
    addLog('VIEW_CHANGE', v === 'side' ? '함께 보기' : '바꿔 보기', { activity: 'A2' });
  };

  const onMorphSlider = (t: number) => {
    stopMorph();
    setMorphT(t);
  };

  const playMorph = () => {
    const to = morphT < 0.5 ? 1 : 0;
    animateMorph(to, 3200);
    addLog('MORPH_PLAY', to === 1 ? '막대 그림 → 균형점 그림' : '균형점 그림 → 막대 그림', { activity: 'A2' });
  };

  // 그림을 깨끗한 처음 상태로 (힌트·칸 보기 끄기, 함께 보기, 평균선은 문항의 처음 위치)
  const cleanStage = (id: QuestionId = openId) => {
    stopMorph();
    setView('side');
    setMorphT(0);
    setP(startOf(id));
    setSelected(null);
    setShowCells(false);
    clearHints();
  };

  const resetStage = () => {
    cleanStage();
    addLog('RESET_STAGE', '', { activity: 'A2' });
  };

  // 문항이 바뀔 때마다 힌트 없이 깨끗한 그림에서 시작한다
  const openQuestion = (id: QuestionId) => {
    if (id === openId) return;
    setOpenId(id);
    cleanStage(id);
    if (!QUESTIONS.find((q) => q.id === id)?.usesCustomData) setDataMode('default');
  };

  // ---------- 4번: 처음 자료 / 새로운 자료 ----------
  const chooseData = (mode: DataMode) => {
    if (mode === dataMode) return;
    setDataMode(mode);
    setSelected(null);
    clearHints();
    const next = mode === 'custom' ? customValues : DEFAULT_VALUES;
    addLog('DATA_MODE', `${mode === 'custom' ? '새로운 자료' : '처음 자료'}: [${next.join(', ')}]`, { activity: 'A2' });
  };

  const changeCustom = (next: number[], action: string) => {
    setCustomValues(next);
    setSelected(null);
    clearHints();
    addLog('DATA_CHANGE', `${action}: [${next.join(', ')}] (평균 ${Number.isFinite(meanOf(next)) ? fmt(meanOf(next)) : '-'})`, {
      activity: 'A2',
    });
  };

  const addValue = (v: number) => {
    if (customValues.length >= MAX_ITEMS) return;
    changeCustom([...customValues, v], `추가 ${v}`);
  };
  const removeValue = (i: number) => changeCustom(customValues.filter((_, k) => k !== i), `삭제 #${i + 1}`);
  const editValue = (i: number, v: number) => {
    setCustomValues((prev) => prev.map((x, k) => (k === i ? v : x)));
    clearHints();
  };

  // ---------- 서술형 제출 ----------
  const setAnswer = (id: QuestionId, patch: Partial<AnswerState>) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const submit = async (q: Question) => {
    const prev = answers[q.id];
    const text = prev.text.trim();
    if (!text || prev.status === 'loading') return;
    const attempt = prev.attempts + 1;
    setAnswer(q.id, { status: 'loading' });
    const ctxValues = q.usesCustomData ? values : DEFAULT_VALUES;
    const ctxP = q.usesCustomData ? p : 5;

    let result: EvalResult;
    try {
      const res = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, questionId: q.id, answer: text, values: ctxValues, p: ctxP, attempt }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      result = (await res.json()) as EvalResult;
    } catch (err) {
      console.warn('evaluate-answer failed, using local rubric:', err);
      result = ruleEvaluate(q, text);
      result.teacherLog = `[서버 연결 실패 → 기기 내 규칙 채점] ${result.teacherLog}`;
    }

    const retries = prev.retries + (result.verdict === 'RETRY' ? 1 : 0);
    const cleared = prev.cleared || result.verdict !== 'RETRY';
    const hintsOpen = retries >= HINT_AFTER_RETRIES;
    setAnswer(q.id, { status: result.verdict, hints: result.hints, attempts: attempt, retries, cleared, found: result.foundIdeaIds });

    addLog('SUBMIT_ANSWER', `found: [${result.foundIdeaIds.join(', ')}] missing: [${result.missingIdeaIds.join(', ')}] (${result.source})`, {
      activity: 'A2',
      questionId: q.id,
      answer: text,
      verdict: result.verdict,
      teacherLog: result.teacherLog,
      hint: hintsOpen ? result.hints.map((h) => h.key).join(', ') : '',
    });
    onTeacherNote({
      activity: 'A2',
      title: `활동 2 · 문항 ${q.label} (${attempt}번째 제출, 🔍 ${retries}회)${q.usesCustomData ? ` · 자료 [${ctxValues.join(', ')}]` : ''}`,
      body: `${result.teacherLog}${result.misconception ? `\n[오개념 가능성] ${result.misconception}` : ''}`,
      verdict: result.verdict,
      answer: text,
    });

    if (result.verdict === 'PASS') {
      confetti({ particleCount: 70, spread: 60, origin: { x: 0.8, y: 0.4 } });
      // 다 맞히면 다음 문항을 연다 (힌트 없이 깨끗한 그림으로)
      const idx = QUESTIONS.findIndex((x) => x.id === q.id);
      const next = QUESTIONS[idx + 1];
      if (next && answers[next.id].attempts === 0) openQuestion(next.id);
    } else if (hintsOpen) {
      // 🔍를 두 번 이상 받은 뒤부터만 시각 힌트를 보여 준다
      playHints(result.hints, q);
    }
  };

  const importable = solvedProblems.filter((s) => s.values.length >= 2 && s.values.length <= MAX_ITEMS);

  const segBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-korean transition-all ${
      active ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="flex-1 min-h-0 w-full max-w-[1500px] mx-auto p-3 md:p-4 flex flex-col lg:flex-row lg:items-start gap-4 overflow-y-auto">
      {/* ---------- 그림 (문항을 내려 읽어도 힌트가 보이도록 위에 고정) ---------- */}
      <section className="sticky top-0 z-10 shrink-0 lg:flex-1 min-w-0 bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 pt-4">
          <div className="flex bg-slate-100 rounded-2xl p-1">
            <button className={segBtn(view === 'side')} onClick={() => changeView('side')}>
              <ArrowLeftRight size={16} /> 함께 보기
            </button>
            <button
              className={`${segBtn(view === 'morph')} ${!usedMorph && view !== 'morph' ? 'attention' : ''}`}
              onClick={() => changeView('morph')}
            >
              <Repeat size={16} /> 바꿔 보기
            </button>
          </div>

          <button
            onClick={() => {
              setShowCells((v) => !v);
              addLog('TOGGLE_CELLS', String(!showCells), { activity: 'A2' });
            }}
            aria-label="칸"
            className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all ${
              showCells ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CellsIcon active={showCells} />
          </button>

          <button
            onClick={resetStage}
            aria-label="처음 상태로"
            className="w-11 h-11 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500"
          >
            <RotateCcw size={20} />
          </button>

          {/* 4번 문항: 처음 자료 / 새로운 자료 */}
          {exploring && (
            <div className="flex bg-violet-50 border border-violet-200 rounded-2xl p-1 ml-auto">
              <button className={segBtn(dataMode === 'default')} onClick={() => chooseData('default')}>
                <ChartColumn size={16} /> 처음 자료
              </button>
              <button
                className={`${segBtn(dataMode === 'custom')} ${dataMode !== 'custom' && customValues.length === 0 ? 'attention' : ''}`}
                onClick={() => chooseData('custom')}
              >
                <Sparkles size={16} /> 새로운 자료
              </button>
            </div>
          )}
        </div>

        {/* 새로운 자료: 활동 1 문제 불러오기 / 모두 지우기 */}
        {exploring && dataMode === 'custom' && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end px-4 pt-2">
            {importable.map((s) => (
              <button
                key={`${s.level}-${s.solvedAt}`}
                onClick={() => changeCustom(s.values, `활동 1 · ${s.level}단계 불러오기`)}
                className="px-3 py-1.5 rounded-full text-sm font-korean border bg-white border-sky-200 text-sky-800 hover:bg-sky-50 flex items-center gap-1"
              >
                <Scale size={14} /> 활동 1 · {s.level}
              </button>
            ))}
            <button
              onClick={() => changeCustom([], '모두 지우기')}
              disabled={customValues.length === 0}
              aria-label="모두 지우기"
              className="w-9 h-9 rounded-full border border-rose-200 bg-white text-rose-500 flex items-center justify-center hover:bg-rose-50 disabled:opacity-30"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* 그림 이름 */}
        <div className="relative h-7 mt-2 font-korean text-slate-500">
          {view === 'side' ? (
            <>
              <span className="absolute left-[25%] -translate-x-1/2 flex items-center gap-1.5">
                <ChartColumn size={18} /> 막대 그림
              </span>
              <span className="absolute left-[75%] -translate-x-1/2 flex items-center gap-1.5">
                <Scale size={18} /> 균형점 그림
              </span>
            </>
          ) : (
            <>
              <span className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-opacity" style={{ opacity: Math.max(0, 1 - morphT * 2.5) }}>
                <ChartColumn size={18} /> 막대 그림
              </span>
              <span className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-opacity" style={{ opacity: Math.max(0, (morphT - 0.6) * 2.5) }}>
                <Scale size={18} /> 균형점 그림
              </span>
            </>
          )}
        </div>

        <div className="relative w-full px-2 aspect-[1100/470]">
          <ModelStage
            values={values}
            p={p}
            onPChange={(np) => {
              setP(np);
            }}
            onPDragEnd={(from, to) =>
              addLog('DRAG_MEAN', `${from} -> ${to} (자료 평균 ${Number.isFinite(mean) ? fmt(mean) : '-'})`, { activity: 'A2' })
            }
            view={view}
            morphT={morphT}
            showCells={showCells}
            selected={selected}
            onSelect={setSelected}
            editable={exploring && dataMode === 'custom'}
            onValueChange={editValue}
            onValueDragEnd={(i, from, to) =>
              addLog('EDIT_VALUE', `#${i + 1}: ${from} -> ${to} [${customValues.join(', ')}]`, { activity: 'A2' })
            }
            onAddValue={addValue}
            onRemoveValue={removeValue}
            hint={activeHint}
          />

          {activeHint && (
            <div className="absolute top-2 right-3 flex items-center gap-1 bg-amber-100 border-2 border-amber-300 rounded-full pl-2 pr-1 py-1 shadow">
              <Lightbulb size={20} className="text-amber-500 fill-amber-300 hint-pulse" />
              {hintQueue.length > 1 && (
                <span className="flex gap-0.5 px-1">
                  {hintQueue.map((h, k) => (
                    <span key={h.nonce} className={`w-1.5 h-1.5 rounded-full ${k === 0 ? 'bg-amber-500' : 'bg-amber-300'}`} />
                  ))}
                </span>
              )}
              <button onClick={clearHints} aria-label="닫기" className="w-7 h-7 rounded-full hover:bg-amber-200 flex items-center justify-center text-amber-700">
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {view === 'morph' && (
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
              onChange={(e) => onMorphSlider(Number(e.target.value) / 1000)}
              onPointerUp={() => addLog('MORPH_SLIDE', `t=${morphT.toFixed(2)}`, { activity: 'A2' })}
              className="flex-1 accent-indigo-600 h-3"
            />
            <Scale size={26} className="text-slate-500 shrink-0" />
          </div>
        )}
        {view === 'side' && <div className="h-3" />}
      </section>

      {/* ---------- 서술형 문항 ---------- */}
      <aside className="lg:w-[400px] shrink-0 flex flex-col gap-3 pb-4">
        {QUESTIONS.map((q, idx) => {
          const a = answers[q.id];
          const unlocked = isUnlocked(idx);
          const open = openId === q.id;
          if (!unlocked) {
            return (
              <div key={q.id} className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3 text-slate-400">
                <QNum label={q.label} muted />
                <Lock size={18} />
              </div>
            );
          }
          const hintsOpen = a.retries >= HINT_AFTER_RETRIES && a.hints.length > 0 && a.status !== 'PASS';
          const justOpened = !open && a.attempts === 0 && !teacherMode;
          return (
            <div
              key={q.id}
              className={`rounded-2xl border-2 bg-white shadow-sm transition-all ${open ? 'border-indigo-300' : 'border-slate-200'} ${
                justOpened ? 'ring-pulse' : ''
              }`}
            >
              <button onClick={() => openQuestion(q.id)} className="w-full text-left px-4 pt-3 pb-2 flex items-start gap-3">
                <QNum label={q.label} extra={q.usesCustomData} />
                <span className={`font-korean text-[17px] leading-snug text-slate-800 flex-1 ${open ? '' : 'line-clamp-2'}`}>{q.prompt}</span>
                <ResultIcon status={a.status} />
              </button>
              {open && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  {/* 꼭 쓸 것: 제출하면 쓴 항목에 ✓ */}
                  <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2">
                    <div className="text-xs font-korean text-indigo-500 mb-1">꼭 쓸 것</div>
                    <ul className="flex flex-col gap-1">
                      {q.ideas.map((idea) => {
                        const done = a.found.includes(idea.id);
                        return (
                          <li key={idea.id} className={`flex items-start gap-2 font-korean text-[15px] ${done ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {done ? (
                              <CircleCheck size={18} className="shrink-0 mt-0.5 text-emerald-500" />
                            ) : (
                              <Circle size={18} className="shrink-0 mt-0.5 text-indigo-300" />
                            )}
                            {idea.student}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {q.usesCustomData && (
                    <span className="self-end flex items-center gap-1 text-xs text-slate-400 font-mono">
                      [{values.join(', ')}]
                      <span style={{ color: MEAN.stroke }}>▲{fmt(p)}</span>
                    </span>
                  )}
                  <textarea
                    value={a.text}
                    onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                    rows={4}
                    maxLength={1000}
                    placeholder="✏️"
                    className="w-full rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none p-3 text-[16px] leading-relaxed resize-y"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => submit(q)}
                      disabled={!a.text.trim() || a.status === 'loading'}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white font-korean whitespace-nowrap hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition"
                    >
                      {a.status === 'loading' ? <RotateCcw size={18} className="animate-spin" /> : <Send size={18} />}
                      제출
                    </button>
                    {hintsOpen && (
                      <button
                        onClick={() => playHints(a.hints, q)}
                        aria-label="힌트 다시 보기"
                        className="w-11 h-11 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center hover:bg-amber-100"
                      >
                        <Lightbulb size={20} className="text-amber-500 fill-amber-200" />
                      </button>
                    )}
                    {teacherMode && (
                      <button
                        onClick={() => playHints(hintsForMissing(q, q.ideas.map((i) => i.id)), q)}
                        aria-label="힌트 미리보기 (교사)"
                        className="h-11 px-3 rounded-full bg-slate-800 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1.5 hover:bg-slate-700"
                      >
                        <Lightbulb size={16} className="text-amber-300" /> 교사: 힌트 미리보기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </aside>
    </div>
  );
}

function QNum({ label, muted, extra }: { label: string; muted?: boolean; extra?: boolean }) {
  return (
    <span
      className={`shrink-0 min-w-9 h-9 px-2 rounded-full flex items-center justify-center font-korean text-base ${
        muted ? 'bg-slate-200 text-slate-400' : extra ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
      }`}
    >
      {extra && !muted ? <Sparkles size={14} className="mr-0.5" /> : null}
      {label}
    </span>
  );
}

function ResultIcon({ status }: { status: AnswerStatus }) {
  if (status === 'loading') return <RotateCcw size={22} className="animate-spin text-indigo-400 shrink-0" />;
  if (status === 'PASS') return <Star size={28} className="shrink-0 fill-amber-400 text-amber-500 pop" />;
  if (status === 'PARTIAL') return <StarHalf size={28} className="shrink-0 fill-amber-300 text-amber-500 pop" />;
  if (status === 'RETRY') return <Search size={26} className="shrink-0 text-sky-500 pop" />;
  return null;
}

function CellsIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <rect x="3" y="4" width="9" height="18" rx="2" fill={active ? EXCESS.fill : '#e2e8f0'} stroke={active ? EXCESS.stroke : '#94a3b8'} strokeWidth="2" />
      <rect x="14" y="4" width="9" height="18" rx="2" fill={active ? DEFICIT.fill : '#f1f5f9'} stroke={active ? DEFICIT.stroke : '#94a3b8'} strokeWidth="2" strokeDasharray="3 2" />
      <line x1="1" x2="25" y1="13" y2="13" stroke={MEAN.stroke} strokeWidth="2.5" />
    </svg>
  );
}
