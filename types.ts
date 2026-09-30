import type { QuestionId, Verdict } from './lib/questions';

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
  questionId?: QuestionId | '';
  answer?: string;
  verdict?: Verdict | '';
  teacherLog?: string;
  reasoning?: string;
  hint?: string;
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

// 교사용 대시보드에만 보이는 AI 분석 기록
export interface TeacherNote {
  id: string;
  timestamp: string;
  playerName: string;
  activity: ActivityId;
  title: string;
  body: string;
  verdict?: Verdict;
  answer?: string;
}
