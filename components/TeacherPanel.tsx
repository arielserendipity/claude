import React, { useState } from 'react';
import { Bot, Check, ChevronDown, ChevronRight, Copy, FileDown, KeyRound, Send, Trash2, X } from 'lucide-react';
import { LogEntry, TeacherNote } from '../types';
import { AI_GUIDE, PREDICT, STUDENT_LEVEL_GUIDE, TASKS, isPredictTask, promptFor } from '../lib/questions';
import { SUPPORT_LEVEL_LABEL, TEACHER_HELP_TEXT } from '../lib/hints';

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

const CSV_COLUMNS: [keyof LogEntry, string][] = [
  ['timestamp', 'Timestamp'],
  ['playerName', 'PlayerName'],
  ['activity', 'Activity'],
  ['level', 'Level'],
  ['failCount', 'FailCount'],
  ['action', 'Action'],
  ['details', 'Details'],
  ['taskId', 'Task'],
  ['answer', 'Answer'],
  ['context', 'Context'],
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
        "탐구 단계", "학생 응답", "응답 조건(JSON)", "교사용 분석", "난이도 조정 사유", "도움·힌트"
      ]);
    }
    var d = JSON.parse(e.postData.contents);
    sheet.appendRow([
      d.timestamp || new Date(), d.playerName || "Unknown", d.activity || "",
      d.level !== undefined ? d.level : "", d.failCount !== undefined ? d.failCount : "",
      d.action || "", d.details || "", d.taskId || "", d.answer || "",
      d.context || "", d.teacherLog || "", d.reasoning || "", d.hint || ""
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
      taskId: 'predictSeesaw',
      answer: '테스트 응답',
      context: JSON.stringify({ values: [2, 3, 4, 4, 6, 7, 9], p: 5 }),
      teacherLog: '테스트용 분석',
      hint: 'help1',
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
              <div className="text-xs text-slate-500 pt-1 leading-relaxed">
                활동 2에서 학생에게는 판정(별·통과)이 보이지 않습니다. 학생은 생각 저장하기 · 확인하기 · 생각 수정하기 · 다음 탐구로 진행하고,
                다음 탐구는 할 일을 마치면 열립니다. AI는 아래 기록에서 두 그림 연결의 증거(자료값 대응 · 차이 대응 · 근거로 사용)를 교사에게만 보고합니다.
                도움은 학생이 틀릴 때마다 한 단계씩({[1, 2, 3, 4].map((k) => SUPPORT_LEVEL_LABEL[k as 1 | 2 | 3 | 4]).join(' → ')}) 나타나고, 시점·종류·계기가 기록됩니다.
                틀림으로 보는 경우: 1·2번 예상이 결과와 다를 때(‘아직 모르겠어요’ 포함), 3번 ‘막대 그림에서’·‘시소 그림에서’에 평균이나 합이 빠졌을 때, 4번 바꾼 자료에서 시소가 기울 때.
                도움 1단계는 글만 나오고, 2단계부터 그림이 바뀝니다. 1번은 2단계에 시소 그림의 거리 곡선과 숫자, 3단계에 막대 그림의 칸이 더해지고, 2번은 2단계에 막대 그림의 칸, 3단계에 시소 그림의 거리 곡선과 숫자가 더해집니다. 3·4번은 2단계에 막대 그림의 칸과 시소 그림의 거리 곡선·숫자, 3단계에 막대 그림의 모자란 칸·넘친 칸과 시소 그림의 왼쪽·오른쪽 거리를 각각 한 줄로 모은 합 비교가 더해집니다. 시소 그림에서는 곡선과 숫자를 보여 줄 때 칸 막대를 걷습니다.
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
                      {n.check && <span className="text-xs px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">교사 확인 필요</span>}
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
                활동 2 탐구 구성 · 살펴볼 것 · 도움 단계
              </button>
              {showRubric && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="text-xs text-slate-500">
                    1번·4번 자료(3번의 ‘처음 자료’): 2, 3, 4, 4, 6, 7, 9 (평균 5). 초록색 4: 넘침 10 · 모자람 3 / 5: 7 · 7 / 6: 4 · 11.
                    <br />
                    2번 자료: 3, 4, 5, 8, 10 (평균 6). 초록색 4: 넘침 11 · 모자람 1 / 6: 6 · 6 / 7: 4 · 9. 초록 선(기준선)·받침점은 평균이 아닌 곳에도 놓일 수 있습니다.
                    <br />
                    같은 자료는 처음부터 같은 색·이름표로 이어 보여 줍니다. 확인하기는 정오 판정 없이 가려 둔 그림을 보여 줍니다.
                  </div>
                  <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 px-3 py-2">
                    <div className="text-xs font-bold text-indigo-700 mb-1">AI 분석 프롬프트에 들어간 ‘초등학생 기준’</div>
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{STUDENT_LEVEL_GUIDE}</pre>
                  </div>
                  {TASKS.map((t) => (
                    <div key={t.id} className="space-y-1">
                      <div className="font-bold">
                        {t.label}. {t.title}
                      </div>
                      <div className="text-slate-700">발문: {isPredictTask(t.id) ? promptFor(t, PREDICT[t.id].rounds[0]) : t.prompt}</div>
                      {t.steps.map((s) => (
                        <div key={s.id} className="text-xs text-slate-600">
                          · [{s.title}] {s.ask}
                        </div>
                      ))}
                      <div className="text-xs text-slate-500">의도: {t.goal}</div>
                      <div className="text-xs text-slate-500">살펴볼 것: {t.look}</div>
                      <div className="text-xs text-indigo-700">AI에게 알려 준 기준(초등학생 기준): {AI_GUIDE[t.id]}</div>
                      <ol className="list-decimal pl-5 text-xs text-slate-500">
                        {t.help.map((h, k) => (
                          <li key={k}>
                            {SUPPORT_LEVEL_LABEL[(k + 1) as 1 | 2 | 3]}: {h}
                          </li>
                        ))}
                        <li>
                          {SUPPORT_LEVEL_LABEL[4]}: {TEACHER_HELP_TEXT}
                        </li>
                      </ol>
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
