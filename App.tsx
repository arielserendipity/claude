import React, { useState, useRef, useMemo } from 'react';
import { CargoShipStage } from './components/CargoShipStage';
import { Block, AppState, LogEntry, DragLog } from './types';
import {
  Play,
  RotateCcw,
  Ship,
  FileDown,
  CheckCircle2,
  Bot,
  Lightbulb,
  Settings,
  HelpCircle,
  Copy,
  Check,
  Send,
  X,
} from 'lucide-react';

const COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
];

interface AIAnalysisResult {
  teacherLog: string;
  reasoningForNextStep: string;
  hintForStudent: string;
  activateVisualHint: boolean;
  blocksToAdd: number;
  forceInteger: boolean;
}

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fulcrumPosition, setFulcrumPosition] = useState(5.5);
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [isHintActive, setIsHintActive] = useState(false);

  // Failure tracking per level for adaptive hints (2회 이상 오답 시 힌트 제공)
  const [levelFailCount, setLevelFailCount] = useState(0);
  const [levelAttempts, setLevelAttempts] = useState(1);
  const [aiReasoning, setAiReasoning] = useState<string>(
    '초기 설정: 기본 난이도(화물 2개, 자연수 평균)로 시작합니다.'
  );
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [playerName, setPlayerName] = useState('');

  // Google Sheet Web App URL configuration
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(() => {
    return (
      localStorage.getItem('equilibrium_sheet_url') ||
      (import.meta as any).env.VITE_GOOGLE_SHEETS_URL ||
      ''
    );
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [sheetTestStatus, setSheetTestStatus] = useState<string | null>(null);

  // Interaction logs for current level
  const [currentLevelLogs, setCurrentLevelLogs] = useState<DragLog[]>([]);

  const currentDragStartRef = useRef<number>(0);
  const levelStartTimeRef = useRef<number>(0);

  // Log Reference (Global for CSV export)
  const logRef = useRef<LogEntry[]>([]);

  const addLog = (
    action: string,
    details: string = '',
    extraData?: Partial<LogEntry>
  ) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      playerName: playerName || 'Unknown',
      level,
      failCount: levelFailCount,
      action,
      details,
      ...extraData,
    };
    logRef.current.push(entry);

    // Google Sheets 연동
    const targetUrl = googleSheetUrl.trim();
    if (targetUrl) {
      fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      }).catch((err) => console.error('Sheet API error:', err));
    }
  };

  const handleSaveSheetUrl = (url: string) => {
    setGoogleSheetUrl(url);
    localStorage.setItem('equilibrium_sheet_url', url);
  };

  const handleTestSheet = () => {
    if (!googleSheetUrl.trim()) {
      setSheetTestStatus('URL을 먼저 입력해주세요.');
      return;
    }
    setSheetTestStatus('테스트 로그 전송 중...');
    const testEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      playerName: playerName || '교사_테스트',
      level,
      failCount: levelFailCount,
      action: 'SHEET_TEST',
      details: '구글 스프레드시트 연동 테스트 전송 성공',
      teacherLog: '테스트용 AI 진단 로그',
      reasoning: '테스트용 난이도 추천 사유',
      hint: '테스트용 힌트',
    };
    fetch(googleSheetUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEntry),
    })
      .then(() => {
        setSheetTestStatus('전송 완료! 스프레드시트에 행이 추가되었는지 확인해보세요.');
        setTimeout(() => setSheetTestStatus(null), 4000);
      })
      .catch((err) => {
        setSheetTestStatus(`오류 발생: ${err.message}`);
      });
  };

  const handleDownloadLog = () => {
    if (logRef.current.length === 0) {
      alert('기록된 활동 로그가 없습니다.');
      return;
    }

    const BOM = '\uFEFF';
    const csvHeader = 'Timestamp,PlayerName,Level,FailCount,Action,Details,TeacherLog,Reasoning,Hint\n';
    const csvRows = logRef.current
      .map((e) => {
        const safe = (str?: string) => (str || '').replace(/"/g, '""');
        return `${e.timestamp},"${safe(e.playerName)}",${e.level ?? ''},${
          e.failCount ?? ''
        },"${safe(e.action)}","${safe(e.details)}","${safe(e.teacherLog)}","${safe(
          e.reasoning
        )}","${safe(e.hint)}"`;
      })
      .join('\n');

    const csvContent = BOM + csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `equilibrium_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateNewBlocks = (
    currentBlocks: Block[],
    minBlocksToAdd: number,
    forceInteger: boolean,
    currentLevel: number
  ): Block[] => {
    const minVal = 1;
    const maxVal = 10;
    const currentSum = currentBlocks.reduce((acc, b) => acc + b.position, 0);

    let validOptions: { newSum: number; blocksCount: number; avg: number }[] = [];
    let actualBlocksToAdd = minBlocksToAdd;

    while (actualBlocksToAdd <= 10) {
      let totalCount = currentBlocks.length + actualBlocksToAdd;
      for (
        let newSum = actualBlocksToAdd * minVal;
        newSum <= actualBlocksToAdd * maxVal;
        newSum++
      ) {
        let totalSum = currentSum + newSum;
        let avg = totalSum / totalCount;
        let isInt = totalSum % totalCount === 0;
        let isHalf = (totalSum * 2) % totalCount === 0;

        if (forceInteger && isInt) {
          validOptions.push({ newSum, blocksCount: actualBlocksToAdd, avg });
        } else if (!forceInteger && (isInt || isHalf)) {
          validOptions.push({ newSum, blocksCount: actualBlocksToAdd, avg });
        }
      }
      if (validOptions.length > 0) break;
      actualBlocksToAdd++;
    }

    if (validOptions.length === 0) {
      return Array.from({ length: minBlocksToAdd }).map((_, idx) => ({
        id: `block-${Date.now()}-${idx}`,
        position: 5,
        weight: 1,
        color: COLORS[(currentBlocks.length + idx) % COLORS.length],
        isNew: true,
      }));
    }

    const prevAvg =
      currentBlocks.length > 0 ? currentSum / currentBlocks.length : 5.5;

    // 이전 정답과 멀리 떨어진 평균 위치를 채택하여 중심점이 극적으로 변하도록 유도
    validOptions.sort((a, b) => {
      const distB = Math.abs(b.avg - prevAvg) + Math.abs(b.avg - 5.5) * 0.1;
      const distA = Math.abs(a.avg - prevAvg) + Math.abs(a.avg - 5.5) * 0.1;
      return distB - distA;
    });

    const differentOptions = validOptions.filter(
      (o) => Math.abs(o.avg - prevAvg) >= 0.5
    );
    if (differentOptions.length > 0) {
      validOptions = differentOptions;
    }

    const topCandidates = validOptions.slice(
      0,
      Math.max(1, Math.floor(validOptions.length / 3))
    );
    const selectedOption =
      topCandidates[Math.floor(Math.random() * topCandidates.length)];

    let maxAttempts = 100;
    while (maxAttempts-- > 0) {
      let partition: number[] = [];
      let rSum = 0;
      let success = true;

      for (let i = 0; i < selectedOption.blocksCount - 1; i++) {
        const remaining = selectedOption.blocksCount - 1 - i;
        const minAllowed = Math.max(
          minVal,
          selectedOption.newSum - rSum - remaining * maxVal
        );
        const maxAllowed = Math.min(
          maxVal,
          selectedOption.newSum - rSum - remaining * minVal
        );

        if (minAllowed > maxAllowed) {
          success = false;
          break;
        }

        const val =
          Math.floor(Math.random() * (maxAllowed - minAllowed + 1)) + minAllowed;
        partition.push(val);
        rSum += val;
      }

      if (success) {
        const lastVal = selectedOption.newSum - rSum;
        if (lastVal >= minVal && lastVal <= maxVal) {
          partition.push(lastVal);
          return partition.map((pos, idx) => ({
            id: `block-${Date.now()}-${idx}-${pos}`,
            position: pos,
            weight: 1,
            color: COLORS[(currentBlocks.length + idx) % COLORS.length],
            isNew: true,
          }));
        }
      }
    }

    return Array.from({ length: selectedOption.blocksCount }).map((_, idx) => ({
      id: `block-${Date.now()}-${idx}`,
      position: Math.round(selectedOption.newSum / selectedOption.blocksCount),
      weight: 1,
      color: COLORS[(currentBlocks.length + idx) % COLORS.length],
      isNew: true,
    }));
  };

  const startGame = () => {
    setLevel(1);
    setScore(0);
    setLevelFailCount(0);
    setIsHintActive(false);
    setLevelAttempts(1);
    setCurrentLevelLogs([]);
    setAiReasoning('초기 설정: 기본 난이도(화물 2개, 자연수 평균)로 시작합니다.');
    setFulcrumPosition(5.5);
    const initialBlocks = generateNewBlocks([], 2, true, 1);
    setBlocks(initialBlocks);
    levelStartTimeRef.current = Date.now();
    setAppState('PLAYING');
    addLog('START_GAME', 'Level 1 started with 2 blocks');
  };

  const average = useMemo(() => {
    if (blocks.length === 0) return 0;
    const sum = blocks.reduce((acc, b) => acc + b.position, 0);
    return sum / blocks.length;
  }, [blocks]);

  const handleBlockMove = (id: string, newPos: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, position: newPos } : b))
    );
  };

  const handleBlockDragStart = (id: string, startPos: number) => {
    currentDragStartRef.current = Date.now();
  };

  const handleBlockDragEnd = (
    id: string,
    startPos: number,
    finalPos: number
  ) => {
    const duration = Date.now() - currentDragStartRef.current;
    if (startPos !== finalPos) {
      const logItem: DragLog = {
        action: 'DRAG_BLOCK',
        id,
        startPos,
        endPos: finalPos,
        durationMs: duration,
      };
      setCurrentLevelLogs((prev) => [...prev, logItem]);
      addLog(
        'DRAG_BLOCK',
        `Block ${id} moved ${startPos} -> ${finalPos} (${(
          duration / 1000
        ).toFixed(1)}s)`
      );
    }
  };

  const handleFulcrumDragStart = (startPos: number) => {
    currentDragStartRef.current = Date.now();
  };

  const handleFulcrumDragEnd = (startPos: number, finalPos: number) => {
    const duration = Date.now() - currentDragStartRef.current;
    if (startPos !== finalPos) {
      const logItem: DragLog = {
        action: 'DRAG_FULCRUM',
        startPos,
        endPos: finalPos,
        durationMs: duration,
      };
      setCurrentLevelLogs((prev) => [...prev, logItem]);
      addLog(
        'DRAG_FULCRUM',
        `Fulcrum moved ${startPos} -> ${finalPos} (${(
          duration / 1000
        ).toFixed(1)}s)`
      );
    }
    // 중요한 개선: 사용자가 부력 중심점을 조작하더라도 2회 이상 틀려 제공된 힌트는 지우지 않고 유지!
  };

  // Server-side Gemini API 호출
  const fetchAIAnalysis = async (
    isSuccess: boolean,
    logs: DragLog[],
    exploreSec: number,
    failCountForApi: number
  ): Promise<AIAnalysisResult | null> => {
    try {
      setIsAIAnalyzing(true);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName || '학생',
          level,
          levelFailCount: failCountForApi,
          isSuccess,
          explorationTimeSec: exploreSec,
          logs,
          blocks: blocks.map((b) => ({
            id: b.id,
            position: b.position,
            weight: b.weight,
          })),
          fulcrumPosition,
          average,
        }),
      });

      if (!res.ok) {
        throw new Error(`API response status ${res.status}`);
      }

      const data: AIAnalysisResult = await res.json();
      return data;
    } catch (err) {
      console.error('AI Analysis failed:', err);
      return null;
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    setAppState('EVALUATING');
    const isBalanced = Math.abs(average - fulcrumPosition) < 0.01;
    const explorationTime = Math.floor(
      (Date.now() - levelStartTimeRef.current) / 1000
    );

    const calculatedFailCount = isBalanced ? levelFailCount : levelFailCount + 1;
    if (!isBalanced) {
      setLevelFailCount(calculatedFailCount);
    }

    addLog(
      'CONFIRM_BALANCE',
      `Fulcrum: ${fulcrumPosition}, Average: ${average}, Balanced: ${isBalanced}, ExpTime: ${explorationTime}s, LevelFailCount: ${calculatedFailCount}`
    );

    // AI API 호출 (업데이트된 모델과 서버사이드 엔드포인트 연동)
    const aiPromise = fetchAIAnalysis(
      isBalanced,
      currentLevelLogs,
      explorationTime,
      calculatedFailCount
    );

    setTimeout(async () => {
      const aiResult = await aiPromise;

        if (!isBalanced) {
        // 실패 처리
        setAppState('GAME_OVER');
        addLog('GAME_OVER', `Level ${level} failed (Fail count: ${calculatedFailCount})`, {
          teacherLog: aiResult?.teacherLog,
          reasoning: aiResult?.reasoningForNextStep,
        });

        if (aiResult) {
          setAiReasoning(aiResult.teacherLog);
        }

        // 요구사항: 2회 이상 틀릴 경우 거리 곡선 힌트만 활성화
        if (calculatedFailCount >= 2 || (aiResult && aiResult.activateVisualHint)) {
          setIsHintActive(true);
        } else {
          setIsHintActive(false);
        }
      } else {
        // 성공 처리
        setAppState('LEVEL_CLEAR');
        setScore((s) => s + level * 100);
        addLog('LEVEL_CLEAR', `Level ${level} cleared on attempt ${levelAttempts}`, {
          teacherLog: aiResult?.teacherLog,
          reasoning: aiResult?.reasoningForNextStep,
        });

        if (aiResult) {
          const analysisString = `[분석] ${aiResult.teacherLog} | [조정 이유] ${aiResult.reasoningForNextStep}`;
          setAiReasoning(analysisString);

          (window as any).__nextLevelParams = {
            blocksToAdd: aiResult.blocksToAdd || 1,
            forceInteger: aiResult.forceInteger ?? true,
          };
        }
      }
    }, 2000);
  };

  const nextLevel = () => {
    if (level >= 10) {
      setAppState('ALL_CLEAR');
      addLog('ALL_CLEAR', `Game completed at level 10`);
      return;
    }

    const params = (window as any).__nextLevelParams || {
      blocksToAdd: 1,
      forceInteger: true,
    };

    addLog(
      'DIFFICULTY_SET',
      `Next Level => add: ${params.blocksToAdd}, isInteger: ${params.forceInteger}`
    );

    setLevel((l) => l + 1);
    setLevelFailCount(0); // 새 레벨 시작 시 오답 카운트 리셋
    setIsHintActive(false);
    setLevelAttempts(1);
    setCurrentLevelLogs([]);

    // 이전 블록 유지하고 새 블록 추가
    setBlocks((prev) => {
      const oldBlocks = prev.map((b) => ({ ...b, isNew: false }));
      const adds = generateNewBlocks(
        oldBlocks,
        params.blocksToAdd,
        params.forceInteger,
        level + 1
      );
      return [...oldBlocks, ...adds];
    });

    levelStartTimeRef.current = Date.now();
    setAppState('PLAYING');
    addLog('NEXT_LEVEL', `Level ${level + 1} started.`);
  };

  const retryLevel = () => {
    setAppState('PLAYING');
    // 재도전 시에도 2회 이상 오답자에게 제공된 힌트는 유지
    setLevelAttempts((a) => a + 1);
    levelStartTimeRef.current = Date.now();
    addLog(
      'RETRY_LEVEL',
      `Level ${level} retried (Cumulative fails: ${levelFailCount})`
    );
  };

  const toggleHint = () => {
    setIsHintActive((prev) => {
      const next = !prev;
      addLog('TOGGLE_HINT', `Hint toggled to ${next}`);
      return next;
    });
  };

  const handleFulcrumChange = (pos: number) => {
    if (appState === 'PLAYING') {
      setFulcrumPosition(pos);
    }
  };

  const googleAppsScriptCode = `// Google Apps Script (도구 > 스크립트 편집기에 붙여넣고 [웹 앱으로 배포]하세요)
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "일시(Timestamp)", 
        "학생이름(Player)", 
        "레벨(Level)", 
        "누적오답수(FailCount)", 
        "행동(Action)", 
        "상세내용(Details)", 
        "교사용AI분석(TeacherLog)", 
        "AI난이도조정사유(Reasoning)", 
        "제공된힌트(Hint)"
      ]);
    }
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.timestamp || new Date(),
      data.playerName || "Unknown",
      data.level !== undefined ? data.level : "",
      data.failCount !== undefined ? data.failCount : "",
      data.action || "",
      data.details || "",
      data.teacherLog || "",
      data.reasoning || "",
      data.hint || ""
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden">
      {/* Navbar */}
      <header className="bg-white shadow-sm p-3 px-6 flex justify-between items-center z-20 shrink-0 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Ship size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-korean font-bold text-slate-800">
              이퀼리브리엄 호{' '}
              <span className="text-sm font-normal text-slate-400 ml-1">
                평균의 바다
              </span>
            </h1>
          </div>
        </div>

        {appState !== 'LOBBY' && (
          <div className="flex items-center gap-6 font-bold text-slate-600">
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400">구역</span>
              <span className="text-lg text-blue-600">LEVEL {level}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400">오답 횟수</span>
              <span
                className={`text-lg font-bold ${
                  levelFailCount >= 2 ? 'text-amber-600' : 'text-slate-600'
                }`}
              >
                {levelFailCount}회
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400">점수</span>
              <span className="text-lg text-emerald-600">{score}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* 2회 이상 오답 시 거리 곡선 힌트 토글 버튼 */}
          {appState === 'PLAYING' && levelFailCount >= 2 && (
            <button
              onClick={toggleHint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                isHintActive
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-indigo-50'
              }`}
              title="거리 곡선 힌트 켜기/끄기"
            >
              <Lightbulb
                size={16}
                className={isHintActive ? 'text-indigo-600 fill-indigo-600' : 'text-slate-400'}
              />
              <span>{isHintActive ? '거리 곡선 숨기기' : '거리 곡선 보기'}</span>
            </button>
          )}

          {/* Log Download Button */}
          <button
            onClick={handleDownloadLog}
            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
          >
            <FileDown size={16} />
            <span className="hidden md:inline">로그 CSV</span>
          </button>

          {/* Teacher Settings Button */}
          <button
            onClick={() => setShowTeacherPanel(!showTeacherPanel)}
            className="p-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
            title="교사용 설정 및 AI 분석"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col relative w-full max-w-7xl mx-auto p-4 overflow-hidden gap-4">
        {/* The Workspace Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 w-full relative">
          {/* Stage Container */}
          <div className="flex-1 relative bg-white rounded-[2.5rem] shadow-xl border overflow-hidden flex flex-col transition-all duration-300 border-slate-200">
            {/* Stage Switcher */}
            <div className="flex-1 w-full min-h-0 relative">
              <CargoShipStage
                blocks={blocks}
                fulcrumPosition={fulcrumPosition}
                setFulcrumPosition={handleFulcrumChange}
                onBlockMove={handleBlockMove}
                onBlockDragStart={handleBlockDragStart}
                onBlockDragEnd={handleBlockDragEnd}
                onFulcrumDragStart={handleFulcrumDragStart}
                onFulcrumDragEnd={handleFulcrumDragEnd}
                appState={appState}
                isHintActive={isHintActive}
                average={average}
              />
            </div>

            {/* Bottom Controls */}
            <div className="shrink-0 pb-6 px-4 flex flex-col items-center justify-center z-10 bg-white pt-6 border-t border-slate-100 relative">
              {appState === 'LOBBY' && (
                <div className="flex flex-col items-center gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-4 w-full max-w-sm">
                    <label className="font-bold text-slate-700 font-korean text-lg text-center">
                      선원(학생) 이름 등록
                    </label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="학생 이름 입력 (예: 김바다)"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-center font-bold text-slate-800 transition-all outline-none"
                    />
                    <div className="text-xs text-slate-400 text-center">
                      * 출항 시 활동 및 탐구 분석 내용이 교사용 시트와 기록에 저장됩니다.
                    </div>
                  </div>
                  <button
                    onClick={startGame}
                    disabled={!playerName.trim()}
                    className="group relative px-12 py-4 rounded-full font-korean font-bold text-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-blue-100 bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center justify-center gap-3">
                      <Ship size={24} />
                      <span>출항하기 (게임 시작)</span>
                    </span>
                    {!playerName.trim() ? (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-sm text-red-500 font-bold whitespace-nowrap bg-red-50 px-3 py-1 rounded-full shadow-sm">
                        이름을 입력해주세요
                      </div>
                    ) : (
                      <div className="absolute inset-0 rounded-full ring-4 ring-blue-500/20 animate-pulse pointer-events-none"></div>
                    )}
                  </button>
                </div>
              )}

              {appState === 'PLAYING' && (
                <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
                  {levelFailCount >= 2 && (
                    <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-200 flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-indigo-500" />
                      <span>거리 곡선 힌트가 활성화되었습니다. (화물과 부력 중심점 사이의 거리를 확인해보세요)</span>
                    </div>
                  )}
                  <div className="flex gap-4">
                    <button
                      onClick={handleConfirm}
                      disabled={isAIAnalyzing}
                      className="flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all shadow-md bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {isAIAnalyzing ? (
                        <RotateCcw size={20} className="animate-spin" />
                      ) : (
                        <Play size={20} fill="currentColor" />
                      )}
                      <span>파도 맞서기 (균형 확인)</span>
                    </button>
                  </div>
                </div>
              )}

              {appState === 'EVALUATING' && (
                <div className="text-xl font-bold text-slate-600 animate-pulse flex items-center gap-3">
                  <RotateCcw size={24} className="animate-spin text-blue-500" />
                  {isAIAnalyzing ? 'AI 심층 탐구 분석 중...' : '파도와 맞서는 중...'}
                </div>
              )}

              {appState === 'LEVEL_CLEAR' && (
                <button
                  onClick={nextLevel}
                  className="group relative px-12 py-4 rounded-full font-korean font-bold text-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-emerald-100 bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-1"
                >
                  <span className="flex items-center justify-center gap-3">
                    <CheckCircle2 size={24} />
                    <span>{level >= 10 ? '항해 완료 (축하합니다!)' : '다음 해역으로 이동'}</span>
                  </span>
                  <div className="absolute inset-0 rounded-full ring-4 ring-emerald-500/20 animate-pulse"></div>
                </button>
              )}

              {appState === 'ALL_CLEAR' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-2xl font-bold text-emerald-600 mb-2">
                    모든 해역을 무사히 통과했습니다! 평균의 원리를 완벽하게 마스터하셨습니다.
                  </div>
                  <button
                    onClick={startGame}
                    className="group relative px-12 py-4 rounded-full font-korean font-bold text-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-blue-100 bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1"
                  >
                    <span className="flex items-center justify-center gap-3">
                      <RotateCcw size={24} />
                      <span>처음부터 다시 항해하기</span>
                    </span>
                  </button>
                </div>
              )}

              {appState === 'GAME_OVER' && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={retryLevel}
                    className="group relative px-12 py-4 rounded-full font-korean font-bold text-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-amber-100 bg-amber-600 text-white hover:bg-amber-700 hover:-translate-y-1"
                  >
                    <span className="flex items-center justify-center gap-3">
                      <RotateCcw size={24} />
                      <span>다시 도전하기</span>
                    </span>
                  </button>
                  {levelFailCount < 2 ? (
                    <div className="text-xs text-slate-500">
                      * 2회 이상 틀리면 거리 곡선 힌트가 활성화됩니다. (현재 {levelFailCount}회 오답)
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-indigo-700">
                      * 화면에 표시된 거리 곡선 힌트를 참고하여 부력 중심을 옮겨보세요!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Teacher's Comprehensive Settings & AI Modal */}
      {showTeacherPanel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            <div className="p-4 px-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-400" size={20} />
                <h2 className="font-bold text-lg font-korean text-white">
                  교사용 대시보드 & AI 분석 설정
                </h2>
              </div>
              <button
                onClick={() => setShowTeacherPanel(false)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
              {/* Section 1: Latest AI Pedagogical Reasoning */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 font-bold text-blue-900 mb-2">
                  <Bot size={16} className="text-blue-600" />
                  <span>실시간 학생 탐구 진단 및 난이도 설정 사유</span>
                </div>
                <p className="text-blue-950 whitespace-pre-wrap leading-relaxed">
                  {aiReasoning}
                </p>
                <div className="mt-3 pt-3 border-t border-blue-200/60 flex items-center justify-between text-xs text-blue-700">
                  <span>학생 이름: {playerName || '미등록'}</span>
                  <span>현재 레벨 오답: {levelFailCount}회</span>
                </div>
              </div>

              {/* Section 2: Google Sheets Integration */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <span>구글 스프레드시트 웹 앱 URL 연동</span>
                  </span>
                  <span className="text-xs text-slate-400">실시간 자동 전송</span>
                </div>
                <input
                  type="text"
                  value={googleSheetUrl}
                  onChange={(e) => handleSaveSheetUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleTestSheet}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                  >
                    <Send size={14} />
                    <span>연동 테스트 (샘플 행 전송)</span>
                  </button>
                  {sheetTestStatus && (
                    <span className="text-xs text-blue-600 font-bold">
                      {sheetTestStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Section 3: Google Apps Script Code Copy */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <HelpCircle size={15} className="text-slate-400" />
                    <span>Google Apps Script 연동 코드 (복사하여 시트에 배포)</span>
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(googleAppsScriptCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md"
                  >
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedCode ? '복사됨!' : '스크립트 코드 복사'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-40">
                  {googleAppsScriptCode}
                </pre>
                <p className="text-xs text-slate-500">
                  💡 구글 시트 상단 메뉴 [확장 프로그램] &gt; [Apps Script]에 위 코드를 붙여넣고 [배포] &gt; [새 배포] &gt; [웹 앱(액세스 권한: 모든 사용자)]으로 배포 후 생성된 URL을 위 입력창에 등록하면 모든 학생의 세부 조작 시간, AI 분석, 힌트 내역이 실시간 기록됩니다.
                </p>
              </div>
            </div>

            <div className="p-4 px-6 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowTeacherPanel(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;