import React, { useState } from 'react';
import { BookOpenCheck, Compass } from 'lucide-react';
import { Activity2 } from './Activity2';
import { PreActivity } from './PreActivity';
import { AddLog, SolvedProblem, TeacherNote } from '../types';

// ---------------------------------------------------------------------------
// 활동 2 껍데기: 왼쪽 위에 '사전 활동' / '본 활동'을 크게 보여 준다.
// - 본 활동(Activity2)은 그대로 두고, 두 화면을 모두 켜 둔 채 가리기만 해서 탭을 오가도 진행이 남는다.
// - 사전 활동은 본 활동 전에 두 그림에 익숙해지는 시간(변환 애니메이션 보기, 내 자료 마음대로 만져 보기).
// ---------------------------------------------------------------------------

type Tab = 'pre' | 'main';

interface Activity2ShellProps {
  playerName: string;
  teacherMode: boolean;
  addLog: AddLog;
  onTeacherNote: (note: Omit<TeacherNote, 'id' | 'timestamp' | 'playerName'>) => void;
  a1Supports: string[];
  solvedProblems: SolvedProblem[];
}

export function Activity2Shell(props: Activity2ShellProps) {
  const { addLog, solvedProblems } = props;
  const [tab, setTab] = useState<Tab>('pre');

  const go = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    addLog('A2_TAB', t === 'pre' ? '사전 활동' : '본 활동', { activity: 'A2' });
  };

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => {
    const active = tab === t;
    return (
      <button
        key={t}
        role="tab"
        aria-selected={active}
        onClick={() => go(t)}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl border-2 font-korean text-lg transition-all active:scale-95 ${
          active
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col">
      <div role="tablist" aria-label="활동 2" className="shrink-0 w-full max-w-[1500px] mx-auto px-3 md:px-4 pt-3 flex items-center gap-2">
        {tabBtn('pre', '사전 활동', <Compass size={22} />)}
        {tabBtn('main', '본 활동', <BookOpenCheck size={22} />)}
      </div>
      <div className={tab === 'pre' ? 'flex-1 min-h-0 flex' : 'hidden'}>
        <PreActivity addLog={addLog} solvedProblems={solvedProblems} />
      </div>
      <div className={tab === 'main' ? 'flex-1 min-h-0 flex' : 'hidden'}>
        <Activity2 {...props} />
      </div>
    </div>
  );
}
