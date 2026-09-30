import React, { useState } from 'react';
import { Bot, Check, ChevronDown, ChevronRight, Copy, FileDown, KeyRound, Send, Trash2, X } from 'lucide-react';
import { LogEntry, TeacherNote } from '../types';
import { QUESTIONS, Verdict } from '../lib/questions';
import { HINT_TEACHER_DESC } from '../lib/hints';

export const TEACHER_TITLES = {
  A1: '활동 1 — 균형점 모델 예제 풀기',
  A2: '활동 2 — 균형점 모델과 막대 모델 연결하기',
};

const TEACHER_PIN: string = ((import.meta as any).env?.VITE_TEACHER_PIN as string) || '';

interface TeacherPanelProps {
  onClose: () => void;
  notes: TeacherNote[];
  logs: LogEntry[];
  playerName: string;
  sheetUrl: string;
  setSheetUrl: (url: string) => void;
  onClearDeviceData: () => void;
}

const VERDICT_STYLE: Record<Verdict, string> = {
  PASS: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIAL: 'bg-amber-100 text-amber-800 border-amber-300',
  RETRY: 'bg-sky-100 text-sky-800 border-sky-300',
};
const VERDICT_LABEL: Record<Verdict, string> = { PASS: '통과', PARTIAL: '부분', RETRY: '다시' };

const CSV_COLUMNS: [keyof LogEntry, string][] = [
  ['timestamp', 'Timestamp'],
  ['playerName', 'PlayerName'],
  ['activity', 'Activity'],
  ['level', 'Level'],
  ['failCount', 'FailCount'],
  ['action', 'Action'],
  ['details', 'Details'],
  ['questionId', 'QuestionId'],
  ['answer', 'Answer'],
  ['verdict', 'Verdict'],
  ['teacherLog', 'TeacherLog'],
  ['reasoning', 'Reasoning'],
  ['hint', 'Hint'],
];

export function downloadLogsCsv(logs: LogEntry[]) {
  if (logs.length === 0) {
    alert('기록된 활동 로그가 없습니다.');
    return;
  }
  const safe = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = CSV_COLUMNS.map(([, h]) => h).join(',');
  const rows = logs.map((e) => CSV_COLUMNS.map(([k]) => safe(e[k])).join(','));
  const blob = new Blob(['﻿' + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `average_activity_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const APPS_SCRIPT = `// Google Apps Script (확장 프로그램 > Apps Script 에 붙여넣고 [웹 앱으로 배포]하세요)
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "일시", "학생이름", "활동", "레벨", "누적오답수", "행동", "상세내용",
        "문항", "학생 답", "AI 판정", "교사용 AI 분석", "AI 난이도 조정 사유", "시각 힌트"
      ]);
    }
    var d = JSON.parse(e.postData.contents);
    sheet.appendRow([
      d.timestamp || new Date(), d.playerName || "Unknown", d.activity || "",
      d.level !== undefined ? d.level : "", d.failCount !== undefined ? d.failCount : "",
      d.action || "", d.details || "", d.questionId || "", d.answer || "",
      d.verdict || "", d.teacherLog || "", d.reasoning || "", d.hint || ""
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export function TeacherPanel({ onClose, notes, logs, playerName, sheetUrl, setSheetUrl, onClearDeviceData }: TeacherPanelProps) {
  const [unlocked, setUnlocked] = useState(!TEACHER_PIN);
  const [pin, setPin] = useState('');
  const [copied, setCopied] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<string | null>(null);
  const [showRubric, setShowRubric] = useState(false);
  const [filterMine, setFilterMine] = useState(false);

  const shownNotes = filterMine ? notes.filter((n) => n.playerName === playerName) : notes;

  const testSheet = () => {
    const url = sheetUrl.trim();
    if (!url) {
      setSheetStatus('URL을 먼저 입력해주세요.');
      return;
    }
    setSheetStatus('테스트 로그 전송 중...');
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      playerName: playerName || '교사_테스트',
      activity: 'A2',
      action: 'SHEET_TEST',
      details: '구글 스프레드시트 연동 테스트',
      questionId: 'q1',
      answer: '테스트 답안',
      verdict: 'PASS',
      teacherLog: '테스트용 AI 분석',
      hint: 'MEAN_LINK',
    };
    fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      .then(() => {
        setSheetStatus('전송 완료! 스프레드시트에 행이 추가되었는지 확인해보세요.');
        setTimeout(() => setSheetStatus(null), 4000);
      })
      .catch((err) => setSheetStatus(`오류 발생: ${err.message}`));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 px-6 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="text-sky-400" size={20} />
            <h2 className="font-korean text-lg">교사용 대시보드 · AI 분석</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {!unlocked ? (
          <form
            className="p-8 flex flex-col items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin === TEACHER_PIN) setUnlocked(true);
              else setPin('');
            }}
          >
            <KeyRound size={32} className="text-slate-400" />
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="교사 PIN"
              className="px-4 py-2 rounded-xl border-2 border-slate-200 text-center text-lg outline-none focus:border-sky-400"
            />
            <button className="px-5 py-2 rounded-xl bg-slate-800 text-white text-sm">확인</button>
          </form>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
            <section className="rounded-2xl border border-slate-200 p-4 bg-slate-50 space-y-1">
              <div className="font-bold text-slate-800">활동 구성 (학생 화면에는 “활동 1”, “활동 2”만 보입니다)</div>
              <div>{TEACHER_TITLES.A1}</div>
              <div>{TEACHER_TITLES.A2}</div>
              <div className="text-xs text-slate-500 pt-1">
                학생에게는 글 힌트가 나가지 않습니다. AI 판정은 ⭐(통과)·반쪽 별(부분)·🔍(다시)로만 보이고, 부족한 개념에 맞는 시각 힌트가 그림 위에서 자동 재생됩니다.
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <Bot size={16} className="text-sky-600" /> AI 분석 기록 ({shownNotes.length})
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" checked={filterMine} onChange={(e) => setFilterMine(e.target.checked)} />
                  현재 학생({playerName || '미등록'})만
                </label>
              </div>
              {shownNotes.length === 0 && <div className="text-slate-400 text-xs">아직 기록이 없습니다.</div>}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {shownNotes.map((n) => (
                  <div key={n.id} className="rounded-xl border border-slate-200 p-3 bg-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">{n.playerName}</span>
                      <span className="text-slate-600">{n.title}</span>
                      {n.verdict && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${VERDICT_STYLE[n.verdict]}`}>{VERDICT_LABEL[n.verdict]}</span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">{new Date(n.timestamp).toLocaleString('ko-KR')}</span>
                    </div>
                    {n.answer && <div className="mt-2 text-slate-800 bg-indigo-50 rounded-lg px-3 py-2 whitespace-pre-wrap">“{n.answer}”</div>}
                    <div className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">{n.body}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200">
              <button onClick={() => setShowRubric((v) => !v)} className="w-full flex items-center gap-2 p-4 font-bold text-slate-800">
                {showRubric ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                활동 2 문항 · 예시 답안 · 채점 기준 · 자동 시각 힌트
              </button>
              {showRubric && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="text-xs text-slate-500">기본 자료: 2, 3, 4, 4, 6, 7, 9 (평균 5) · 모자란 양 3+2+1+1=7, 넘친 양 1+2+4=7</div>
                  {QUESTIONS.map((q) => (
                    <div key={q.id} className="space-y-1">
                      <div className="font-bold">
                        {q.label}. {q.prompt}
                      </div>
                      <div className="text-slate-600">예시 답안: {q.modelAnswer}</div>
                      <ul className="list-disc pl-5 text-xs text-slate-500">
                        {q.ideas.map((i) => (
                          <li key={i.id}>
                            {i.teacher} → 빠지면: {HINT_TEACHER_DESC[i.hint]}
                            {i.hintTarget != null ? ` (자료 ${i.hintTarget})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">구글 스프레드시트 웹 앱 URL 연동</span>
                <span className="text-xs text-slate-400">모든 활동 기록을 실시간 전송</span>
              </div>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <div className="flex items-center justify-between gap-2">
                <button onClick={testSheet} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700">
                  <Send size={14} /> 연동 테스트
                </button>
                {sheetStatus && <span className="text-xs text-sky-700 font-bold">{sheetStatus}</span>}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Google Apps Script 연동 코드</span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(APPS_SCRIPT);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '복사됨!' : '코드 복사'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-40">{APPS_SCRIPT}</pre>
              <p className="text-xs text-slate-500">
                구글 시트 [확장 프로그램] &gt; [Apps Script]에 위 코드를 붙여넣고 [배포] &gt; [새 배포] &gt; [웹 앱(액세스: 모든 사용자)]으로 배포한 뒤, 생성된 URL을 위 입력창에 넣으세요.
                (이전 버전 시트를 쓰고 있다면 새 시트에서 다시 배포해야 열 이름이 맞습니다.)
              </p>
            </section>

            <section className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => downloadLogsCsv(logs)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
              >
                <FileDown size={16} /> 활동 로그 CSV ({logs.length})
              </button>
              <button
                onClick={() => {
                  if (confirm('이 기기에 저장된 모든 학생 기록(답안, AI 분석, 로그)을 지울까요?')) onClearDeviceData();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold hover:bg-rose-50"
              >
                <Trash2 size={16} /> 이 기기 기록 지우기
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
