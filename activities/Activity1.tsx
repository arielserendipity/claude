import React, { useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Flag, Lightbulb, Play, RotateCcw, Scale, SkipForward, Star, Trophy } from 'lucide-react';
import { BalanceBeamStage } from '../components/BalanceBeamStage';
import { AddLog, AppState, Block, DragLog, SolvedProblem, TeacherNote } from '../types';
import { generateNewBlocks } from '../lib/levelGen';
import { analyzeActivity1 } from '../lib/activity1Rules';

interface Activity1Props {
  teacherMode: boolean;
  addLog: AddLog;
  onTeacherNote: (note: Omit<TeacherNote, 'id' | 'timestamp' | 'playerName'>) => void;
  onSolved: (problem: SolvedProblem) => void;
  onSupportSeen?: (kind: string) => void; // 본 시각 힌트를 활동 2 지원 이력에 넘긴다
  onGoActivity2: () => void;
}

const MAX_LEVEL = 10;

export function Activity1({ teacherMode, addLog, onTeacherNote, onSolved, onSupportSeen, onGoActivity2 }: Activity1Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fulcrumPosition, setFulcrumPosition] = useState(5.5);
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [isHintActive, setIsHintActive] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  // 단계마다 오답 수를 세어 2회부터 시각 힌트를 연다 (학생에게 글로 알려주지 않음)
  const [levelFailCount, setLevelFailCount] = useState(0);
  const [levelAttempts, setLevelAttempts] = useState(1);
  const [currentLevelLogs, setCurrentLevelLogs] = useState<DragLog[]>([]);

  const currentDragStartRef = useRef<number>(0);
  const levelStartTimeRef = useRef<number>(0);
  const nextLevelParamsRef = useRef({ blocksToAdd: 1, forceInteger: true });

  const log: AddLog = (action, details = '', extra) =>
    addLog(action, details, { activity: 'A1', level, failCount: levelFailCount, ...extra });

  // 교사 미리보기에서는 힌트를 처음부터 모두 볼 수 있다
  const hintLevel: 0 | 1 | 2 = teacherMode || levelFailCount >= 3 ? 2 : levelFailCount >= 2 ? 1 : 0;

  const average = useMemo(() => {
    if (blocks.length === 0) return 0;
    return blocks.reduce((acc, b) => acc + b.position, 0) / blocks.length;
  }, [blocks]);

  const startGame = () => {
    setLevel(1);
    setScore(0);
    setLevelFailCount(0);
    setIsHintActive(false);
    setLevelAttempts(1);
    setCurrentLevelLogs([]);
    setFulcrumPosition(5.5);
    nextLevelParamsRef.current = { blocksToAdd: 1, forceInteger: true };
    setBlocks(generateNewBlocks([], 2, true));
    levelStartTimeRef.current = Date.now();
    setAppState('PLAYING');
    addLog('START_GAME', 'Level 1 started with 2 weights', { activity: 'A1', level: 1, failCount: 0 });
  };

  const handleFulcrumDragStart = () => {
    currentDragStartRef.current = Date.now();
  };

  const handleFulcrumDragEnd = (startPos: number, finalPos: number) => {
    const duration = Date.now() - currentDragStartRef.current;
    if (startPos === finalPos) return;
    setHasDragged(true);
    setCurrentLevelLogs((prev) => [...prev, { action: 'DRAG_FULCRUM', startPos, endPos: finalPos, durationMs: duration }]);
    log('DRAG_FULCRUM', `Fulcrum moved ${startPos} -> ${finalPos} (${(duration / 1000).toFixed(1)}s)`);
  };

  const handleConfirm = () => {
    setAppState('EVALUATING');
    const isBalanced = Math.abs(average - fulcrumPosition) < 0.01;
    const explorationTime = Math.floor((Date.now() - levelStartTimeRef.current) / 1000);
    const calculatedFailCount = isBalanced ? levelFailCount : levelFailCount + 1;
    if (!isBalanced) setLevelFailCount(calculatedFailCount);

    log(
      'CONFIRM_BALANCE',
      `Fulcrum: ${fulcrumPosition}, Average: ${average}, Balanced: ${isBalanced}, ExpTime: ${explorationTime}s, LevelFailCount: ${calculatedFailCount}`,
      { failCount: calculatedFailCount }
    );

    // 규칙으로 바로 진단한다 (AI를 기다리지 않음). 2초는 받침대가 빠지고 저울이 기우는 모습을 보여 주는 시간.
    const analysis = analyzeActivity1({
      level,
      failCount: calculatedFailCount,
      isSuccess: isBalanced,
      explorationSec: explorationTime,
      logs: currentLevelLogs,
      positions: blocks.map((b) => b.position),
      fulcrum: fulcrumPosition,
      average,
    });
    onTeacherNote({
      activity: 'A1',
      title: `활동 1 · ${level}단계 ${isBalanced ? '성공' : `오답 ${calculatedFailCount}회`} (받침점 ${fulcrumPosition}, 평균 ${average})`,
      body: `${analysis.teacherLog}${isBalanced ? `\n[다음 단계] ${analysis.reasoningForNextStep}` : ''}`,
    });

    setTimeout(() => {
      if (!isBalanced) {
        setAppState('GAME_OVER');
        log('GAME_OVER', `Level ${level} failed (Fail count: ${calculatedFailCount})`, {
          failCount: calculatedFailCount,
          teacherLog: analysis.teacherLog,
          reasoning: analysis.reasoningForNextStep,
        });
        // 2회 이상 틀리면 시각 힌트(거리 곡선), 3회 이상이면 거리의 합 막대까지 켠다
        if (analysis.showVisualHint) {
          setIsHintActive(true);
          onSupportSeen?.(calculatedFailCount >= 3 ? '거리 곡선+거리의 합' : '거리 곡선');
          log('VISUAL_HINT_ON', `hint level ${calculatedFailCount >= 3 ? 2 : 1}`, {
            failCount: calculatedFailCount,
            hint: calculatedFailCount >= 3 ? '거리 곡선 + 왼쪽/오른쪽 거리의 합' : '거리 곡선',
          });
        }
      } else {
        setAppState('LEVEL_CLEAR');
        setScore((s) => s + level * 100);
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 } });
        onSolved({
          level,
          values: blocks.map((b) => b.position),
          mean: average,
          solvedAt: new Date().toISOString(),
        });
        log('LEVEL_CLEAR', `Level ${level} cleared on attempt ${levelAttempts}`, {
          teacherLog: analysis.teacherLog,
          reasoning: analysis.reasoningForNextStep,
        });
        nextLevelParamsRef.current = { blocksToAdd: analysis.blocksToAdd, forceInteger: analysis.forceInteger };
      }
    }, 2000);
  };

  const nextLevel = () => {
    if (level >= MAX_LEVEL) {
      setAppState('ALL_CLEAR');
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
      log('ALL_CLEAR', `Game completed at level ${MAX_LEVEL}`);
      return;
    }
    const params = nextLevelParamsRef.current;
    log('DIFFICULTY_SET', `Next Level => add: ${params.blocksToAdd}, isInteger: ${params.forceInteger}`);

    setLevel((l) => l + 1);
    setLevelFailCount(0);
    setIsHintActive(false);
    setLevelAttempts(1);
    setCurrentLevelLogs([]);
    setBlocks((prev) => {
      const oldBlocks = prev.map((b) => ({ ...b, isNew: false }));
      return [...oldBlocks, ...generateNewBlocks(oldBlocks, params.blocksToAdd, params.forceInteger)];
    });
    levelStartTimeRef.current = Date.now();
    setAppState('PLAYING');
    addLog('NEXT_LEVEL', `Level ${level + 1} started.`, { activity: 'A1', level: level + 1, failCount: 0 });
  };

  const retryLevel = () => {
    setAppState('PLAYING');
    setLevelAttempts((a) => a + 1);
    levelStartTimeRef.current = Date.now();
    log('RETRY_LEVEL', `Level ${level} retried (Cumulative fails: ${levelFailCount})`);
  };

  const toggleHint = () => {
    setIsHintActive((prev) => {
      log('TOGGLE_HINT', `Hint toggled to ${!prev}`);
      return !prev;
    });
  };

  const bigButton =
    'group relative px-10 py-4 rounded-full font-korean text-xl transition-all duration-200 transform active:scale-95 shadow-lg text-white hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0';

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full max-w-6xl mx-auto p-3 md:p-4 gap-3">
      <div className="flex-1 min-h-0 bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* 진행 상황 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-3 flex-wrap">
          <p className="font-korean text-lg md:text-xl text-slate-700">받침점을 옮겨서 시소가 평평해지는 곳을 찾아보세요.</p>
          {appState !== 'LOBBY' && (
            <div className="flex items-center gap-2 font-korean">
              <span className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-full px-3 py-1">
                <Flag size={16} />
                {level} / {MAX_LEVEL}
              </span>
              <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1">
                <Star size={16} className="fill-amber-400 text-amber-500" />
                {score}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-[240px] relative">
          <BalanceBeamStage
            blocks={blocks}
            fulcrumPosition={fulcrumPosition}
            setFulcrumPosition={(p) => appState === 'PLAYING' && setFulcrumPosition(p)}
            onFulcrumDragStart={handleFulcrumDragStart}
            onFulcrumDragEnd={handleFulcrumDragEnd}
            appState={appState}
            average={average}
            hintLevel={hintLevel}
            hintVisible={isHintActive}
            showDragCue={level === 1 && !hasDragged}
          />

          {appState === 'LOBBY' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <button onClick={startGame} className={`${bigButton} bg-sky-600 hover:bg-sky-700 shadow-sky-200`}>
                <span className="flex items-center gap-3">
                  <Play size={26} fill="currentColor" />
                  시작
                </span>
                <span className="absolute inset-0 rounded-full ring-4 ring-sky-500/30 animate-pulse pointer-events-none" />
              </button>
            </div>
          )}

          {appState === 'ALL_CLEAR' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-white/75 backdrop-blur-[2px]">
              <Trophy size={88} className="text-amber-500 pop" />
              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={startGame} className={`${bigButton} bg-slate-500 hover:bg-slate-600 shadow-slate-200`}>
                  <span className="flex items-center gap-2">
                    <RotateCcw size={22} /> 처음부터
                  </span>
                </button>
                <button onClick={onGoActivity2} className={`${bigButton} bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200`}>
                  <span className="flex items-center gap-2">
                    활동 2 <ArrowRight size={22} />
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 조작 버튼 */}
        <div className="shrink-0 px-4 py-4 border-t border-slate-100 flex items-center justify-center gap-4 min-h-[88px]">
          {appState === 'PLAYING' && (
            <>
              {hintLevel > 0 && (
                <button
                  onClick={toggleHint}
                  aria-label="힌트"
                  className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                    isHintActive ? 'bg-amber-100 border-amber-400' : 'bg-white border-slate-300 hover:bg-amber-50'
                  }`}
                >
                  <Lightbulb size={26} className={isHintActive ? 'text-amber-500 fill-amber-300' : 'text-slate-400'} />
                </button>
              )}
              <button onClick={handleConfirm} className={`${bigButton} bg-sky-600 hover:bg-sky-700 shadow-sky-200`}>
                <span className="flex items-center gap-3">
                  <Scale size={24} />
                  확인
                </span>
              </button>
            </>
          )}

          {appState === 'EVALUATING' && (
            <div className="flex items-center gap-3 text-sky-600">
              <Scale size={30} className="animate-bounce" />
              <RotateCcw size={22} className="animate-spin" />
            </div>
          )}

          {appState === 'LEVEL_CLEAR' && (
            <button onClick={nextLevel} className={`${bigButton} bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200`}>
              <span className="flex items-center gap-3">
                {level >= MAX_LEVEL ? <Trophy size={24} /> : <ArrowRight size={24} />}
                {level >= MAX_LEVEL ? '완료' : '다음'}
              </span>
              <span className="absolute inset-0 rounded-full ring-4 ring-emerald-500/25 animate-pulse pointer-events-none" />
            </button>
          )}

          {teacherMode && (appState === 'PLAYING' || appState === 'GAME_OVER') && (
            <button
              onClick={() => {
                log('TEACHER_SKIP', `Level ${level} skipped`);
                nextLevel();
              }}
              className="h-12 px-4 rounded-full bg-slate-800 text-white text-sm font-bold flex items-center gap-2 hover:bg-slate-700"
            >
              <SkipForward size={18} className="text-amber-300" /> 교사: 다음 단계
            </button>
          )}

          {appState === 'GAME_OVER' && (
            <button onClick={retryLevel} className={`${bigButton} bg-amber-500 hover:bg-amber-600 shadow-amber-200`}>
              <span className="flex items-center gap-3">
                <RotateCcw size={24} />
                다시
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
