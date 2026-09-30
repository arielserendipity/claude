import React, { useCallback, useEffect, useRef, useState } from 'react';
import { House, Scale, Settings, UserRound } from 'lucide-react';
import { Activity1 } from './activities/Activity1';
import { Activity2 } from './activities/Activity2';
import { Home } from './components/Home';
import { TeacherPanel } from './components/TeacherPanel';
import { AddLog, LogEntry, Screen, SolvedProblem, TeacherNote } from './types';
import { removeStoredByPrefix, useStoredState } from './lib/storage';

const MAX_LOGS = 3000;
const MAX_NOTES = 300;

function App() {
  const [screen, setScreen] = useState<Screen>('HOME');
  const [visited, setVisited] = useState<{ A1: boolean; A2: boolean }>({ A1: false, A2: false });
  const [playerName, setPlayerName] = useStoredState<string>('avg_player_name', '');
  const [sheetUrl, setSheetUrl] = useStoredState<string>(
    'equilibrium_sheet_url',
    ((import.meta as any).env?.VITE_GOOGLE_SHEETS_URL as string) || ''
  );
  const [solved, setSolved] = useStoredState<SolvedProblem[]>(`avg_solved_${playerName.trim()}`, []);
  const [notes, setNotes] = useStoredState<TeacherNote[]>('avg_teacher_notes', []);
  const [logs, setLogs] = useStoredState<LogEntry[]>('avg_activity_logs', []);
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);

  const name = playerName.trim();
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
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-korean">
              <UserRound size={16} /> {name}
            </span>
          )}
          <button
            onClick={() => setShowTeacherPanel(true)}
            className="p-2 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            aria-label="교사용"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {screen === 'HOME' && (
        <Home playerName={playerName} setPlayerName={changeName} solvedProblems={solved} onOpen={(n) => open(n === 1 ? 'ACTIVITY1' : 'ACTIVITY2')} />
      )}

      {visited.A1 && name && (
        <div className={screen === 'ACTIVITY1' ? 'flex-1 min-h-0 flex' : 'hidden'}>
          <Activity1
            key={`a1-${name}`}
            playerName={name}
            addLog={addLog}
            onTeacherNote={addTeacherNote}
            onSolved={addSolved}
            onGoActivity2={() => open('ACTIVITY2')}
          />
        </div>
      )}

      {visited.A2 && name && (
        <div className={screen === 'ACTIVITY2' ? 'flex-1 min-h-0 flex' : 'hidden'}>
          <Activity2 key={`a2-${name}`} playerName={name} addLog={addLog} onTeacherNote={addTeacherNote} solvedProblems={solved} />
        </div>
      )}

      {showTeacherPanel && (
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
