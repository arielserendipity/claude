// 학생에게는 글 힌트를 주지 않는다. 힌트는 모두 두 그림 위의 "움직임/강조"로만 보인다.
export type HintKey =
  | 'MEAN_LINK' // 평균선 ↔ 받침점을 함께 반짝이고 화살표로 잇는다
  | 'EXCESS_TO_DISTANCE' // 막대의 넘친 칸 ↔ 추와 받침점 사이 거리(오른쪽)
  | 'DEFICIT_TO_GAP' // 추와 받침점 사이 거리(왼쪽) ↔ 막대 위 모자란 빈칸
  | 'SUM_BALANCE' // 왼쪽 거리들을 한 줄로, 오른쪽 거리들을 한 줄로 모아 길이 비교
  | 'LEVELING' // 넘친 칸이 날아가 모자란 칸을 채워 막대가 고르게 된다
  | 'CELLS_TO_DISTANCE'; // 막대 그림이 균형점 그림으로 바뀌며 칸이 거리가 되는 변신

export interface HintRef {
  key: HintKey;
  target?: number; // 강조할 자료값 (예: 9, 2)
}

export const HINT_KEYS: HintKey[] = [
  'MEAN_LINK',
  'EXCESS_TO_DISTANCE',
  'DEFICIT_TO_GAP',
  'SUM_BALANCE',
  'LEVELING',
  'CELLS_TO_DISTANCE',
];

// 교사용 설명 (학생 화면에는 나오지 않음)
export const HINT_TEACHER_DESC: Record<HintKey, string> = {
  MEAN_LINK: '평균선과 받침점을 동시에 반짝이고 화살표로 연결',
  EXCESS_TO_DISTANCE: '막대의 넘친 칸과 해당 추-받침점 거리(오른쪽)를 같은 주황색으로 강조·연결',
  DEFICIT_TO_GAP: '추-받침점 거리(왼쪽)와 막대 위 모자란 빈칸을 같은 파란색으로 강조·연결',
  SUM_BALANCE: '왼쪽 거리들과 오른쪽 거리들을 각각 한 줄로 이어 붙여 길이 비교',
  LEVELING: '넘친 칸이 모자란 칸으로 옮겨져 모든 막대가 평균 높이로 고르게 되는 애니메이션',
  CELLS_TO_DISTANCE: '막대 그림 → (눕히기) → 균형점 그림 변신 애니메이션, 칸이 거리로 바뀜',
};
