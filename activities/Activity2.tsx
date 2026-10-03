import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  ChartColumn,
  CircleCheck,
  Eye,
  HandHelping,
  Lock,
  Pencil,
  Play,
  Repeat,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { ActiveHint, MAX_ITEMS, ModelStage, ViewMode } from '../components/ModelStage';
import { SeesawIcon } from '../components/SeesawIcon';
import {
  Analysis,
  AnalysisInput,
  BAR_CHOICE_LABEL,
  BarChoice,
  CHANGE_P,
  CHOICE_LABEL,
  Choice,
  DEFAULT_VALUES,
  EVIDENCE_LABEL,
  PREDICT,
  PredictTaskId,
  Prediction,
  TASKS,
  TASK_BY_ID,
  TaskDef,
  TaskId,
  Tilt,
  isPredictTask,
  meanOf,
  outcomeAt,
  predictionLabel,
  promptFor,
  ruleAnalyze,
  tiltAt,
} from '../lib/questions';
import { HintKey, MAX_SUPPORT_LEVEL, SUPPORT_LEVEL_LABEL, SupportLevel, TEACHER_HELP_TEXT, supportLabel } from '../lib/hints';
import { AddLog, SolvedProblem, TeacherNote } from '../types';
import { loadSession, saveSession } from '../lib/storage';
import { DEFICIT, EXCESS, MEAN } from '../lib/palette';
import { fmt } from '../lib/geometry';

// ---------------------------------------------------------------------------
// 활동 2: 다른 그림 예상하기(두 방향) → 자료를 바꾸어 시험하기 → 나만의 자료로 확인하기
// - 학생에게는 판정(별·통과)을 보여 주지 않는다. 예상 저장하기 · 확인하기 · 생각 저장하기 · 생각 수정하기 · 다음 탐구만 있다.
// - 확인하기는 정오 대신 가려 둔 그림 자체를 보여 준다(시소가 기울거나, 막대 그림이 칸과 함께 나타남).
// - 다음 탐구는 '해야 할 일을 마쳤는지'로 열리고, AI 분석 결과와는 관계없다. 분석은 교사 기록에만 남는다.
// - 같은 자료는 처음부터 같은 색·이름표로 잇는다. 학생은 기준과의 차이(넘침·모자람 ↔ 오른쪽·왼쪽 거리)와 그 관계를 생각한다.
// - 변환 애니메이션은 먼저 생각을 남긴 뒤(또는 도움 3단계) 쓸 수 있고, 가려 둔 그림이 있을 때는 쓸 수 없다.
// - 응답마다 그때의 화면 조건(자료값, 실제 초록색 위치, 예상·공개 시점, 응답 전에 본 도움)을 함께 기록한다.
// ---------------------------------------------------------------------------

interface SavedText {
  first: string;
  latest: string;
  firstAt: string;
  revisions: number;
}

interface RoundState {
  prediction?: Prediction;
  predictionSaved: boolean;
  predictionAt?: string;
  revealed: boolean;
  revealedAt?: string;
}

interface SupportEvent {
  t: string;
  task: TaskId;
  kind: string;
}

type DataMode = 'default' | 'custom';

interface A2State {
  drafts: Record<string, string>; // 칸 키 → 쓰는 중인 글
  saved: Record<string, SavedText>;
  done: Record<TaskId, boolean>;
  help: Record<TaskId, number>; // 지금까지 받은 도움 단계 (0~4)
  rounds: Record<string, RoundState>; // `${task}.${초록색 위치}`
  roundIdx: Record<PredictTaskId, number>;
  work: number[]; // 자료 바꾸기용 복사본
  checks: { before: number[]; after: number[]; tilt: Tilt; at: string }[];
  custom: number[]; // 나만의 자료
  dataMode: DataMode;
  supports: SupportEvent[];
}

const TASK_IDS = TASKS.map((t) => t.id);
const PREDICT_IDS = Object.keys(PREDICT) as PredictTaskId[];
const CUSTOM_STEPS = ['bar', 'beam', 'link'];
const emptyRecord = <T,>(v: T) => Object.fromEntries(TASK_IDS.map((id) => [id, v])) as Record<TaskId, T>;
const roundKey = (task: PredictTaskId, p: number) => `${task}.${p}`;

const initialState = (): A2State => ({
  drafts: {},
  saved: {},
  done: emptyRecord(false),
  help: emptyRecord(0),
  rounds: Object.fromEntries(
    PREDICT_IDS.flatMap((id) => PREDICT[id].rounds.map((r) => [roundKey(id, r), { predictionSaved: false, revealed: false }]))
  ),
  roundIdx: { predictSeesaw: 0, predictBars: 0 },
  work: [...DEFAULT_VALUES],
  checks: [],
  custom: [],
  dataMode: 'default',
  supports: [],
});

function loadState(key: string): A2State {
  const s = loadSession<Partial<A2State> | null>(key, null);
  const base = initialState();
  if (!s || !s.done) return base;
  return {
    ...base,
    ...s,
    done: { ...base.done, ...s.done },
    help: { ...base.help, ...s.help },
    rounds: { ...base.rounds, ...s.rounds },
    roundIdx: { ...base.roundIdx, ...s.roundIdx },
  };
}

// 탐구를 열 때 초록색의 처음 위치
const startPOf = (id: TaskId, st: A2State) => (isPredictTask(id) ? PREDICT[id].rounds[st.roundIdx[id]] : id === 'change' ? CHANGE_P : 5);

const HINT_STEP_MS = 7000;
const now = () => new Date().toISOString();
const SEESAW_CHOICES: Choice[] = ['left', 'flat', 'right', 'unsure'];
const BAR_CHOICES: BarChoice[] = ['over', 'equal', 'under', 'unsure'];

interface Activity2Props {
  playerName: string;
  teacherMode: boolean;
  addLog: AddLog;
  onTeacherNote: (note: Omit<TeacherNote, 'id' | 'timestamp' | 'playerName'>) => void;
  a1Supports: string[]; // 활동 1에서 본 시각 힌트 (지원 이력에 함께 남김)
  solvedProblems: SolvedProblem[]; // 활동 1에서 푼 문제 (나만의 자료로 불러오기)
}

export function Activity2({ playerName, teacherMode, addLog, onTeacherNote, a1Supports, solvedProblems }: Activity2Props) {
  const storeKey = `avg_a2_${playerName}`;
  const [st, setSt] = useState<A2State>(() => loadState(storeKey));
  useEffect(() => saveSession(storeKey, st), [st, storeKey]);
  const patch = (fn: (s: A2State) => Partial<A2State>) => setSt((s) => ({ ...s, ...fn(s) }));

  const [openId, setOpenId] = useState<TaskId>(() => TASKS.find((t) => !st.done[t.id])?.id ?? 'custom');
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  // 예상하기: 지금 탐구의 자료·초록색 위치·라운드
  const pset = isPredictTask(openId) ? PREDICT[openId] : null;
  const roundIdx = isPredictTask(openId) ? st.roundIdx[openId] : 0;
  const round = pset ? pset.rounds[roundIdx] : null;
  const rs = isPredictTask(openId) && round != null ? st.rounds[roundKey(openId, round)] : null;
  const hidden = !!rs && !rs.revealed;

  const values = pset ? pset.values : openId === 'change' ? st.work : openId === 'custom' && st.dataMode === 'custom' ? st.custom : DEFAULT_VALUES;
  const mean = useMemo(() => meanOf(values), [values]);
  const [p, setP] = useState(() => startPOf(openId, st));
  const [view, setView] = useState<ViewMode>('side');
  const [morphT, setMorphT] = useState(0);
  const [showCells, setShowCells] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [tiltScale, setTiltScale] = useState(1);
  const [hintQueue, setHintQueue] = useState<ActiveHint[]>([]);
  const activeHint = hintQueue[0] ?? null;

  const task = TASK_BY_ID[openId];
  const helpLevel = st.help[openId];
  const isUnlocked = (idx: number) => teacherMode || idx === 0 || st.done[TASKS[idx - 1].id];

  // ---------- 지원 이력 ----------
  const supportsRef = useRef(st.supports);
  supportsRef.current = st.supports;
  const noteSupport = (kind: string, t: TaskId = openId, once = false) => {
    if (once && supportsRef.current.some((e) => e.task === t && e.kind === kind)) return;
    const ev = { t: now(), task: t, kind };
    supportsRef.current = [...supportsRef.current, ev];
    patch((s) => ({ supports: [...s.supports, ev] }));
    addLog('SUPPORT', `${TASK_BY_ID[t].label}. ${supportLabel(kind)}`, { activity: 'A2', taskId: t, hint: kind });
  };
  // 이 탐구에서 응답 전에 실제로 본 것 + 활동 1에서 본 시각 힌트
  const supportsSeen = (t: TaskId) => [
    ...Array.from(new Set(supportsRef.current.filter((e) => e.task === t).map((e) => e.kind))),
    ...a1Supports.map((k) => `a1:${k}`),
  ];

  // ---------- 변환(morph) 애니메이션 ----------
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
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - start) / durationMs));
      setMorphT(from + (to - from) * k);
      if (k < 1) morphRaf.current = requestAnimationFrame(step);
      else morphRaf.current = null;
    };
    morphRaf.current = requestAnimationFrame(step);
  };
  useEffect(() => stopMorph, []);

  // 공개할 때 시소가 수평에서 천천히 기운다
  const tiltRaf = useRef<number | null>(null);
  const animateTilt = () => {
    if (tiltRaf.current != null) cancelAnimationFrame(tiltRaf.current);
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setTiltScale(k);
      if (k < 1) tiltRaf.current = requestAnimationFrame(step);
    };
    setTiltScale(0);
    tiltRaf.current = requestAnimationFrame(step);
  };

  // ---------- 시각 힌트 재생 (도움 3단계에서만, 학생이 고른 위치는 그대로) ----------
  const hintNonce = useRef(1);
  const playHints = (keys: HintKey[]) => {
    if (!keys.length) return;
    setHintQueue(keys.map((key) => ({ key, nonce: hintNonce.current++ })));
    keys.forEach((k) => noteSupport(`hint:${k}`));
    addLog('HINT_PLAYED', keys.join(', '), { activity: 'A2', taskId: openId, hint: keys.join(', ') });
  };
  useEffect(() => {
    if (!activeHint) return;
    if (activeHint.key === 'CELLS_TO_DISTANCE') {
      setView('morph');
      stopMorph();
      setMorphT(0);
      morphTRef.current = 0;
      animateMorph(1, 4200, 600);
      noteSupport('morph');
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

  // ---------- 탐구 열기·화면 초기화 ----------
  const cleanStage = (id: TaskId = openId) => {
    stopMorph();
    setView('side');
    setMorphT(0);
    setP(startPOf(id, st));
    setShowCells(st.help[id] >= 3);
    setSelected(null);
    setTiltScale(1);
    clearHints();
  };
  const openTask = (id: TaskId) => {
    if (id === openId) return;
    setOpenId(id);
    cleanStage(id);
    addLog('OPEN_TASK', `${TASK_BY_ID[id].label}. ${TASK_BY_ID[id].title}`, { activity: 'A2', taskId: id });
  };
  const goRound = (k: number) => {
    if (!isPredictTask(openId)) return;
    const id = openId;
    const r = PREDICT[id].rounds[k];
    patch((s) => ({ roundIdx: { ...s.roundIdx, [id]: k } }));
    setP(r);
    setView('side');
    setMorphT(0);
    setShowCells(helpLevel >= 3);
    setSelected(null);
    clearHints();
    setTiltScale(1);
    addLog('PREDICT_ROUND', `초록색 ${r}`, { activity: 'A2', taskId: id });
  };

  const hasFirstThought = (id: TaskId) => {
    if (isPredictTask(id)) return !!rs?.predictionSaved;
    if (id === 'change') return !!st.saved['change.method'];
    return true; // 나만의 자료: 1~3번을 마친 뒤의 정리 탐구라 처음부터 쓸 수 있다
  };
  // 변환 애니메이션('바꿔 보기')은 먼저 생각을 남긴 뒤에 (또는 도움 3단계), 가려 둔 그림이 없을 때만
  const morphAllowed = !hidden && (teacherMode || hasFirstThought(openId) || helpLevel >= 3);

  // ---------- 기록 + 분석 (분석은 교사용, 학생은 기다리지 않음) ----------
  const analyze = (inp: AnalysisInput, attempt: number, title: string) => {
    const finish = (a: Analysis) => {
      const lines = [
        `자료값 대응: ${EVIDENCE_LABEL[a.dataMatch]} · 차이 대응: ${EVIDENCE_LABEL[a.deviationMatch]} · 근거로 사용: ${EVIDENCE_LABEL[a.usedAsEvidence]}`,
        a.evidence ? `근거: ${a.evidence}` : '',
        a.flags.length ? `살펴볼 점: ${a.flags.join(' / ')}` : '',
        a.teacherLog,
        `다음 도움 제안: ${a.suggestedSupport}`,
        `응답 전 본 도움: ${(inp.supportsSeen ?? []).map(supportLabel).join(', ') || '없음'}`,
      ].filter(Boolean);
      onTeacherNote({ activity: 'A2', title, body: lines.join('\n'), answer: inp.text, check: a.teacherCheck });
      addLog('ANALYSIS', `${title} (${a.source})`, {
        activity: 'A2',
        taskId: inp.taskId,
        teacherLog: a.teacherLog,
        context: JSON.stringify(a),
        hint: a.suggestedSupport,
      });
    };
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inp, attempt }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<Analysis>) : Promise.reject(new Error(`status ${r.status}`))))
      .then(finish)
      .catch((err) => {
        console.warn('analyze failed, using local rules:', err);
        const a = ruleAnalyze(inp);
        a.teacherLog = `[서버 연결 실패 → 기기 내 규칙 분석] ${a.teacherLog}`;
        finish(a);
      });
  };

  // 한 번의 응답을 그때의 화면 조건과 함께 기록한다
  const record = (args: {
    task: TaskId;
    step: string;
    stepTitle: string;
    kind: 'first' | 'revised';
    text: string;
    attempt: number;
    extra?: Partial<AnalysisInput>;
    meta?: Record<string, unknown>;
  }) => {
    const vals = args.extra?.values ?? values;
    const pNow = args.extra?.p ?? p;
    const inp: AnalysisInput = {
      taskId: args.task,
      step: args.step,
      kind: args.kind,
      text: args.text,
      values: vals,
      p: pNow,
      supportsSeen: supportsSeen(args.task),
      ...args.extra,
    };
    const context = {
      task: args.task,
      step: args.step,
      kind: args.kind,
      attempt: args.attempt,
      values: vals,
      p: pNow,
      mean: meanOf(vals),
      hidden: hidden ? (pset?.hide === 'bars' ? '막대 그림 가림' : '시소 그림 가림') : '없음',
      seesawNow: hidden && pset?.hide === 'balance' ? '가려짐' : CHOICE_LABEL[tiltAt(vals, pNow)],
      view,
      cellsOn: showCells,
      helpLevel,
      round: inp.round,
      prediction: inp.prediction,
      history: inp.history,
      before: inp.before,
      supportsBefore: supportsRef.current.filter((e) => e.task === args.task),
      a1Supports,
      ...args.meta,
    };
    const answer = [inp.prediction ? `[예상] ${predictionLabel(inp.prediction)}` : '', args.text].filter(Boolean).join('\n');
    addLog('SAVE_RESPONSE', `${TASK_BY_ID[args.task].label}. ${args.stepTitle} (${args.kind === 'first' ? '처음' : `수정 ${args.attempt - 1}`})`, {
      activity: 'A2',
      taskId: args.task,
      answer,
      context: JSON.stringify(context),
      hint: inp.supportsSeen?.join(', ') ?? '',
    });
    const title = `활동 2 · ${TASK_BY_ID[args.task].label}. ${TASK_BY_ID[args.task].title} · ${args.stepTitle}${inp.round != null ? ` (초록색 ${inp.round})` : ''} · ${
      args.kind === 'first' ? '처음 응답' : `수정 ${args.attempt - 1}`
    }`;
    analyze({ ...inp, text: answer }, args.attempt, title);
  };

  // 글 칸 저장 (처음 저장 또는 수정)
  const saveText = (t: TaskDef, stepId: string, key: string, extra?: Partial<AnalysisInput>, meta?: Record<string, unknown>) => {
    const text = (st.drafts[key] ?? '').trim();
    const prev = st.saved[key];
    if (!text) return;
    const kind: 'first' | 'revised' = prev ? 'revised' : 'first';
    const attempt = prev ? prev.revisions + 2 : 1;
    const next: SavedText = prev ? { ...prev, latest: text, revisions: prev.revisions + 1 } : { first: text, latest: text, firstAt: now(), revisions: 0 };
    patch((s) => ({ saved: { ...s.saved, [key]: next } }));
    setEditing((e) => ({ ...e, [key]: false }));
    const stepTitle = t.steps.find((x) => x.id === stepId)?.title ?? stepId;
    record({ task: t.id, step: stepId, stepTitle, kind, text, attempt, extra, meta });
  };

  const markDone = (id: TaskId) => {
    if (st.done[id]) return;
    patch((s) => ({ done: { ...s.done, [id]: true } }));
    addLog('TASK_DONE', `${TASK_BY_ID[id].label}. ${TASK_BY_ID[id].title}`, { activity: 'A2', taskId: id });
  };

  // ---------- 도움 ----------
  const askHelp = () => {
    const level = Math.min(MAX_SUPPORT_LEVEL, helpLevel + 1) as SupportLevel;
    if (level === helpLevel) return;
    patch((s) => ({ help: { ...s.help, [openId]: level } }));
    noteSupport(`help${level}`);
    if (level === 3) {
      setShowCells(true);
      noteSupport('cells', openId, true);
      // 시소 그림을 가린 동안에는 막대 그림의 칸만, 나머지는 양쪽 거리의 합도 보여 준다
      playHints(openId === 'predictSeesaw' ? [] : ['SUM_BALANCE']);
    }
    if (level === 4) {
      onTeacherNote({
        activity: 'A2',
        title: `활동 2 · ${task.label}. ${task.title} · 도움 4단계 요청`,
        body: '학생이 도움 1~3단계를 받은 뒤 선생님의 도움(관계 설명)을 요청했습니다. 학생의 사례로 대응 관계를 함께 정리해 주세요.',
        check: true,
      });
    }
  };

  // ---------- 조작 ----------
  const changeView = (v: ViewMode) => {
    if (v === 'morph' && !morphAllowed) return;
    setView(v);
    clearHints();
    if (v === 'morph') noteSupport('morph', openId, true);
    addLog('VIEW_CHANGE', v === 'side' ? '함께 보기' : '바꿔 보기', { activity: 'A2', taskId: openId });
  };
  const playMorph = () => {
    const to = morphT < 0.5 ? 1 : 0;
    animateMorph(to, 3200);
    addLog('MORPH_PLAY', to === 1 ? '막대 그림 → 시소 그림' : '시소 그림 → 막대 그림', { activity: 'A2', taskId: openId });
  };
  const toggleCells = () => {
    setShowCells((v) => !v);
    if (!showCells) noteSupport('cells', openId, true);
    addLog('TOGGLE_CELLS', String(!showCells), { activity: 'A2', taskId: openId });
  };

  // ---------- 1·2. 다른 그림 예상하기: 예상 저장 → 확인하기(가려 둔 그림 공개) ----------
  const setRound = (id: PredictTaskId, r: number, next: Partial<RoundState>) =>
    patch((s) => ({ rounds: { ...s.rounds, [roundKey(id, r)]: { ...s.rounds[roundKey(id, r)], ...next } } }));

  const savePrediction = () => {
    if (!isPredictTask(openId) || round == null || !rs?.prediction) return;
    const key = `${openId}.reason.${round}`;
    const text = (st.drafts[key] ?? '').trim();
    if (!text) return; // 까닭은 꼭 쓴다
    const at = now();
    setRound(openId, round, { predictionSaved: true, predictionAt: at });
    patch((s) => ({ saved: { ...s.saved, [key]: { first: text, latest: text, firstAt: at, revisions: 0 } } }));
    record({
      task: openId,
      step: 'predict',
      stepTitle: '예상',
      kind: 'first',
      text,
      attempt: 1,
      extra: { values: PREDICT[openId].values, p: round, round, prediction: rs.prediction, revealed: false },
      meta: { predictionAt: at },
    });
  };
  const reveal = () => {
    if (!isPredictTask(openId) || round == null || !rs) return;
    setRound(openId, round, { revealed: true, revealedAt: now() });
    noteSupport('reveal');
    setView('side');
    setP(round);
    if (openId === 'predictSeesaw') animateTilt();
    else {
      // 막대 그림을 칸과 함께 보여 준다: 예상한 대상(넘친 부분·모자란 부분)을 바로 비교할 수 있게
      setShowCells(true);
      noteSupport('cells', openId, true);
    }
    const actual = outcomeAt(openId, PREDICT[openId].values, round);
    addLog('REVEAL', `초록색 ${round}: 예상 ${rs.prediction ? predictionLabel(rs.prediction) : '-'} / 실제 ${predictionLabel(actual)}`, {
      activity: 'A2',
      taskId: openId,
    });
  };
  const historyOf = (id: PredictTaskId) =>
    PREDICT[id].rounds.map((r) => {
      const x = st.rounds[roundKey(id, r)];
      return { p: r, prediction: x?.prediction, actual: outcomeAt(id, PREDICT[id].values, r) };
    });
  const allRevealed = (id: PredictTaskId) => PREDICT[id].rounds.every((r) => st.rounds[roundKey(id, r)]?.revealed);

  // ---------- 3. 자료 바꾸기 ----------
  const methodSaved = !!st.saved['change.method'];
  const changes = DEFAULT_VALUES.map((v, i) => ({ i, from: v, to: st.work[i] })).filter((c) => c.from !== c.to);
  const checkChange = () => {
    const tilt = tiltAt(st.work, CHANGE_P);
    patch((s) => ({ checks: [...s.checks, { before: [...DEFAULT_VALUES], after: [...s.work], tilt, at: now() }] }));
    addLog('CHECK_CHANGE', `[${DEFAULT_VALUES.join(', ')}] → [${st.work.join(', ')}] · 바꾼 자료 ${changes.length}개 · 시소 ${CHOICE_LABEL[tilt]}`, {
      activity: 'A2',
      taskId: 'change',
      context: JSON.stringify({
        before: DEFAULT_VALUES,
        after: st.work,
        changed: changes,
        p: CHANGE_P,
        tilt,
        supportsBefore: supportsRef.current.filter((e) => e.task === 'change'),
      }),
    });
  };

  // ---------- 4. 나만의 자료: 처음 자료 / 새로운 자료 ----------
  const customMode = openId === 'custom' && st.dataMode === 'custom';
  const chooseData = (mode: DataMode) => {
    if (mode === st.dataMode) return;
    patch(() => ({ dataMode: mode }));
    setSelected(null);
    clearHints();
    const next = mode === 'custom' ? st.custom : DEFAULT_VALUES;
    addLog('DATA_MODE', `${mode === 'custom' ? '새로운 자료' : '처음 자료'}: [${next.join(', ')}]`, { activity: 'A2', taskId: 'custom' });
  };
  const changeCustom = (next: number[], action: string) => {
    patch(() => ({ custom: next }));
    setSelected(null);
    clearHints();
    addLog('DATA_CHANGE', `${action}: [${next.join(', ')}] (평균 ${Number.isFinite(meanOf(next)) ? fmt(meanOf(next)) : '-'})`, {
      activity: 'A2',
      taskId: 'custom',
    });
  };
  const addValue = (v: number) => {
    if (st.custom.length >= MAX_ITEMS) return;
    changeCustom([...st.custom, v], `추가 ${v}`);
  };
  const removeValue = (i: number) => changeCustom(st.custom.filter((_, k) => k !== i), `삭제 #${i + 1}`);
  const importable = solvedProblems.filter((s) => s.values.length >= 2 && s.values.length <= MAX_ITEMS);
  const customReady = st.custom.length >= 2;

  // 막대 끝이나 추를 끌어 자료값 바꾸기 (3번: 복사본, 4번: 나만의 자료)
  const editValue = (i: number, v: number) => {
    if (openId === 'change') patch((s) => ({ work: s.work.map((x, k) => (k === i ? v : x)) }));
    else if (customMode) patch((s) => ({ custom: s.custom.map((x, k) => (k === i ? v : x)) }));
    clearHints();
  };

  // ---------- 완료 판정 (정답 여부가 아니라 할 일을 마쳤는지) ----------
  useEffect(() => {
    PREDICT_IDS.forEach((id) => {
      if (allRevealed(id) && st.saved[`${id}.reflect`]) markDone(id);
    });
    if (methodSaved && st.checks.length > 0 && st.saved['change.reflect']) markDone('change');
    if (CUSTOM_STEPS.every((k) => st.saved[`custom.${k}`])) markDone('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.saved, st.rounds, st.checks.length]);

  const setDraft = (key: string, text: string) => patch((s) => ({ drafts: { ...s.drafts, [key]: text } }));

  const segBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-korean transition-all ${
      active ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
    }`;

  const box = (
    t: TaskDef,
    stepId: string,
    key: string,
    opts: { extra?: Partial<AnalysisInput>; meta?: Record<string, unknown>; disabled?: boolean; disabledHint?: string } = {}
  ) => {
    const step = t.steps.find((x) => x.id === stepId)!;
    return (
      <ResponseBox
        key={key}
        title={step.title}
        ask={step.ask}
        value={st.drafts[key] ?? ''}
        onChange={(v) => setDraft(key, v)}
        saved={st.saved[key]}
        editing={!!editing[key]}
        disabled={opts.disabled}
        disabledHint={opts.disabledHint}
        onEdit={() => {
          setEditing((e) => ({ ...e, [key]: true }));
          setDraft(key, st.saved[key]?.latest ?? '');
          addLog('EDIT_START', `${t.label}. ${step.title}`, { activity: 'A2', taskId: t.id });
        }}
        onCancel={() => setEditing((e) => ({ ...e, [key]: false }))}
        onSave={() => saveText(t, stepId, key, opts.extra, opts.meta)}
      />
    );
  };

  const promptOf = (t: TaskDef) => (isPredictTask(t.id) ? promptFor(t, t.id === openId && round != null ? round : PREDICT[t.id].rounds[0]) : t.prompt);

  // 1·2. 다른 그림 예상하기 (방향만 다르고 흐름은 같다)
  const predictPanel = (t: TaskDef, id: PredictTaskId) => {
    if (round == null || !rs) return null;
    const set = PREDICT[id];
    const reasonKey = `${id}.reason.${round}`;
    const reasonStep = t.steps.find((x) => x.id === 'reason')!;
    const reasonText = (st.drafts[reasonKey] ?? '').trim();
    const choices: Prediction[] = id === 'predictSeesaw' ? SEESAW_CHOICES : BAR_CHOICES;
    const actual = outcomeAt(id, set.values, round);
    const last = roundIdx === set.rounds.length - 1;
    return (
      <>
        <div className={`grid gap-2 ${id === 'predictSeesaw' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {choices.map((c) => (
            <button
              key={c}
              disabled={rs.predictionSaved}
              onClick={() => setRound(id, round, { prediction: c })}
              className={`rounded-xl border-2 px-2 py-2 flex items-center gap-2 font-korean text-[15px] text-left leading-tight transition ${
                rs.prediction === c ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              } disabled:cursor-default`}
            >
              {id === 'predictSeesaw' ? <TiltIcon choice={c as Choice} /> : <BarSidesIcon choice={c as BarChoice} />}
              {predictionLabel(c)}
            </button>
          ))}
        </div>
        {!rs.predictionSaved ? (
          <>
            <div className="rounded-xl border-2 border-slate-200 bg-slate-50/60 px-3 pt-2 pb-2.5 flex flex-col gap-1.5">
              <span className="font-korean text-sm text-slate-500">{reasonStep.title}</span>
              <p className="font-korean text-[15px] leading-snug text-slate-800">{reasonStep.ask}</p>
              <textarea
                value={st.drafts[reasonKey] ?? ''}
                onChange={(e) => setDraft(reasonKey, e.target.value)}
                rows={2}
                maxLength={600}
                placeholder={rs.prediction === 'unsure' ? '어디까지 생각했는지, 무엇이 헷갈리는지 써 보세요' : '✏️'}
                className="w-full rounded-lg border-2 border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none px-3 py-2 text-[16px] leading-relaxed resize-y"
              />
            </div>
            <ActionButton onClick={savePrediction} disabled={!rs.prediction || !reasonText} icon={<Save size={18} />}>
              예상 저장하기
            </ActionButton>
            {rs.prediction && !reasonText && <span className="font-korean text-sm text-slate-500 -mt-1">예상과 까닭을 함께 써야 저장할 수 있어요.</span>}
          </>
        ) : (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 font-korean text-[15px] text-slate-700 flex items-center gap-2 flex-wrap">
            <CircleCheck size={18} className="text-emerald-500" /> 내 예상: <b>{rs.prediction && predictionLabel(rs.prediction)}</b>
            <span className="text-slate-500">— {st.saved[reasonKey]?.latest}</span>
          </div>
        )}
        {rs.predictionSaved && !rs.revealed && (
          <ActionButton onClick={reveal} icon={<Eye size={18} />}>
            확인하기
          </ActionButton>
        )}
        {rs.revealed && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 font-korean text-[15px] text-slate-700">
            {id === 'predictSeesaw' ? (
              <>
                시소를 보여 주었어요. 초록색이 {round}일 때 시소는 <b>{CHOICE_LABEL[actual as Choice]}</b>.
              </>
            ) : (
              <>
                막대 그림을 칸과 함께 보여 주었어요. 초록색이 {round}일 때 <b>{BAR_CHOICE_LABEL[actual as BarChoice]}</b>.
              </>
            )}
            <span className="block text-sm text-slate-500 mt-0.5">초록색을 옮겨 보며 두 그림을 더 살펴봐도 좋아요.</span>
          </div>
        )}
        {rs.revealed && !last && (
          <ActionButton onClick={() => goRound(roundIdx + 1)} icon={<ArrowRight size={18} />}>
            초록색 {set.rounds[roundIdx + 1]}에서 예상하기
          </ActionButton>
        )}
        {allRevealed(id) &&
          box(t, 'reflect', `${id}.reflect`, {
            extra: { values: set.values, p, revealed: true, history: historyOf(id) },
            meta: { rounds: set.rounds.map((r) => ({ p: r, ...st.rounds[roundKey(id, r)] })) },
          })}
      </>
    );
  };

  // ---------- 화면 ----------
  return (
    <div className="flex-1 min-h-0 w-full max-w-[1500px] mx-auto p-3 md:p-4 flex flex-col lg:flex-row lg:items-start gap-4 overflow-y-auto">
      {/* ---------- 그림 ---------- */}
      <section className="sticky top-0 z-10 shrink-0 lg:flex-1 min-w-0 bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 pt-4">
          <div className="flex bg-slate-100 rounded-2xl p-1">
            <button className={segBtn(view === 'side')} onClick={() => changeView('side')}>
              <ArrowLeftRight size={16} /> 함께 보기
            </button>
            <button
              className={`${segBtn(view === 'morph')} disabled:opacity-40`}
              onClick={() => changeView('morph')}
              disabled={!morphAllowed}
              title={morphAllowed ? '' : hidden ? '가려 둔 그림을 확인한 뒤에 쓸 수 있어요' : '먼저 생각을 저장하면 쓸 수 있어요'}
            >
              {morphAllowed ? <Repeat size={16} /> : <Lock size={14} />} 바꿔 보기
            </button>
          </div>

          <button
            onClick={toggleCells}
            aria-label="칸"
            className={`h-11 pl-2 pr-3 rounded-xl border-2 flex items-center gap-1 font-korean transition-all ${
              showCells ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <CellsIcon active={showCells} /> 칸
          </button>

          <button
            onClick={() => {
              cleanStage();
              addLog('RESET_STAGE', '', { activity: 'A2', taskId: openId });
            }}
            aria-label="처음 상태로"
            className="w-11 h-11 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500"
          >
            <RotateCcw size={20} />
          </button>

          {isPredictTask(openId) && pset && (
            <div className="ml-auto flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-1 font-korean text-sm">
              <span className="px-2 text-emerald-700">초록색</span>
              {pset.rounds.map((r, k) => {
                const doneR = !!st.rounds[roundKey(openId, r)]?.revealed;
                const can = teacherMode || k === 0 || !!st.rounds[roundKey(openId, pset.rounds[k - 1])]?.revealed;
                return (
                  <button
                    key={r}
                    disabled={!can}
                    onClick={() => goRound(k)}
                    className={`w-10 h-9 rounded-xl flex items-center justify-center gap-0.5 ${k === roundIdx ? 'bg-white shadow text-emerald-700' : 'text-emerald-600'} disabled:opacity-30`}
                  >
                    {r}
                    {doneR && <CircleCheck size={12} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* 4번: 처음 자료 / 새로운 자료 */}
          {openId === 'custom' && (
            <div className="flex bg-violet-50 border border-violet-200 rounded-2xl p-1 ml-auto">
              <button className={segBtn(st.dataMode === 'default')} onClick={() => chooseData('default')}>
                <ChartColumn size={16} /> 처음 자료
              </button>
              <button
                className={`${segBtn(st.dataMode === 'custom')} ${st.dataMode !== 'custom' && st.custom.length === 0 ? 'attention' : ''}`}
                onClick={() => chooseData('custom')}
              >
                <Sparkles size={16} /> 새로운 자료
              </button>
            </div>
          )}
        </div>

        {/* 새로운 자료: 활동 1 문제 불러오기 / 모두 지우기 */}
        {customMode && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end px-4 pt-2">
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
              onClick={() => changeCustom([], '모두 지우기')}
              disabled={st.custom.length === 0}
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
            onPChange={setP}
            onPDragEnd={(from, to) =>
              addLog('DRAG_GREEN', `${from} -> ${to} (자료 평균 ${Number.isFinite(mean) ? fmt(mean) : '-'})`, { activity: 'A2', taskId: openId })
            }
            view={view}
            morphT={morphT}
            showCells={showCells}
            selected={selected}
            onSelect={setSelected}
            editable={(openId === 'change' && methodSaved) || customMode}
            allowAddRemove={customMode}
            onValueChange={editValue}
            onValueDragEnd={(i, from, to) => addLog('EDIT_VALUE', `#${i + 1}: ${from} -> ${to}`, { activity: 'A2', taskId: openId })}
            onAddValue={customMode ? addValue : undefined}
            onRemoveValue={customMode ? removeValue : undefined}
            hint={activeHint}
            hideBalance={hidden && pset?.hide === 'balance'}
            hideBars={hidden && pset?.hide === 'bars'}
            lockP={hidden || openId === 'change'}
            tiltScale={openId === 'predictSeesaw' ? tiltScale : 1}
          />

          {activeHint && (
            <div className="absolute top-2 right-3 flex items-center gap-1 bg-amber-100 border-2 border-amber-300 rounded-full pl-2 pr-1 py-1 shadow">
              <HandHelping size={20} className="text-amber-600" />
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
              onChange={(e) => {
                stopMorph();
                setMorphT(Number(e.target.value) / 1000);
              }}
              onPointerUp={() => addLog('MORPH_SLIDE', `t=${morphT.toFixed(2)}`, { activity: 'A2', taskId: openId })}
              className="flex-1 accent-indigo-600 h-3"
            />
            <SeesawIcon size={26} className="text-slate-500 shrink-0" />
          </div>
        )}
        {view === 'side' && <div className="h-3" />}
      </section>

      {/* ---------- 탐구 ---------- */}
      <aside className="lg:w-[430px] shrink-0 flex flex-col gap-3 pb-4">
        {TASKS.map((t, idx) => {
          const unlocked = isUnlocked(idx);
          const open = openId === t.id;
          if (!unlocked) {
            return (
              <div key={t.id} className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3 text-slate-400">
                <TaskNum label={t.label} muted />
                <span className="font-korean">{t.title}</span>
                <Lock size={16} className="ml-auto" />
              </div>
            );
          }
          return (
            <div key={t.id} className={`rounded-2xl border-2 bg-white shadow-sm transition-all ${open ? 'border-indigo-300' : 'border-slate-200'}`}>
              <button onClick={() => openTask(t.id)} className="w-full text-left px-4 pt-3 pb-2 flex items-start gap-3">
                <TaskNum label={t.label} />
                <span className="flex-1">
                  <span className="block font-korean text-[17px] text-slate-800">{t.title}</span>
                  {!open && <span className="block text-sm text-slate-500 line-clamp-1 font-korean">{promptOf(t)}</span>}
                </span>
                {st.done[t.id] && <CircleCheck size={22} className="shrink-0 text-emerald-500" />}
              </button>
              {open && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <p className="font-korean text-[16px] leading-snug text-slate-800">{promptOf(t)}</p>

                  {/* 1·2. 다른 그림 예상하기 */}
                  {isPredictTask(t.id) && predictPanel(t, t.id)}

                  {/* 3. 자료를 바꾸어 시험하기 */}
                  {t.id === 'change' && (
                    <>
                      {box(t, 'method', 'change.method')}
                      {methodSaved && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 font-korean text-[15px] text-slate-700 flex flex-col gap-2">
                          <span>막대 끝이나 추를 끌어 자료를 바꿔 보세요. 받침점은 5에 그대로예요.</span>
                          <span className="text-sm text-slate-500">
                            바꾼 자료 {changes.length}개{changes.length ? `: ${changes.map((c) => `${c.from}→${c.to}`).join(', ')}` : ''} · 지금 시소:{' '}
                            {CHOICE_LABEL[tiltAt(st.work, CHANGE_P)]}
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            <ActionButton onClick={checkChange} disabled={changes.length === 0} icon={<Eye size={18} />}>
                              확인하기
                            </ActionButton>
                            <button
                              onClick={() => {
                                patch(() => ({ work: [...DEFAULT_VALUES] }));
                                addLog('RESET_DATA', '처음 자료로', { activity: 'A2', taskId: 'change' });
                              }}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-slate-200 bg-white font-korean text-slate-600 hover:bg-slate-50"
                            >
                              <Undo2 size={16} /> 처음 자료로
                            </button>
                          </div>
                          {st.checks.length > 0 && (
                            <ul className="text-sm text-slate-600 list-disc pl-5">
                              {st.checks.map((c, k) => (
                                <li key={k}>
                                  [{c.after.join(', ')}] → 시소 {CHOICE_LABEL[c.tilt]}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {methodSaved &&
                        st.checks.length > 0 &&
                        box(t, 'reflect', 'change.reflect', {
                          extra: { values: st.work, before: [...DEFAULT_VALUES], p: CHANGE_P },
                          meta: { checks: st.checks },
                        })}
                    </>
                  )}

                  {/* 4. 나만의 자료로 확인하기 */}
                  {t.id === 'custom' && (
                    <>
                      <span className="self-end flex items-center gap-1 text-xs text-slate-400 font-mono">
                        {st.dataMode === 'custom' ? '새로운 자료' : '처음 자료'} [{values.join(', ')}]
                        <span style={{ color: MEAN.stroke }}>▲{fmt(p)}</span>
                      </span>
                      {CUSTOM_STEPS.map((k) =>
                        box(t, k, `custom.${k}`, {
                          disabled: !customReady,
                          disabledHint: "먼저 '새로운 자료'에서 자료를 2개 이상 만들어 주세요",
                          extra: { values: st.custom },
                          meta: { viewing: st.dataMode, viewValues: values, custom: st.custom },
                        })
                      )}
                    </>
                  )}

                  {/* 도움 · 다음 탐구 */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      onClick={askHelp}
                      disabled={helpLevel >= MAX_SUPPORT_LEVEL}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-amber-300 bg-amber-50 text-amber-800 font-korean hover:bg-amber-100 disabled:opacity-40"
                    >
                      <HandHelping size={18} /> 도움
                      <span className="flex gap-0.5 ml-1">
                        {[1, 2, 3, 4].map((k) => (
                          <span key={k} className={`w-1.5 h-1.5 rounded-full ${k <= helpLevel ? 'bg-amber-500' : 'bg-amber-200'}`} />
                        ))}
                      </span>
                    </button>
                    {st.done[t.id] && idx < TASKS.length - 1 && (
                      <button
                        onClick={() => openTask(TASKS[idx + 1].id)}
                        className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white font-korean hover:bg-indigo-700 active:scale-95"
                      >
                        다음 탐구 <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                  {helpLevel > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 font-korean text-[15px] text-amber-900">
                      <div className="text-xs text-amber-600 mb-0.5">
                        도움 {helpLevel} · {SUPPORT_LEVEL_LABEL[helpLevel as SupportLevel]}
                      </div>
                      {helpLevel >= 4 ? TEACHER_HELP_TEXT : t.help[helpLevel - 1]}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>
    </div>
  );
}

// 글 칸: 생각 저장하기 → (저장됨) → 생각 수정하기
function ResponseBox({
  title,
  ask,
  value,
  onChange,
  saved,
  editing,
  disabled,
  disabledHint,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string;
  ask: string;
  value: string;
  onChange: (v: string) => void;
  saved?: SavedText;
  editing: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const writing = !saved || editing;
  return (
    <div className={`rounded-xl border-2 px-3 pt-2 pb-2.5 flex flex-col gap-1.5 ${saved && !editing ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
      <div className="flex items-center gap-1.5 font-korean text-sm text-slate-500">
        <span className="flex-1">{title}</span>
        {saved && !editing && <CircleCheck size={18} className="text-emerald-500" />}
      </div>
      <p className="font-korean text-[15px] leading-snug text-slate-800">{ask}</p>
      {writing ? (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            maxLength={600}
            disabled={disabled}
            placeholder={disabled ? disabledHint ?? '' : '✏️'}
            className="w-full rounded-lg border-2 border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none px-3 py-2 text-[16px] leading-relaxed resize-y disabled:bg-slate-100"
          />
          <div className="flex gap-2">
            <ActionButton onClick={onSave} disabled={disabled || !value.trim()} icon={<Save size={18} />}>
              {saved ? '수정한 생각 저장하기' : '생각 저장하기'}
            </ActionButton>
            {saved && (
              <button onClick={onCancel} className="px-3 py-2 rounded-full text-slate-500 font-korean hover:bg-slate-100">
                취소
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-[16px] text-slate-800 whitespace-pre-wrap">{saved!.latest}</div>
          <button onClick={onEdit} className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-indigo-700 font-korean hover:bg-indigo-50">
            <Pencil size={15} /> 생각 수정하기
          </button>
        </>
      )}
    </div>
  );
}

function ActionButton({ onClick, disabled, icon, children }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="self-start flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white font-korean whitespace-nowrap hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition"
    >
      {icon}
      {children}
    </button>
  );
}

function TaskNum({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-korean text-base ${
        muted ? 'bg-slate-200 text-slate-400' : 'bg-indigo-100 text-indigo-700'
      }`}
    >
      {label}
    </span>
  );
}

const UnsureMark = () => (
  <span className="w-8 h-6 shrink-0 flex items-center justify-center text-slate-400 font-bold" aria-hidden>
    ?
  </span>
);

// 시소 그림 예상 단추의 작은 시소 그림
function TiltIcon({ choice }: { choice: Choice }) {
  if (choice === 'unsure') return <UnsureMark />;
  const deg = choice === 'left' ? -14 : choice === 'right' ? 14 : 0;
  return (
    <svg width="32" height="24" viewBox="0 0 32 24" className="shrink-0" aria-hidden>
      <g transform={`rotate(${deg} 16 13)`}>
        <rect x="2" y="11" width="28" height="4" rx="2" fill="#d6a26c" stroke="#8b5a2b" strokeWidth="1" />
      </g>
      <path d="M 16 15 L 21 23 L 11 23 Z" fill={MEAN.stroke} />
    </svg>
  );
}

// 막대 그림 예상 단추의 작은 막대 그림: 초록 선 위로 넘친 부분(주황)과 초록 선까지 모자란 부분(파랑 점선)
function BarSidesIcon({ choice }: { choice: BarChoice }) {
  if (choice === 'unsure') return <UnsureMark />;
  const LINE = 12;
  const BOTTOM = 23;
  const [tall, short] = choice === 'over' ? [2, 15] : choice === 'under' ? [9, 21] : [5, 19];
  return (
    <svg width="32" height="24" viewBox="0 0 32 24" className="shrink-0" aria-hidden>
      <rect x="4" y={LINE} width="9" height={BOTTOM - LINE} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <rect x="4" y={tall} width="9" height={LINE - tall} fill={EXCESS.fill} stroke={EXCESS.stroke} strokeWidth="1" />
      <rect x="19" y={short} width="9" height={BOTTOM - short} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <rect x="19" y={LINE} width="9" height={short - LINE} fill={DEFICIT.fill} stroke={DEFICIT.stroke} strokeWidth="1" strokeDasharray="2 1.5" />
      <line x1="1" y1={LINE} x2="31" y2={LINE} stroke={MEAN.stroke} strokeWidth="2" />
    </svg>
  );
}

function CellsIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <rect x="3" y="4" width="9" height="18" rx="2" fill={active ? '#fdba74' : '#e2e8f0'} stroke={active ? '#ea580c' : '#94a3b8'} strokeWidth="2" />
      <rect x="14" y="4" width="9" height="18" rx="2" fill={active ? '#bae6fd' : '#f1f5f9'} stroke={active ? '#0284c7' : '#94a3b8'} strokeWidth="2" strokeDasharray="3 2" />
      <line x1="1" y1="12" x2="25" y2="12" stroke={MEAN.stroke} strokeWidth="2.5" />
    </svg>
  );
}
