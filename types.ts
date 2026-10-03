import type { TaskId } from './lib/questions';

export interface Block {
  id: string;
  position: number; // 0 to 10 (저울대 위 위치)
  weight: number; // 추의 무게 (모두 1)
  color: string; // hex
  isNew?: boolean; // True if added in the current round
}

export type AppState = 'LOBBY' | 'PLAYING' | 'EVALUATING' | 'LEVEL_CLEAR' | 'GAME_OVER' | 'ALL_CLEAR';

export type Screen = 'HOME' | 'ACTIVITY1' | 'ACTIVITY2';

export type ActivityId = 'A1' | 'A2';

export interface LogEntry {
  timestamp: string;
  playerName?: string;
  activity?: ActivityId | '';
  level?: number;
  failCount?: number;
  action: string;
  details: string;
  taskId?: TaskId | ''; // 활동 2 탐구 단계
  answer?: string; // 학생 응답 (글·선택)
  context?: string; // 응답 당시의 조건 (JSON): 제출 차수, 자료값, 실제 초록색 위치, 예상·공개 시점, 표시한 부분, 응답 전에 본 도움 등
  teacherLog?: string;
  reasoning?: string;
  hint?: string; // 실제로 제공·재생한 도움이나 힌트
}

export type AddLog = (action: string, details?: string, extraData?: Partial<LogEntry>) => void;

export interface DragLog {
  action: 'DRAG_BLOCK' | 'DRAG_FULCRUM';
  id?: string;
  startPos: number;
  endPos: number;
  durationMs: number;
}

// 활동 1에서 균형을 맞춘 문제 (활동 2에서 막대 그림으로 불러오기)
export interface SolvedProblem {
  level: number;
  values: number[];
  mean: number;
  solvedAt: string;
}

// 교사용 대시보드에만 보이는 분석 기록 (학생에게는 판정을 보여 주지 않음)
export interface TeacherNote {
  id: string;
  timestamp: string;
  playerName: string;
  activity: ActivityId;
  title: string;
  body: string;
  answer?: string;
  check?: boolean; // 교사 확인 필요
}
