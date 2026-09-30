import type { DragLog } from '../types';

// 활동 1은 학생이 기다리지 않도록 AI 대신 이 규칙으로 바로 진단하고 다음 단계 난이도를 정한다.

export interface Activity1Attempt {
  level: number;
  failCount: number; // 이번 단계에서 지금까지 틀린 횟수 (이번 시도 포함)
  isSuccess: boolean;
  explorationSec: number;
  logs: DragLog[]; // 이번 단계의 받침점 조작 기록
  positions: number[];
  fulcrum: number;
  average: number;
}

export interface Activity1Analysis {
  teacherLog: string;
  reasoningForNextStep: string;
  showVisualHint: boolean;
  blocksToAdd: number;
  forceInteger: boolean;
}

const fmt = (x: number) => String(parseFloat(x.toFixed(2)));
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function dragPattern(logs: DragLog[]) {
  const drags = logs.filter((l) => l.action === 'DRAG_FULCRUM');
  if (drags.length === 0) return '받침점을 움직이지 않고 확인함';
  let turns = 0;
  let prevDir = 0;
  for (const d of drags) {
    const dir = Math.sign(d.endPos - d.startPos);
    if (prevDir && dir && dir !== prevDir) turns++;
    if (dir) prevDir = dir;
  }
  return `받침점을 ${drags.length}번 옮김${turns >= 2 ? `(좌우로 ${turns}번 방향을 바꾸며 탐색)` : ''}`;
}

// 자주 보이는 오개념: 가장 작은 값과 큰 값의 가운데, 또는 가운데 놓인 추를 균형점으로 생각함
function misconception(a: Activity1Attempt) {
  if (a.isSuccess || a.positions.length === 0) return '';
  const midRange = (Math.min(...a.positions) + Math.max(...a.positions)) / 2;
  if (same(a.fulcrum, midRange) && !same(midRange, a.average)) {
    return ' 가장 왼쪽 추와 가장 오른쪽 추의 한가운데를 균형점으로 생각했을 가능성이 있음.';
  }
  const med = median(a.positions);
  if (same(a.fulcrum, med) && !same(med, a.average)) {
    return ' 가운데 놓인 추(중앙값)의 위치를 균형점으로 생각했을 가능성이 있음.';
  }
  return '';
}

export function analyzeActivity1(a: Activity1Attempt): Activity1Analysis {
  const diff = a.fulcrum - a.average;
  const result = a.isSuccess
    ? `균형을 맞춤(받침점 ${fmt(a.fulcrum)})`
    : `받침점(${fmt(a.fulcrum)})이 평균(${fmt(a.average)})보다 ${fmt(Math.abs(diff))}칸 ${diff > 0 ? '오른쪽' : '왼쪽'} — 이번 단계 오답 ${a.failCount}회`;

  let note = '';
  if (a.isSuccess && a.failCount === 0 && a.explorationSec < 15) note = ' 첫 시도에 빠르게 해결함.';
  else if (a.isSuccess && a.failCount >= 2) note = ' 거리 시각 힌트가 열린 뒤 해결함.';
  else note = misconception(a);

  const teacherLog = `[규칙 진단] ${a.level}단계: ${a.explorationSec}초 탐구, ${dragPattern(a.logs)}. ${result}.${note}`;

  if (!a.isSuccess) {
    return {
      teacherLog,
      reasoningForNextStep: '같은 단계를 다시 풀며 추와 받침점 사이 거리 관계를 살피게 함.',
      showVisualHint: a.failCount >= 2,
      blocksToAdd: 1,
      forceInteger: true,
    };
  }

  // 한 번에 빨리 풀면 추를 2개 더하고, 5단계부터 한 번에 풀면 평균이 0.5 단위인 문제도 낸다
  const fast = a.failCount === 0 && a.explorationSec < 20;
  const allowHalf = a.level >= 5 && a.failCount === 0;
  return {
    teacherLog,
    reasoningForNextStep: `${fast ? '빠르게 해결하여 추 2개 추가' : '추 1개 추가'}, ${allowHalf ? '평균이 0.5 단위일 수 있음' : '평균은 자연수'}.`,
    showVisualHint: false,
    blocksToAdd: fast ? 2 : 1,
    forceInteger: !allowHalf,
  };
}
