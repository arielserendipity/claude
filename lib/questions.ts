// 활동 2: 균형점 모델(시소 그림)과 막대 모델(막대 그림) 연결하기
// '정해진 설명을 쓰고 통과하기'가 아니라 '관찰하고, 예상하고, 관계를 확인하기'로 진행한다.
// 학생에게는 판정을 보여 주지 않는다. 분석(연결의 증거)은 교사용 기록에만 남는다.

import { supportLabel } from './hints';

// 활동 2 기본 자료 (합 35, 7개 → 평균 5)
export const DEFAULT_VALUES = [2, 3, 4, 4, 6, 7, 9];

export type TaskId = 'explore' | 'match' | 'predict' | 'change' | 'summary';

// 다른 그림 예상하기에서 시소의 모습
export type Tilt = 'left' | 'flat' | 'right';
export type Choice = Tilt | 'unsure';

export const CHOICE_LABEL: Record<Choice, string> = {
  left: '왼쪽이 내려가요',
  flat: '평평해요',
  right: '오른쪽이 내려가요',
  unsure: '아직 모르겠어요',
};

export const PREDICT_ROUNDS = [4, 5, 6] as const;
export const CHANGE_P = 5;

export interface TaskStep {
  id: string;
  title: string; // 기록 칸 이름
  ask: string; // 학생에게 보이는 발문
}

export interface TaskDef {
  id: TaskId;
  label: string;
  title: string;
  prompt: string; // 첫 발문
  steps: TaskStep[]; // 글로 쓰는 칸 (선택·예상 같은 다른 응답은 화면에서 따로 받음)
  goal: string; // 교사용: 무엇을 보려는 활동인지
  look: string; // 교사용: 반응에서 살펴볼 것
  help: [string, string, string]; // 도움 1(탐색 질문)·2(대상 제안)·3(대응 보여 주기 설명)
}

export const TASKS: TaskDef[] = [
  {
    id: 'explore',
    label: '1',
    title: '움직이며 살펴보기',
    prompt: '초록색의 위치를 여러 곳으로 옮겨 보세요. 두 그림에서 바뀌는 것과 그대로인 것을 찾아보세요.',
    steps: [
      { id: 'observe', title: '바뀐 것과 그대로인 것', ask: '초록 선을 옮겼을 때 바뀐 것은 무엇이고, 그대로인 것은 무엇인가요?' },
      { id: 'level', title: '모두 같은 높이로', ask: '이 막대들을 모두 같은 높이로 만들려면 어떻게 해야 할까요?' },
    ],
    goal: '관찰(초록색을 옮길 때 바뀌는 것·그대로인 것)과 재분배(막대를 고르게 만드는 방법)를 따로 묻는다.',
    look:
      '관찰: 막대 높이(자료값)는 그대로이고, 초록 선 위·아래 칸과 시소의 기울기가 바뀐다. 재분배: 높은 막대에서 떼어 낮은 막대를 채운다(모두 5). 초록 선은 아직 평균을 뜻하지 않으므로 “막대 높이는 그대로”라는 관찰도 정확한 관찰이다.',
    help: [
      '초록색을 옮기면서 두 그림을 번갈아 보세요. 어느 부분이 달라지나요?',
      '막대 하나를 골라, 초록색을 옮길 때 그 막대와 초록 선 사이가 어떻게 되는지 살펴보세요.',
      '칸 표시와 같은 자료 강조를 켰어요. 두 그림에서 같은 자료를 비교해 보세요.',
    ],
  },
  {
    id: 'match',
    label: '2',
    title: '같은 자료 찾아보기',
    prompt: '막대 하나를 골라 보세요. 이 자료는 다른 그림에서 어디에 나타나나요? 그렇게 생각한 까닭을 표시해 보세요.',
    steps: [
      { id: 'reason', title: '그렇게 생각한 까닭', ask: '고른 막대와 추가 같은 자료라고 생각한 까닭을 써 보세요.' },
      { id: 'reflect', title: '확인한 뒤', ask: '예상과 같았나요? 생각이 달라졌다면 무엇 때문인가요?' },
    ],
    goal: '두 그림에서 같은 자료(막대 하나 ↔ 추 하나)를 학생이 스스로 찾는지 본다. 같은 색·이름표·동시 강조는 짝을 확인한 뒤에 보여 준다.',
    look: '막대 높이(자료값)와 시소 눈금 위 추의 위치를 같은 수로 잇는지, 그 까닭을 수·위치로 말하는지.',
    help: [
      '어느 부분을 보고 그렇게 생각했나요?',
      '고른 막대의 높이(수)를 보고, 시소 그림의 눈금에서 같은 수를 찾아보세요.',
      '같은 자료를 같은 색으로 보여 주고, 막대 그림이 시소 그림으로 바뀌는 모습을 보여 줄게요.',
    ],
  },
  {
    id: 'predict',
    label: '3',
    title: '다른 그림 예상하기',
    prompt: '시소 그림을 잠깐 가릴게요. 초록색이 4에 있을 때 시소가 어떻게 될지 예상해 보세요. 막대 그림에서 도움이 된 부분도 표시해 보세요.',
    steps: [
      { id: 'reason', title: '까닭 (쓰고 싶으면)', ask: '그렇게 예상한 까닭이 있으면 짧게 써 보세요.' },
      { id: 'reflect', title: '확인한 뒤', ask: '예상과 같았나요? 생각이 달라졌다면 무엇 때문인가요?' },
    ],
    goal: '막대 그림만 보고 시소의 모습을 예상하게 해, 막대 그림의 넘침·모자람을 시소의 오른쪽·왼쪽 거리와 대응시켜 근거로 쓰는지 본다. 4·5·6을 비교하면 무엇끼리 대응하는지와 언제 양쪽 합이 같아지는지를 구별할 수 있다.',
    look:
      '기준 4: 넘침 10 = 오른쪽 거리 10, 모자람 3 = 왼쪽 거리 3 → 오른쪽이 내려감. 기준 5: 모두 7 → 평평. 기준 6: 넘침 4, 모자람 11 → 왼쪽이 내려감. 예상의 근거로 넘침과 모자람을 비교했는지.',
    help: [
      '어느 부분을 보고 그렇게 예상했나요?',
      '초록 선 위로 넘친 부분과 아래로 모자란 부분을 비교해 보세요.',
      '막대 그림에 칸을 표시했어요. 넘친 칸과 모자란 칸을 세어 비교해 보세요.',
    ],
  },
  {
    id: 'change',
    label: '4',
    title: '자료를 바꾸어 시험하기',
    prompt: '받침점은 5에 그대로 두세요. 자료 두 개를 바꾼 뒤에도 시소가 평평해지게 해 보세요. 바꾸기 전에 방법을 예상해 보세요.',
    steps: [
      { id: 'method', title: '바꾸기 전 예상', ask: '어떻게 바꾸면 시소가 계속 평평할까요? 바꾸기 전에 방법을 예상해 써 보세요.' },
      { id: 'reflect', title: '해 본 뒤', ask: '예상한 방법과 같았나요? 해 보면서 알게 된 것을 써 보세요.' },
    ],
    goal: '받침점(5)을 고정한 채 자료를 바꾸며, 한쪽이 늘어난 만큼 다른 쪽을 줄여야 평평해진다(넘침 합 = 모자람 합 유지)는 관계를 시험하는지 본다.',
    look: '바꾸기 전 방법 예상, 바꾼 자료(전후), 결과(평평한지), 늘린 만큼 줄이는 보상 관계를 말하는지.',
    help: [
      '어느 부분을 보고 그렇게 생각했나요?',
      '자료 하나를 올리면 시소가 어느 쪽으로 기우는지 보고, 다른 자료로 되돌려 보세요.',
      '칸 표시와 양쪽 거리의 합을 보여 줄게요. 양쪽을 비교해 보세요.',
    ],
  },
  {
    id: 'summary',
    label: '5',
    title: '발견한 관계 정리하기',
    prompt: '막대 그림에서 알아낸 것으로 시소의 모습을 예상할 수 있었나요? 도움이 된 부분을 두 그림에 표시하고 설명해 보세요.',
    steps: [{ id: 'explain', title: '설명', ask: '두 그림에서 표시한 부분이 어떻게 이어지는지 설명해 보세요.' }],
    goal: '두 그림을 함께 설명할 기회. 처음 생각(1~4)과 최종 설명을 비교한다.',
    look: '표시한 부분(막대·추)과 설명에서 자료값 대응, 기준과의 차이 대응, 대응을 예상의 근거로 쓰는지.',
    help: [
      '어느 부분을 보고 그렇게 생각했나요?',
      '3번에서 예상이 맞았거나 틀렸던 까닭을 떠올려 보세요.',
      '같은 자료 강조와 칸 표시를 켜고, 막대 그림이 시소 그림으로 바뀌는 모습을 보여 줄게요.',
    ],
  },
];

export const TASK_BY_ID: Record<TaskId, TaskDef> = Object.fromEntries(TASKS.map((t) => [t.id, t])) as Record<TaskId, TaskDef>;

// ---------------------------------------------------------------------------
// 계산: 평균과의 차이, 현재 기준(초록색)과의 차이, 시소의 모습
// ---------------------------------------------------------------------------
const EPS = 1e-9;
export const meanOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// 시소의 모습: 기준 p에서 오른쪽(자료값 > p) 거리의 합과 왼쪽 거리의 합을 비교
export function tiltAt(values: number[], p: number): Tilt {
  const d = values.reduce((a, v) => a + (v - p), 0);
  if (Math.abs(d) < EPS) return 'flat';
  return d > 0 ? 'right' : 'left';
}

export function sidesAt(values: number[], p: number) {
  const over = values.filter((v) => v > p + EPS).reduce((a, v) => a + (v - p), 0);
  const under = values.filter((v) => v < p - EPS).reduce((a, v) => a + (p - v), 0);
  return { over, under }; // over = 넘침 = 오른쪽 거리의 합, under = 모자람 = 왼쪽 거리의 합
}

// ---------------------------------------------------------------------------
// 연결의 증거 분석 (교사용). AI가 없거나 실패하면 아래 규칙 분석을 '참고용'으로 쓴다.
// ---------------------------------------------------------------------------
export type EvidenceLevel = 'yes' | 'partial' | 'no' | 'na';
export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = { yes: '나타남', partial: '일부', no: '보이지 않음', na: '해당 없음' };

export interface AnalysisInput {
  taskId: TaskId;
  step: string; // 응답한 칸 (observe, level, reason, reflect, predict, method, explain, match ...)
  kind: 'first' | 'revised';
  text: string; // 학생 글 (여러 칸이면 '[칸 이름] 글' 줄로 이어 붙임)
  values: number[];
  p: number; // 응답할 때 실제 초록색 위치
  round?: number; // 다른 그림 예상하기의 기준 (4·5·6)
  prediction?: Choice;
  revealed?: boolean; // 결과(시소)를 본 뒤의 응답인지
  picks?: { bars: number[]; weights: number[] }; // 학생이 표시한 막대·추 (자료 번호)
  match?: { bar: number; weight: number };
  before?: number[]; // 자료를 바꾸기 전 (자료 바꾸기)
  supportsSeen?: string[]; // 응답 전에 실제로 본 도움·강조·애니메이션
}

export interface Analysis {
  dataMatch: EvidenceLevel; // 자료값의 대응 (막대 하나 ↔ 추 하나, 같은 수)
  deviationMatch: EvidenceLevel; // 기준값과의 차이 대응 (넘침·모자람 ↔ 오른쪽·왼쪽 거리)
  usedAsEvidence: EvidenceLevel; // 그 대응을 예상·설명의 근거로 사용
  evidence: string; // 판단 근거가 되는 학생의 말이나 표시
  teacherCheck: boolean; // 교사 확인 필요
  flags: string[];
  teacherLog: string;
  suggestedSupport: string; // 다음에 줄 만한 도움 (교사용 제안, 자동으로 보여 주지 않음)
  source: 'ai' | 'rule';
}

export function normalizeAnswer(s: string) {
  return s
    .replace(/(시소|균형점|막대)\s*그림/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// '모르겠어요', '몰라' 같은 짧은 답
export function isDontKnow(answer: string) {
  const a = answer.replace(/\s+/g, '');
  return a.length <= 15 && /(모르|몰라|몰루|몰랑|글쎄|잘\s*모|패스|pass|\?{2,})/i.test(a);
}

// 대응 방향: 한 마디(절) 안에서 넘침·모자람이 오른쪽·왼쪽 중 어디와 함께 쓰였는지 본다.
// 넘친 것을 왼쪽에, 모자란 것을 오른쪽에 이으면 '뒤집힘'으로 보고 교사 확인을 요청한다.
const CLAUSE_SPLIT = /[.,!?\n;]|이고|이며|그리고|하고|지만|는데/;
const OVER = /(넘|위로|높)/;
const UNDER = /(모자|부족|아래로|낮)/;
function mappingDirection(text: string) {
  let forward = false;
  let reversed = false;
  for (const c of text.split(CLAUSE_SPLIT)) {
    const right = /오른/.test(c);
    const left = /왼/.test(c);
    if (right === left) continue; // 한 절에 양쪽이 다 있거나 둘 다 없으면 판단하지 않음
    const over = OVER.test(c);
    const under = UNDER.test(c);
    if (over === under) continue;
    if ((over && right) || (under && left)) forward = true;
    else reversed = true;
  }
  return { forward, reversed };
}
const BAR_SIDE = /(넘|모자|부족|위로|아래로|높|낮|칸)/;
const BEAM_SIDE = /(거리|떨어|오른|왼|받침|기울|내려)/;
const SAME_VALUE = /(같은\s*(수|값|자리|위치|높이|눈금)|높이[^.,]{0,10}(자리|위치|눈금)|눈금|[0-9]\s*(에|자리|위치))/;
const UP = '(올리|올려|늘리|늘려|더하|더해|크게|높이|높여)';
const DOWN = '(내리|내려|줄이|줄여|빼|작게|낮추|낮춰)';
const COMPENSATE = new RegExp(`(${UP}.{0,18}${DOWN}|${DOWN}.{0,18}${UP}|같은\\s*만큼|그만큼|똑같이\\s*(바꾸|움직))`);
const COMPARE = /(넘|모자|부족|많|적|크|작|비교|무거|가벼)/;

export function ruleAnalyze(input: AnalysisInput): Analysis {
  const text = normalizeAnswer(input.text);
  const flags: string[] = [];
  const empty = !text || isDontKnow(text);
  if (empty) flags.push('글 응답이 비었거나 “모르겠어요”');

  const { forward, reversed } = mappingDirection(text);
  if (reversed) flags.push('넘침·모자람과 오른쪽·왼쪽의 대응이 뒤집혔을 수 있음');

  // 자료값의 대응
  let dataMatch: EvidenceLevel = 'na';
  const evidenceBits: string[] = [];
  if (input.match) {
    const vb = input.values[input.match.bar];
    const vw = input.values[input.match.weight];
    dataMatch = vb === vw ? 'yes' : 'no';
    evidenceBits.push(`고른 막대 ${vb} ↔ 고른 추 ${vw}`);
    if (vb !== vw) flags.push(`막대(${vb})와 다른 자료의 추(${vw})를 짝지음`);
  } else if (input.taskId === 'match' || input.taskId === 'summary') {
    dataMatch = SAME_VALUE.test(text) ? 'partial' : 'no';
  } else if (SAME_VALUE.test(text)) {
    dataMatch = 'partial';
  }
  if (input.picks && input.taskId === 'summary') {
    const bv = input.picks.bars.map((i) => input.values[i]);
    const wv = input.picks.weights.map((i) => input.values[i]);
    if (bv.length && wv.length) {
      evidenceBits.push(`표시한 막대 [${bv.join(', ')}] · 추 [${wv.join(', ')}]`);
      if (bv.some((v) => wv.includes(v)) && dataMatch !== 'yes') dataMatch = 'partial';
    }
  }

  // 기준값과의 차이 대응
  let deviationMatch: EvidenceLevel = 'no';
  if (forward && !reversed) deviationMatch = 'yes';
  else if (BAR_SIDE.test(text) && BEAM_SIDE.test(text)) deviationMatch = 'partial';
  if (input.taskId === 'match' && deviationMatch === 'no') deviationMatch = 'na';

  // 그 대응을 근거로 사용
  let usedAsEvidence: EvidenceLevel = 'na';
  if (input.taskId === 'predict') {
    const marked = (input.picks?.bars.length ?? 0) > 0;
    if (input.prediction === 'unsure' || (!marked && !COMPARE.test(text))) usedAsEvidence = 'no';
    else usedAsEvidence = marked && COMPARE.test(text) ? 'yes' : 'partial';
    if (input.picks?.bars.length) evidenceBits.push(`예상 근거로 표시한 막대 [${input.picks.bars.map((i) => input.values[i]).join(', ')}]`);
    if (input.prediction) evidenceBits.push(`예상: ${CHOICE_LABEL[input.prediction]} (기준 ${input.round ?? input.p}, 실제: ${CHOICE_LABEL[tiltAt(input.values, input.p)]})`);
  } else if (input.taskId === 'change') {
    usedAsEvidence = COMPENSATE.test(text) ? 'yes' : COMPARE.test(text) ? 'partial' : 'no';
    if (input.before) evidenceBits.push(`바꾸기 전 [${input.before.join(', ')}] → 후 [${input.values.join(', ')}], 시소: ${CHOICE_LABEL[tiltAt(input.values, input.p)]}`);
  } else if (input.taskId === 'summary') {
    usedAsEvidence = /(예상|알\s*수|보면|보고)/.test(text) && COMPARE.test(text) ? 'partial' : 'no';
  }

  const quote = text.slice(0, 80);
  if (quote) evidenceBits.unshift(`“${quote}${text.length > 80 ? '…' : ''}”`);

  const teacherCheck = reversed || (input.taskId === 'match' && dataMatch === 'no') || (empty && input.step !== 'reason');
  if (input.supportsSeen?.length) flags.push(`응답 전 본 도움: ${input.supportsSeen.map(supportLabel).join(', ')}`);

  const suggestedSupport =
    deviationMatch === 'no' && input.taskId !== 'match'
      ? '도움 2(살펴볼 대상 제안): 초록 선 위로 넘친 부분과 아래로 모자란 부분을 두 그림에서 비교하게 하기'
      : dataMatch === 'no'
        ? '도움 2(살펴볼 대상 제안): 막대 높이의 수를 시소 눈금에서 찾게 하기'
        : '추가 도움 없이 다음 탐구로';

  return {
    dataMatch,
    deviationMatch,
    usedAsEvidence,
    evidence: evidenceBits.join(' / '),
    teacherCheck,
    flags,
    teacherLog: `[규칙 분석·참고용] 자료값 대응 ${EVIDENCE_LABEL[dataMatch]}, 차이 대응 ${EVIDENCE_LABEL[deviationMatch]}, 근거로 사용 ${EVIDENCE_LABEL[usedAsEvidence]}.${
      reversed ? ' 대응이 뒤집힌 표현이 있어 교사 확인이 필요합니다.' : ''
    }`,
    suggestedSupport,
    source: 'rule',
  };
}
