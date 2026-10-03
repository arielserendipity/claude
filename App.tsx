import React, { useCallback, useEffect, useRef, useState } from 'react';
import { House, Scale, Settings, UserRound } from 'lucide-react';
import { Activity1 } from './activities/Activity1';
import { Activity2 } from './activities/Activity2';
import { Home } from './components/Home';
import { TeacherPanel } from './components/TeacherPanel';
import { AddLog, LogEntry, Screen, SolvedProblem, TeacherNote } from './types';
import { clearOldProgress, clearSession, removeStoredByPrefix, useSessionState, useStoredState } from './lib/storage';
import { isTeacherName } from './lib/teacher';

const MAX_LOGS = 3000;
const MAX_NOTES = 300;

// 새로고침하면 학생 진행은 처음부터. 예전 버전이 기기에 남긴 진행도 지운다 (기기 기록은 그대로).
clearOldProgress();

function App() {
  const [screen, setScreen] = useState<Screen>('HOME');
  const [visited, setVisited] = useState<{ A1: boolean; A2: boolean }>({ A1: false, A2: false });
  const [playerName, setPlayerName] = useSessionState<string>('avg_player_name', '');
  const [sheetUrl, setSheetUrl] = useStoredState<string>(
    'equilibrium_sheet_url',
    ((import.meta as any).env?.VITE_GOOGLE_SHEETS_URL as string) || ''
  );
  const [solved, setSolved] = useSessionState<SolvedProblem[]>(`avg_solved_${playerName.trim()}`, []);
  // 활동 1에서 본 시각 힌트 (활동 2 응답의 지원 이력에 함께 남긴다)
  const [a1Supports, setA1Supports] = useSessionState<string[]>(`avg_a1sup_${playerName.trim()}`, []);
  const [notes, setNotes] = useStoredState<TeacherNote[]>('avg_teacher_notes', []);
  const [logs, setLogs] = useStoredState<LogEntry[]>('avg_activity_logs', []);
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);

  const name = playerName.trim();
  const teacherMode = isTeacherName(name);
  const nameRef = useRef(name);
  const sheetUrlRef = useRef(sheetUrl);
  useEffect(() => {
    nameRef.current = name;
    sheetUrlRef.current = sheetUrl;
  }, [name, sheetUrl]);

  const addLog: AddLog = useCallback(
    (action, details = '', extraData) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        playerName: nameRef.current || 'Unknown',
        action,
        details,
        ...extraData,
      };
      setLogs((prev) => [...prev, entry].slice(-MAX_LOGS));

      const targetUrl = sheetUrlRef.current.trim();
      if (targetUrl) {
        fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        }).catch((err) => console.error('Sheet API error:', err));
      }
    },
    [setLogs]
  );

  const addTeacherNote = useCallback(
    (note: Omit<TeacherNote, 'id' | 'timestamp' | 'playerName'>) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      setNotes((prev) =>
        [{ ...note, id, timestamp: new Date().toISOString(), playerName: nameRef.current || '학생' }, ...prev].slice(0, MAX_NOTES)
      );
    },
    [setNotes]
  );

  const addA1Support = useCallback(
    (kind: string) => setA1Supports((prev) => (prev.includes(kind) ? prev : [...prev, kind])),
    [setA1Supports]
  );

  const addSolved = useCallback(
    (problem: SolvedProblem) => setSolved((prev) => [...prev.filter((s) => s.level !== problem.level), problem]),
    [setSolved]
  );

  const open = (target: Screen) => {
    if (target !== 'HOME' && !name) return;
    setScreen(target);
    if (target === 'ACTIVITY1') setVisited((v) => ({ ...v, A1: true }));
    if (target === 'ACTIVITY2') setVisited((v) => ({ ...v, A2: true }));
    addLog('OPEN_SCREEN', target, { activity: target === 'ACTIVITY1' ? 'A1' : target === 'ACTIVITY2' ? 'A2' : '' });
  };

  const changeName = (next: string) => {
    setPlayerName(next);
    // 다른 학생이 이어서 쓰면 진행 중인 활동 화면은 새로 시작한다
    setVisited({ A1: false, A2: false });
  };

  const clearDeviceData = () => {
    removeStoredByPrefix('avg_');
    clearSession();
    setPlayerName('');
    setNotes([]);
    setLogs([]);
    setSolved([]);
    setVisited({ A1: false, A2: false });
    setScreen('HOME');
  };

  const title = screen === 'ACTIVITY1' ? '활동 1' : screen === 'ACTIVITY2' ? '활동 2' : '';

  return (
    <div className="h-[100dvh] bg-sky-50 flex flex-col text-slate-800 overflow-hidden">
      <header className="bg-white shadow-sm px-4 md:px-6 py-2.5 flex justify-between items-center z-20 shrink-0 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {screen === 'HOME' ? (
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
              <Scale size={22} />
            </div>
          ) : (
            <button
              onClick={() => open('HOME')}
              aria-label="처음 화면"
              className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
            >
              <House size={22} />
            </button>
          )}
          {title && <h1 className="text-2xl font-korean text-slate-800">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
          {name && screen !== 'HOME' && (
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-korean ${
                teacherMode ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <UserRound size={16} /> {teacherMode ? '교사 미리보기' : name}
            </span>
          )}
          {/* 교사용 대시보드(기록·로그)는 교사 코드를 이름으로 넣었을 때만 보인다 */}
          {teacherMode && (
            <button
              onClick={() => setShowTeacherPanel(true)}
              className="p-2 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              aria-label="교사용"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </header>

      {screen === 'HOME' && (
        <Home playerName={playerName} setPlayerName={changeName} solvedProblems={solved} onOpen={(n) => open(n === 1 ? 'ACTIVITY1' : 'ACTIVITY2')} />
      )}

      {visited.A1 && name && (
        <div className={screen === 'ACTIVITY1' ? 'flex-1 min-h-0 flex' : 'hidden'}>
          <Activity1
            key={`a1-${name}`}
            teacherMode={teacherMode}
            addLog={addLog}
            onTeacherNote={addTeacherNote}
            onSolved={addSolved}
            onSupportSeen={addA1Support}
            onGoActivity2={() => open('ACTIVITY2')}
          />
        </div>
      )}

      {visited.A2 && name && (
        <div className={screen === 'ACTIVITY2' ? 'flex-1 min-h-0 flex' : 'hidden'}>
          <Activity2 key={`a2-${name}`} playerName={name} teacherMode={teacherMode} addLog={addLog} onTeacherNote={addTeacherNote} a1Supports={a1Supports} />
        </div>
      )}

      {teacherMode && showTeacherPanel && (
        <TeacherPanel
          onClose={() => setShowTeacherPanel(false)}
          notes={notes}
          logs={logs}
          playerName={name}
          sheetUrl={sheetUrl}
          setSheetUrl={setSheetUrl}
          onClearDeviceData={clearDeviceData}
        />
      )}
    </div>
  );
}

export default App;
