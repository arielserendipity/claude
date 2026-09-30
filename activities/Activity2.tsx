import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeftRight,
  ChartColumn,
  Lightbulb,
  Lock,
  Minus,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Scale,
  Search,
  Send,
  Sparkles,
  Star,
  StarHalf,
  X,
} from 'lucide-react';
import { ActiveHint, ModelStage, ViewMode } from '../components/ModelStage';
import { DEFAULT_VALUES, EvalResult, QUESTIONS, Question, QuestionId, Verdict, ruleEvaluate } from '../lib/questions';
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
}

type Answers = Record<QuestionId, AnswerState>;

const emptyAnswers = (): Answers =>
  Object.fromEntries(QUESTIONS.map((q) => [q.id, { text: '', status: 'idle', hints: [], attempts: 0 }])) as Answers;

const HINT_STEP_MS = 7000;
const MAX_ITEMS = 10;
const MIN_ITEMS = 2;

const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sameValues = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

interface Activity2Props {
  playerName: string;
  addLog: AddLog;
  onTeacherNote: (note: Omit<TeacherNote, 'id' | 'timestamp' | 'playerName'>) => void;
  solvedProblems: SolvedProblem[];
}

export function Activity2({ playerName, addLog, onTeacherNote, solvedProblems }: Activity2Props) {
  const storeKey = `avg_a2_${playerName}`;
  const [answers, setAnswers] = useState<Answers>(() => ({ ...emptyAnswers(), ...loadStored<Partial<Answers>>(storeKey, {}) }));
  useEffect(() => {
    // 채점 중 상태는 저장하지 않는다 (새로고침 후 멈춰 보이지 않게)
    const toSave = Object.fromEntries(
      Object.entries(answers).map(([k, a]) => [k, a.status === 'loading' ? { ...a, status: 'idle' } : a])
    );
    saveStored(storeKey, toSave);
  }, [answers, storeKey]);

  const [values, setValues] = useState<number[]>(DEFAULT_VALUES);
  const [dataSource, setDataSource] = useState<string>('default');
  const [p, setP] = useState(5);
  const [view, setView] = useState<ViewMode>('side');
  const [morphT, setMorphT] = useState(0);
  const [showCells, setShowCells] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hintQueue, setHintQueue] = useState<ActiveHint[]>([]);
  const [usedMorph, setUsedMorph] = useState(false);
  const [openId, setOpenId] = useState<QuestionId>(() => {
    const firstOpen = QUESTIONS.find((q) => (answers[q.id]?.attempts ?? 0) === 0);
    return firstOpen?.id ?? 'q1';
  });

  const mean = useMemo(() => meanOf(values), [values]);
  const activeHint = hintQueue[0] ?? null;
  const exploreUnlocked = answers.q3b.attempts > 0;

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
    // 1~3번 문항 힌트는 기본 자료, 평균 위치에서 보여준다
    if (!q.usesCustomData && !sameValues(values, DEFAULT_VALUES)) {
      setValues(DEFAULT_VALUES);
      setDataSource('default');
      setP(meanOf(DEFAULT_VALUES));
    } else {
      setP(q.usesCustomData ? mean : meanOf(DEFAULT_VALUES));
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

  const resetStage = () => {
    stopMorph();
    setP(5);
    setMorphT(0);
    setSelected(null);
    setShowCells(false);
    clearHints();
    addLog('RESET_STAGE', '', { activity: 'A2' });
  };

  const loadData = (next: number[], source: string) => {
    setValues(next);
    setDataSource(source);
    setSelected(null);
    clearHints();
    addLog('DATA_CHANGE', `${source}: [${next.join(', ')}] (평균 ${fmt(meanOf(next))})`, { activity: 'A2' });
  };

  const editValue = (i: number, v: number) => {
    setValues((prev) => prev.map((x, k) => (k === i ? v : x)));
    setDataSource('custom');
    clearHints();
  };

  const addItem = () => {
    if (values.length >= MAX_ITEMS) return;
    loadData([...values, 5], 'custom');
  };
  const removeItem = () => {
    if (values.length <= MIN_ITEMS) return;
    loadData(values.slice(0, -1), 'custom');
  };

  // ---------- 서술형 제출 ----------
  const setAnswer = (id: QuestionId, patch: Partial<AnswerState>) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const isUnlocked = (idx: number) => idx === 0 || answers[QUESTIONS[idx - 1].id].attempts > 0;

  const submit = async (q: Question) => {
    const text = answers[q.id].text.trim();
    if (!text || answers[q.id].status === 'loading') return;
    const attempt = answers[q.id].attempts + 1;
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

    setAnswer(q.id, { status: result.verdict, hints: result.hints, attempts: attempt });
    addLog('SUBMIT_ANSWER', `found: [${result.foundIdeaIds.join(', ')}] missing: [${result.missingIdeaIds.join(', ')}] (${result.source})`, {
      activity: 'A2',
      questionId: q.id,
      answer: text,
      verdict: result.verdict,
      teacherLog: result.teacherLog,
      hint: result.hints.map((h) => h.key).join(', '),
    });
    onTeacherNote({
      activity: 'A2',
      title: `활동 2 · 문항 ${q.label} (${attempt}번째 제출)${q.usesCustomData ? ` · 자료 [${ctxValues.join(', ')}]` : ''}`,
      body: `${result.teacherLog}${result.misconception ? `\n[오개념 가능성] ${result.misconception}` : ''}`,
      verdict: result.verdict,
      answer: text,
    });

    if (result.verdict === 'PASS') {
      confetti({ particleCount: 70, spread: 60, origin: { x: 0.8, y: 0.4 } });
    } else {
      playHints(result.hints, q);
    }
    const idx = QUESTIONS.findIndex((x) => x.id === q.id);
    if (idx < QUESTIONS.length - 1 && answers[QUESTIONS[idx + 1].id].attempts === 0) {
      setOpenId(QUESTIONS[idx + 1].id);
    }
  };

  const importable = solvedProblems.filter((s) => s.values.length >= MIN_ITEMS && s.values.length <= MAX_ITEMS);

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

          {exploreUnlocked && (
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              <Sparkles size={18} className="text-violet-500" />
              <button
                onClick={() => loadData(DEFAULT_VALUES, 'default')}
                className={`px-3 py-1.5 rounded-full text-sm font-korean border ${
                  dataSource === 'default' ? 'bg-violet-100 border-violet-300 text-violet-800' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                처음 자료
              </button>
              {importable.map((s) => (
                <button
                  key={`${s.level}-${s.solvedAt}`}
                  onClick={() => loadData(s.values, `a1-${s.level}`)}
                  className={`px-3 py-1.5 rounded-full text-sm font-korean border flex items-center gap-1 ${
                    dataSource === `a1-${s.level}` ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <Scale size={14} /> 활동 1 · {s.level}
                </button>
              ))}
              <button
                onClick={removeItem}
                disabled={values.length <= MIN_ITEMS}
                aria-label="자료 빼기"
                className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={addItem}
                disabled={values.length >= MAX_ITEMS}
                aria-label="자료 더하기"
                className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-40"
              >
                <Plus size={16} />
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
              addLog('DRAG_MEAN', `${from} -> ${to} (자료 평균 ${fmt(mean)})`, { activity: 'A2' })
            }
            view={view}
            morphT={morphT}
            showCells={showCells}
            selected={selected}
            onSelect={setSelected}
            editable={exploreUnlocked}
            onValueChange={editValue}
            onValueDragEnd={(i, from, to) => addLog('EDIT_VALUE', `#${i + 1}: ${from} -> ${to}`, { activity: 'A2' })}
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
          return (
            <div
              key={q.id}
              className={`rounded-2xl border-2 bg-white shadow-sm transition-all ${open ? 'border-indigo-300' : 'border-slate-200'}`}
            >
              <button onClick={() => setOpenId(q.id)} className="w-full text-left px-4 pt-3 pb-2 flex items-start gap-3">
                <QNum label={q.label} extra={q.usesCustomData} />
                <span className={`font-korean text-[17px] leading-snug text-slate-800 flex-1 ${open ? '' : 'line-clamp-2'}`}>{q.prompt}</span>
                <ResultIcon status={a.status} />
              </button>
              {open && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <textarea
                    value={a.text}
                    onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                    rows={4}
                    maxLength={1000}
                    placeholder="✏️"
                    className="w-full rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none p-3 text-[16px] leading-relaxed resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => submit(q)}
                      disabled={!a.text.trim() || a.status === 'loading'}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white font-korean hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition"
                    >
                      {a.status === 'loading' ? <RotateCcw size={18} className="animate-spin" /> : <Send size={18} />}
                      제출
                    </button>
                    {a.hints.length > 0 && a.status !== 'PASS' && a.status !== 'loading' && (
                      <button
                        onClick={() => playHints(a.hints, q)}
                        aria-label="힌트 다시 보기"
                        className="w-11 h-11 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center hover:bg-amber-100"
                      >
                        <Lightbulb size={20} className="text-amber-500 fill-amber-200" />
                      </button>
                    )}
                    {q.usesCustomData && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-slate-400 font-mono">
                        [{values.join(', ')}]
                        <span style={{ color: MEAN.stroke }}>▲{fmt(p)}</span>
                      </span>
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
