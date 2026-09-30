export interface Block {
  id: string;
  position: number; // 1 to 10
  weight: number;   // Usually 1 for "Average" concepts
  color: string;
  isNew?: boolean;  // True if added in the current round
}

export type AppState = 'LOBBY' | 'PLAYING' | 'EVALUATING' | 'LEVEL_CLEAR' | 'GAME_OVER' | 'ALL_CLEAR';

export enum GameState {
  IDLE = 'IDLE',       // Editing mode (Flat)
  CHECKING = 'CHECKING', // Physics Active (Tilt based on calculation)
  BALANCED = 'BALANCED', // Visual state for perfect balance (subset of checking visually)
}

export interface LogEntry {
  timestamp: string;
  playerName?: string;
  level?: number;
  failCount?: number;
  action: string;
  details: string;
  teacherLog?: string;
  reasoning?: string;
  hint?: string;
}

export interface DragLog {
  action: 'DRAG_BLOCK' | 'DRAG_FULCRUM';
  id?: string;
  startPos: number;
  endPos: number;
  durationMs: number;
}
