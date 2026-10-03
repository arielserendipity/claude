// 두 모델(막대 그림·시소 그림)에서 같은 자료는 같은 색으로 보여서
// 학생이 색만 보고도 "이 막대 = 이 추"를 연결할 수 있게 한다.
export const ITEM_COLORS = [
  '#f472b6', // pink
  '#a78bfa', // violet
  '#facc15', // yellow
  '#2dd4bf', // teal
  '#fb7185', // rose
  '#818cf8', // indigo
  '#a3e635', // lime
  '#c084fc', // purple
  '#fbbf24', // amber
  '#94a3b8', // slate
];

export const ITEM_STROKES = [
  '#be185d',
  '#6d28d9',
  '#a16207',
  '#0f766e',
  '#be123c',
  '#4338ca',
  '#4d7c0f',
  '#7e22ce',
  '#b45309',
  '#334155',
];

export const ITEM_LABELS = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차'];

export const itemColor = (i: number) => ITEM_COLORS[i % ITEM_COLORS.length];
export const itemStroke = (i: number) => ITEM_STROKES[i % ITEM_STROKES.length];
export const itemLabel = (i: number) => ITEM_LABELS[i % ITEM_LABELS.length];

// 의미 색: 넘친 양(받침점 오른쪽) = 주황, 모자란 양(받침점 왼쪽) = 파랑, 평균 = 초록
export const EXCESS = { fill: '#fdba74', stroke: '#ea580c', strong: '#f97316' };
export const DEFICIT = { fill: '#bae6fd', stroke: '#0284c7', strong: '#0ea5e9' };
export const MEAN = { stroke: '#16a34a', fill: '#dcfce7', strong: '#22c55e' };
export const BEAM = { fill: '#d6a26c', stroke: '#8b5a2b', text: '#5b3a1a' };
