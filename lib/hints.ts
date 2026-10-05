// 시각 힌트: 두 그림 위의 "움직임/강조". 활동 2에서는 처음부터 재생하지 않고,
// 학생이 틀려서 도움이 3단계(대응을 보여 주는 도움)까지 올라갔을 때만 재생한다.
export type HintKey =
  | 'MEAN_LINK' // 초록 선 ↔ 받침점을 함께 반짝이고 화살표로 잇는다
  | 'EXCESS_TO_DISTANCE' // 막대의 넘친 칸 ↔ 추와 받침점 사이 거리(오른쪽)
  | 'DEFICIT_TO_GAP' // 추와 받침점 사이 거리(왼쪽) ↔ 막대 위 모자란 빈칸
  | 'SUM_BALANCE' // 양쪽 합 비교: 막대 그림은 부족한 칸·넘친 칸을, 시소 그림은 왼쪽·오른쪽 거리를 각각 한 줄로 모아 길이 비교 + 거리 곡선·숫자
  | 'DISTANCE_CURVES' // 시소 그림에서 받침점(초록색)부터 각 추까지의 거리를 곡선과 숫자로
  | 'LEVELING' // 넘친 칸이 날아가 모자란 칸을 채워 막대가 고르게 된다
  | 'CELLS_TO_DISTANCE'; // 막대 그림이 시소 그림으로 바뀌며 칸이 거리가 되는 변신

export interface HintRef {
  key: HintKey;
  target?: number; // 강조할 자료값 (예: 9, 2)
}

export const HINT_KEYS: HintKey[] = [
  'MEAN_LINK',
  'EXCESS_TO_DISTANCE',
  'DEFICIT_TO_GAP',
  'SUM_BALANCE',
  'DISTANCE_CURVES',
  'LEVELING',
  'CELLS_TO_DISTANCE',
];

// 교사용 설명 (학생 화면에는 나오지 않음)
export const HINT_TEACHER_DESC: Record<HintKey, string> = {
  MEAN_LINK: '초록 선과 받침점을 동시에 반짝이고 화살표로 연결',
  EXCESS_TO_DISTANCE: '막대의 넘친 칸과 해당 추-받침점 거리(오른쪽)를 같은 주황색으로 강조·연결',
  DEFICIT_TO_GAP: '추-받침점 거리(왼쪽)와 막대 위 모자란 빈칸을 같은 파란색으로 강조·연결',
  SUM_BALANCE:
    '막대 그림: 모자란 칸들과 넘친 칸들을 각각 한 줄로 이어 붙여 길이·합 비교 / 시소 그림: 왼쪽 거리들과 오른쪽 거리들을 각각 한 줄로 이어 붙여 길이·합 비교, 받침점에서 각 추까지의 거리를 곡선과 숫자로 표시',
  DISTANCE_CURVES: '시소 그림에서 받침점(초록색)부터 각 추까지의 거리를 곡선과 숫자로 표시 (왼쪽 파랑, 오른쪽 주황)',
  LEVELING: '넘친 칸이 모자란 칸으로 옮겨져 모든 막대가 고르게 되는 애니메이션 (초록색이 평균에 있을 때만)',
  CELLS_TO_DISTANCE: '막대 그림 → (눕히기) → 시소 그림 변신 애니메이션, 칸이 거리로 바뀜',
};

// ---------------------------------------------------------------------------
// 도움의 정도 (활동 2). 학생이 틀릴 때마다 한 단계씩 올라가고, 제공 시점·종류·계기를 기록한다.
// 1·2단계는 생각할 거리를 주는 질문(답을 알려 주지 않음), 3단계는 대응을 보여 주는 그림 도움,
// 4단계는 선생님이 학생의 사례로 관계를 함께 정리한다.
// ---------------------------------------------------------------------------
export type SupportLevel = 1 | 2 | 3 | 4;
export const MAX_SUPPORT_LEVEL: SupportLevel = 4;
export const SUPPORT_LEVEL_LABEL: Record<SupportLevel, string> = {
  1: '일반적인 탐색 질문',
  2: '살펴볼 대상 제안',
  3: '대응을 보여 주는 도움',
  4: '관계 설명(교사)',
};
export const TEACHER_HELP_TEXT = '선생님을 불러 함께 이야기해 보세요.';

// 응답 전에 학생이 실제로 본 것(지원 이력)에 남기는 이름
export type SupportKind =
  | 'help1'
  | 'help2'
  | 'help3'
  | 'help4'
  | 'cells' // 칸(넘침·모자람 / 거리) 표시
  | 'morph' // 막대 그림 → 시소 그림 변환 애니메이션
  | 'reveal' // 가려 둔 그림(시소 그림 또는 막대 그림) 공개
  | `hint:${HintKey}`
  | `a1:${string}`; // 활동 1에서 본 시각 힌트

export const SUPPORT_KIND_LABEL: Record<string, string> = {
  help1: '도움1 탐색 질문',
  help2: '도움2 대상 제안',
  help3: '도움3 대응 보여 주기',
  help4: '도움4 선생님',
  cells: '칸 표시',
  morph: '변환 애니메이션',
  reveal: '가려 둔 그림 공개',
  'hint:SUM_BALANCE': '시각 힌트 양쪽 합 비교(막대·시소)와 거리 곡선·숫자',
  'hint:DISTANCE_CURVES': '시각 힌트 거리 곡선·숫자',
};

export const supportLabel = (k: string) =>
  SUPPORT_KIND_LABEL[k] ?? (k.startsWith('hint:') ? `시각 힌트 ${k.slice(5)}` : k.startsWith('a1:') ? `활동 1 힌트(${k.slice(3)})` : k);
