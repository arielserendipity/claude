// 활동 2: 균형점 모델(시소 그림)과 막대 모델(막대 그림) 연결하기
// '정해진 설명을 쓰고 통과하기'가 아니라 '다른 그림을 예상하고, 자료를 바꾸어 시험하고, 내 자료로 확인하기'로 진행한다.
// 학생에게는 판정을 보여 주지 않는다. 분석(연결의 증거)은 교사용 기록에만 남는다.

import { supportLabel } from './hints';

// 활동 2 기본 자료 (합 35, 7개 → 평균 5)
export const DEFAULT_VALUES = [2, 3, 4, 4, 6, 7, 9];

export type TaskId = 'predictSeesaw' | 'predictBars' | 'change' | 'custom';
export type PredictTaskId = 'predictSeesaw' | 'predictBars';
export const isPredictTask = (id: TaskId): id is PredictTaskId => id === 'predictSeesaw' || id === 'predictBars';

// 시소 그림 예상하기(막대 그림을 보고): 시소의 모습
export type Tilt = 'left' | 'flat' | 'right';
export type Choice = Tilt | 'unsure';

export const CHOICE_LABEL: Record<Choice, string> = {
  left: '왼쪽이 내려가요',
  flat: '평평해요',
  right: '오른쪽이 내려가요',
  unsure: '아직 모르겠어요',
};

// 막대 그림 예상하기(시소 그림을 보고): 초록 선 위로 넘친 부분과 초록 선까지 모자란 부분 비교
export type BarSides = 'over' | 'equal' | 'under';
export type BarChoice = BarSides | 'unsure';

export const BAR_CHOICE_LABEL: Record<BarChoice, string> = {
  over: '넘친 부분이 더 많아요',
  equal: '넘친 부분과 모자란 부분이 같아요',
  under: '모자란 부분이 더 많아요',
  unsure: '아직 모르겠어요',
};

export type Prediction = Choice | BarChoice;
export const PREDICTIONS: Prediction[] = ['left', 'flat', 'right', 'over', 'equal', 'under', 'unsure'];
export const predictionLabel = (x: Prediction) => (x in CHOICE_LABEL ? CHOICE_LABEL[x as Choice] : BAR_CHOICE_LABEL[x as BarChoice]);

// 막대 그림 예상하기의 자료: 1번에서 이미 본 막대 그림을 기억으로 답하지 않도록 다른 자료를 쓴다 (합 30, 5개 → 평균 6)
export const REVERSE_VALUES = [3, 4, 5, 8, 10];

export interface PredictSet {
  values: number[];
  rounds: number[]; // 초록색의 위치 (차례대로)
  hide: 'balance' | 'bars'; // 가려 두는 그림
}

export const PREDICT: Record<PredictTaskId, PredictSet> = {
  predictSeesaw: { values: DEFAULT_VALUES, rounds: [4, 5, 6], hide: 'balance' },
  predictBars: { values: REVERSE_VALUES, rounds: [4, 6, 7], hide: 'bars' },
};

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
  prompt: string; // 첫 발문 ({p}는 그때의 초록색 위치)
  steps: TaskStep[]; // 글로 쓰는 칸 (예상 고르기는 화면에서 따로 받음)
  goal: string; // 교사용: 무엇을 보려는 활동인지 (근거 연구)
  look: string; // 교사용: 반응에서 살펴볼 것
  help: [string, string, string]; // 틀릴 때마다 한 단계씩: 도움 1(탐색 질문)·2(대상 제안)·3(대응 보여 주기 설명)
}

// 설계 근거 (README '활동 2 설계 근거' 참고)
// - 표상 전환은 방향을 바꾸면 전혀 다른 과제가 된다(Duval, 2006) → 막대→시소, 시소→막대 두 방향으로 예상한다.
// - 같은 자료를 같은 색으로 잇는 것은 연결을 돕는 단서다(Ainsworth, 2006; Renkl 외, 2013) → 자료값 대응은 처음부터 색으로 보여 주고,
//   학생의 생각은 기준과의 차이(넘침·모자람 ↔ 오른쪽·왼쪽 거리)와 그 관계(양쪽 합이 같으면 평평)에 쓰게 한다(Post & Prediger, 2024).
// - 학생이 먼저 판단을 남기고, 출력은 정오 판정 대신 그 판단이 가리키는 그림 자체를 바꾸어 보여 준다(시각 피드백의 설계 조건).
// - 균형을 지키며 자료 옮기기, 평균이 같은 다른 자료 찾기(O'Dell, 2012; Van de Walle 외), 모든 자료에서도 그럴까(Peters 외, 2016).
export const TASKS: TaskDef[] = [
  {
    id: 'predictSeesaw',
    label: '1',
    title: '시소 그림 예상하기',
    prompt: '시소 그림을 잠깐 가릴게요. 초록색이 {p}에 있을 때 시소가 어떻게 될지 막대 그림을 보고 예상해 보세요.',
    steps: [
      { id: 'reason', title: '까닭', ask: '그렇게 예상한 까닭을 써 보세요.' },
      {
        id: 'reflect',
        title: '세 번 해 본 뒤',
        ask: '막대 그림의 무엇을 보면 시소가 어떻게 될지 알 수 있나요? 예상과 달랐던 적이 있다면 무엇 때문이었는지도 써 보세요.',
      },
    ],
    goal:
      '막대 그림 → 시소 그림으로 바꾸어 생각하기(표상 전환, Duval 2006). 학생이 먼저 예상을 남기고, 확인하면 판정 대신 가려 둔 시소가 실제로 기운다. 4·5·6을 차례로 비교하면 무엇끼리 대응하는지와 언제 양쪽이 같아지는지를 구별할 수 있다.',
    look:
      '기준 4: 넘침 10 = 오른쪽 거리 10, 모자람 3 = 왼쪽 거리 3 → 오른쪽이 내려감. 기준 5: 모두 7 → 평평. 기준 6: 넘침 4, 모자람 11 → 왼쪽이 내려감. 정리 글에서 넘친 부분과 모자란 부분의 비교를 시소의 기울기와 잇는지, 예상과 결과가 달랐을 때 무엇을 고쳐 생각했는지.',
    help: [
      '어느 부분을 보고 그렇게 예상했나요?',
      '초록 선 위로 넘친 부분과 초록 선까지 모자란 부분을 비교해 보세요.',
      '막대 그림에 칸을 표시했어요. 넘친 칸과 모자란 칸을 세어 비교해 보세요.',
    ],
  },
  {
    id: 'predictBars',
    label: '2',
    title: '막대 그림 예상하기',
    prompt:
      '이번에는 새 자료예요. 막대 그림을 잠깐 가릴게요. 초록색이 {p}에 있을 때, 시소 그림을 보고 막대 그림을 예상해 보세요. 초록 선 위로 넘친 부분과 초록 선까지 모자란 부분 중 어느 쪽이 더 많을까요?',
    steps: [
      { id: 'reason', title: '까닭', ask: '그렇게 예상한 까닭을 써 보세요.' },
      {
        id: 'reflect',
        title: '세 번 해 본 뒤',
        ask: '시소 그림의 무엇을 보면 막대 그림을 예상할 수 있나요? 1번에서 알아낸 것과 비교해 보세요.',
      },
    ],
    goal:
      '반대 방향의 전환(시소 그림 → 막대 그림). 표상 전환은 방향을 바꾸면 쉬운 과제가 어려운 과제가 될 수 있어(Duval 2006) 두 방향을 모두 해 본다. 1번에서 막대 그림을 이미 보았으므로 다른 자료(3, 4, 5, 8, 10, 평균 6)를 쓴다.',
    look:
      '기준 4: 오른쪽 거리 11, 왼쪽 거리 1 → 넘친 부분이 더 많음 (자료 4는 받침점 위). 기준 6: 6과 6 → 같음. 기준 7: 오른쪽 4, 왼쪽 9 → 모자란 부분이 더 많음. 시소가 기운 쪽이나 양쪽 거리를 막대 그림의 넘침·모자람으로 옮기는지, 오른쪽↔넘침·왼쪽↔모자람이 뒤집히지 않는지, 1번과 비교해 두 방향을 같은 관계로 말하는지.',
    help: [
      '어느 부분을 보고 그렇게 예상했나요?',
      '받침점 오른쪽 추들과 왼쪽 추들이 받침점에서 얼마나 떨어져 있는지 살펴보세요.',
      '시소 그림에 받침점부터 각 추까지의 거리를 곡선과 숫자로 표시했어요. 오른쪽 숫자들과 왼쪽 숫자들을 비교해 보세요.',
    ],
  },
  {
    id: 'custom',
    label: '3',
    title: '나만의 자료로 확인하기',
    prompt:
      "그림 위 '새로운 자료'를 눌러 막대나 추를 놓아 나만의 자료를 만들어 보세요(활동 1에서 푼 문제를 불러와도 되고, 평균이 자연수가 되게 만들면 쉬워요). 1·2번에서 알아낸 것을 막대 그림과 시소 그림에서 각각 다시 확인해 보세요.",
    steps: [
      { id: 'bar', title: '막대 그림에서', ask: '내 자료와 평균을 쓰고, 초록색을 평균에 두었을 때 넘친 칸의 합과 모자란 칸의 합을 구해 보세요.' },
      { id: 'beam', title: '시소 그림에서', ask: '초록색을 평균에 두었을 때 시소가 어떻게 되는지 쓰고, 오른쪽 거리의 합과 왼쪽 거리의 합을 구해 보세요.' },
      { id: 'link', title: '두 그림을 이어 보면', ask: '처음 자료와 비교해 보세요. 자료가 바뀌어도 두 그림에서 똑같이 나타나는 것은 무엇인가요?' },
    ],
    goal:
      "학생이 직접 만든 자료에서도 같은 관계가 나타나는지 확인한다(Peters 외 2016의 확장 질문 '모든 자료에서도 그럴까?'). 마지막 칸에서 넘침·모자람과 양쪽 거리를 다시 하나의 관계(양쪽 합이 같으면 평평)로 묶어 설명한다(Post & Prediger 2024).",
    look:
      '자신이 만든 자료와 평균, 넘친 칸의 합 = 모자란 칸의 합, 받침점을 평균에 두면 시소가 평평하고 양쪽 거리의 합이 같음, 자료가 바뀌어도 언제나 그렇다는 일반화. 예) 3, 5, 10 → 평균 6, 넘침 4 = 모자람 3+1, 오른쪽 거리 4 = 왼쪽 거리 3+1.',
    help: [
      '내 자료의 평균은 얼마인가요? 초록색을 그곳에 두면 두 그림이 어떻게 되나요?',
      "'칸' 단추를 눌러 넘친 칸과 모자란 칸, 오른쪽 거리와 왼쪽 거리를 세어 보세요.",
      '막대 그림에서 모자란 칸과 넘친 칸을, 시소 그림에서 왼쪽 거리와 오른쪽 거리를 각각 한 줄로 모았어요. 두 줄의 길이를 비교해 보세요. 곡선과 숫자는 받침점에서 각 추까지의 거리예요.',
    ],
  },
  {
    id: 'change',
    label: '4',
    title: '자료를 바꾸어 시험하기',
    prompt: '받침점은 5에 그대로 두세요. 자료의 개수나 값을 바꾼 뒤에도 시소가 평평하게 해 보세요. 바꾸기 전에 방법을 예상해 보세요.',
    steps: [
      { id: 'method', title: '바꾸기 전 예상', ask: '자료를 더하거나 빼거나 값을 옮기면 시소가 어떻게 될까요? 시소가 계속 평평하려면 어떻게 바꾸면 좋을지 바꾸기 전에 예상해서 써 보세요.' },
      { id: 'reflect', title: '해 본 뒤', ask: '예상한 방법과 같았나요? 평평하게 하는 다른 방법도 찾아보고, 알게 된 것을 써 보세요.' },
    ],
    goal:
      "받침점(5)을 고정한 채 자료의 개수나 값을 바꾸며(자료 더하기·지우기·값 옮기기) 시소가 평평한 상태를 지키는 방법을 시험한다(O'Dell 2012의 '균형을 지키며 옮기기'와 '받침점 위에 자료 더하기', Van de Walle 외의 '평균이 같은 다른 자료 찾기'). 값을 옮길 때는 한 자료를 올린 만큼 다른 자료를 내리고, 자료를 더할 때는 받침점(5) 위에 놓거나 받침점에서 같은 거리만큼 떨어진 두 값(예: 4와 6)을 함께 더하면 넘침의 합 = 모자람의 합이 그대로다.",
    look:
      '바꾸기 전 방법 예상, 바꾼 자료(전후)와 결과(평평한지), 여러 방법을 찾았는지, 올린 만큼 내리는 보상 관계나 5 위에 더하기·양쪽에 같은 거리로 더하기를 말하는지. 예) 5를 더함(평평), 4와 6을 더함(평평), 9→10과 2→1(평평), 2를 지움(기움).',
    help: [
      '시소가 어느 쪽으로 기울었나요? 자료를 더하거나 빼거나 옮긴 것 중 무엇 때문에 그렇게 되었을까요?',
      '자료 하나를 더하거나 값을 옮기면 시소가 어느 쪽으로 기우는지 보고, 처음 자료로 되돌려 다시 해 보세요.',
      '막대 그림에서 모자란 칸과 넘친 칸을, 시소 그림에서 왼쪽 거리와 오른쪽 거리를 각각 한 줄로 모았어요. 두 줄의 길이를 비교해 보세요. 곡선과 숫자는 받침점에서 각 추까지의 거리예요.',
    ],
  },
];

// ---------------------------------------------------------------------------
// AI에게 알려 주는 '초등학생 기준'. 서버의 분석 프롬프트에 그대로 들어가고, 교사용 대시보드에도 보인다.
// 연구 인용이 들어 있는 goal·look(교사용)과 달리 AI에게는 5학년이 실제로 쓰는 말을 기준으로 알려 준다.
// ---------------------------------------------------------------------------
export const STUDENT_LEVEL_GUIDE = `[초등학생 기준으로 읽기]
- 학생은 초등학교 5학년입니다. 짧고 서툰 문장, 반말·해요체, 맞춤법·띄어쓰기 오류는 보지 않습니다. 한 문장이어도 관계가 드러나면 인정합니다.
- 수학 용어(넘침, 모자람, 거리, 합, 균형, 대응)를 쓰지 않아도 뜻이 통하면 인정합니다. 같은 뜻으로 보는 말의 예:
  · 넘친 부분: 위로 올라온 칸, 초록 선 위에 있는 칸, 튀어나온 부분, 큰 쪽, 더 높은 막대
  · 모자란 부분: 비어 있는 칸, 초록 선까지 빈 칸, 아래 칸, 작은 쪽, 더 낮은 막대
  · 거리: 떨어진 칸 수, 멀리 있다, 몇 칸 떨어져 있다
  · 평평하다: 수평이다, 균형이 맞다, 안 기울어요, 똑바로 있어요, 반듯해요, 가만히 있어요
  · 오른쪽이 내려간다: 오른쪽이 눌려요, 오른쪽이 더 무거워요, 오른쪽으로 기울어요
- 숫자를 세어 말하면("10칸과 3칸") 더 분명한 근거로 봅니다. 숫자가 없어도 "넘친 칸이 더 많아서"처럼 견주면 인정합니다.
- "양쪽의 합이 같으니까 평평하다"까지 이은 설명이 가장 높은 수준입니다. 거기까지 말하지 못해도, 넘친 부분과 모자란 부분의 비교를 시소의 기울기와 이었다면 '나타남'으로 봅니다.
- 어른스러운 설명이나 긴 글을 기대하지 않습니다. 글이 짧다는 이유만으로 '보이지 않음'으로 하지 않습니다.
- 오개념 신호(flags에 짧게 적고 필요하면 teacherCheck): ① 큰 수(예: 9)가 있다는 것만 보고 그쪽이 내려간다고 함(받침점과의 거리·넘친 칸과 모자란 칸의 비교는 말하지 않음) ② 추나 막대가 몇 개인지만 보고 판단함 ③ 거리와 자료값을 섞음(예: 8 = 5 + 3이니까) ④ 오른쪽·왼쪽과 넘침·모자람을 뒤집음`;

export const AI_GUIDE: Record<TaskId, string> = {
  predictSeesaw:
    "막대 그림에서 초록 선 위로 넘친 칸과 아래로 모자란 칸을 견주어 시소가 어느 쪽으로 기울지 말하는 것이 목표입니다. 넘친 칸이 더 많으면 오른쪽, 모자란 칸이 더 많으면 왼쪽, 같으면 평평입니다. 인정하는 까닭 예: '넘친 칸이 10칸이고 모자란 칸이 3칸이라서 오른쪽이 내려가요', '위로 올라온 칸이 더 많아서 오른쪽이 눌려요'. 세 번을 마친 뒤의 글에서는 이 비교를 기울기와 이었는지, 예상이 틀렸을 때 무엇을 고쳐 생각했는지 봅니다.",
  predictBars:
    "시소 그림의 기운 쪽을 보고 막대 그림에서 넘친 부분과 모자란 부분 중 어느 쪽이 더 많을지 말하는 것이 목표입니다. 오른쪽이 내려가면 넘친 부분이 더 많고, 왼쪽이 내려가면 모자란 부분이 더 많고, 평평하면 같습니다. 인정하는 까닭 예: '시소가 오른쪽으로 내려가서 넘친 부분이 더 많을 것 같아요', '왼쪽 추들이 더 멀리 있어서 모자란 부분이 많아요'. 1번과 같은 관계를 거꾸로 말했는지 봅니다.",
  custom:
    "학생이 만든 자료에서 평균과 넘친 칸의 합·모자란 칸의 합(= 오른쪽·왼쪽 거리의 합)을 구했는지, 평균에서 시소가 평평한지 봅니다. '두 그림을 이어 보면' 칸에서는 '자료가 바뀌어도 넘친 칸의 합과 모자란 칸의 합이 같고 시소도 평평하다', '넘친 칸은 오른쪽 거리, 모자란 칸은 왼쪽 거리가 된다'를 말했는지 봅니다. 인정하는 예: '내 자료에서도 넘친 칸이랑 모자란 칸이 똑같아요. 그래서 시소가 평평해요'. 계산 실수는 flags에 적되 연결 판단과 따로 봅니다.",
  change:
    "받침점 5를 그대로 두고 시소가 평평하게 되는 방법을 말했는지 봅니다. 인정하는 방법: 한 자료를 올린 만큼 다른 자료를 내린다, 5 위에 자료를 더한다, 4와 6처럼 받침점에서 같은 거리만큼 떨어진 두 자료를 양쪽에 하나씩 더한다, 양쪽 끝의 자료를 같은 만큼 바깥으로 옮긴다. 처음 예상이 틀렸다가 해 본 뒤 고쳐 쓰면 높이 평가합니다. 해 본 뒤 글에서 예상과 비교하고 다른 방법도 찾았는지 봅니다.",
};

export const TASK_BY_ID: Record<TaskId, TaskDef> = Object.fromEntries(TASKS.map((t) => [t.id, t])) as Record<TaskId, TaskDef>;
export const promptFor = (t: TaskDef, p: number) => t.prompt.replace('{p}', String(p));

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

// 막대 그림의 모습: 초록 선 위로 넘친 부분과 초록 선까지 모자란 부분 중 어느 쪽이 더 많은지
const TILT_TO_SIDES: Record<Tilt, BarSides> = { right: 'over', flat: 'equal', left: 'under' };
export const barSidesAt = (values: number[], p: number): BarSides => TILT_TO_SIDES[tiltAt(values, p)];

// 예상하기에서 확인했을 때 보이는 결과
export const outcomeAt = (task: PredictTaskId, values: number[], p: number): Prediction =>
  task === 'predictSeesaw' ? tiltAt(values, p) : barSidesAt(values, p);

// 4번 자료 바꾸기: 처음 자료와 비교해 더한 값·뺀 값 (같은 값은 개수로 비교; 값을 옮기면 뺀 값과 더한 값으로 나타남)
export function diffData(before: number[], after: number[]) {
  const cnt = new Map<number, number>();
  before.forEach((v) => cnt.set(v, (cnt.get(v) ?? 0) + 1));
  after.forEach((v) => cnt.set(v, (cnt.get(v) ?? 0) - 1));
  const removed: number[] = [];
  const added: number[] = [];
  cnt.forEach((c, v) => {
    for (let k = 0; k < Math.abs(c); k++) (c > 0 ? removed : added).push(v);
  });
  removed.sort((a, b) => a - b);
  added.sort((a, b) => a - b);
  return { added, removed };
}

export function describeDiff(before: number[], after: number[]) {
  const { added, removed } = diffData(before, after);
  if (!added.length && !removed.length) return '바꾼 것 없음';
  if (added.length === removed.length) return removed.map((r, k) => `${r}→${added[k]}`).join(', '); // 값만 옮긴 경우
  return [added.length ? `더한 자료 ${added.join(', ')}` : '', removed.length ? `뺀 자료 ${removed.join(', ')}` : ''].filter(Boolean).join(' · ');
}

// 3번 나만의 자료: 수를 구하는 칸(막대 그림에서·시소 그림에서)에 꼭 있어야 할 것이 빠졌는지 본다.
// 빠진 것이 있으면 '틀림'으로 보고 도움을 한 단계 올린다(학생에게 판정을 보여 주지는 않음).
// '두 그림을 이어 보면'은 설명하는 칸이라 보지 않는다.
const fmtNum = (x: number) => String(parseFloat(x.toFixed(2)));
const hasNumber = (text: string, x: number) => new RegExp(`(^|[^0-9.])${fmtNum(x).replace('.', '\\.')}(?![0-9])`).test(text);
export function customMissing(step: string, values: number[], text: string): string[] {
  if (values.length < 2) return [];
  const m = meanOf(values);
  const { over } = sidesAt(values, m);
  const missing: string[] = [];
  if (step === 'bar') {
    if (!hasNumber(text, m)) missing.push(`평균 ${fmtNum(m)}`);
    if (over > EPS && !hasNumber(text, over)) missing.push(`넘친 칸·모자란 칸의 합 ${fmtNum(over)}`);
  } else if (step === 'beam') {
    if (!/(평평|수평|균형|기울지|안\s*기울|안\s*내려|반듯|똑바|가만|나란|흔들리지)/.test(text)) missing.push('평균에서 시소가 평평함');
    if (over > EPS && !hasNumber(text, over)) missing.push(`오른쪽·왼쪽 거리의 합 ${fmtNum(over)}`);
  }
  return missing;
}

// ---------------------------------------------------------------------------
// 연결의 증거 분석 (교사용). AI가 없거나 실패하면 아래 규칙 분석을 '참고용'으로 쓴다.
// ---------------------------------------------------------------------------
export type EvidenceLevel = 'yes' | 'partial' | 'no' | 'na';
export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = { yes: '나타남', partial: '일부', no: '보이지 않음', na: '해당 없음' };

export interface AnalysisInput {
  taskId: TaskId;
  step: string; // 응답한 칸 (predict, reason, reflect, method, bar, beam, link)
  kind: 'first' | 'revised';
  text: string; // 학생 글 (예상은 '[예상] …' 줄로 앞에 붙음)
  values: number[];
  p: number; // 응답할 때 실제 초록색 위치
  round?: number; // 예상하기의 기준 (초록색 위치)
  prediction?: Prediction;
  revealed?: boolean; // 가려 둔 그림을 본 뒤의 응답인지
  history?: { p: number; prediction?: Prediction; actual: Prediction }[]; // 예상하기 정리: 세 번의 예상과 결과
  before?: number[]; // 자료를 바꾸기 전 (자료 바꾸기)
  supportsSeen?: string[]; // 응답 전에 실제로 본 도움·강조·애니메이션
}

export interface Analysis {
  dataMatch: EvidenceLevel; // 자료값의 대응 (막대 하나 ↔ 추 하나, 같은 수)
  deviationMatch: EvidenceLevel; // 기준값과의 차이 대응 (넘침·모자람 ↔ 오른쪽·왼쪽 거리)
  usedAsEvidence: EvidenceLevel; // 그 대응을 예상·설명의 근거로 사용
  evidence: string; // 판단 근거가 되는 학생의 말이나 예상
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
// 초등학생이 쓰는 말도 같은 뜻으로 본다: 넘침(위로 올라온·튀어나온·큰 쪽), 모자람(비어 있는·빈칸·작은 쪽·아래).
// "넘친 칸이 10칸이고 모자란 칸이 3칸이라서 오른쪽이 눌려요"처럼 두 쪽을 견주고 끝에 한 번만 방향을 말하면
// 어느 쪽을 가리키는지 알 수 없으므로 뒤집힘으로 보지 않는다.
const SENTENCE_SPLIT = /[.!?\n;]/;
const CLAUSE_SPLIT = /,|이고|이며|그리고|하고|지만|는데/;
const OVER = /(넘|위로|위에|높|튀어|올라|큰\s*쪽)/;
const UNDER = /(모자|부족|아래|낮|비어|빈\s*칸|빈칸|비는|작은\s*쪽)/;
function mappingDirection(text: string) {
  let forward = false;
  let reversed = false;
  for (const sentence of text.split(SENTENCE_SPLIT)) {
    let pendingOver = false; // 방향 없이 앞에서 말한 넘침
    let pendingUnder = false; // 방향 없이 앞에서 말한 모자람
    for (const c of sentence.split(CLAUSE_SPLIT)) {
      const right = /오른/.test(c);
      const left = /왼/.test(c);
      const over = OVER.test(c);
      const under = UNDER.test(c);
      if (!right && !left) {
        pendingOver = pendingOver || over;
        pendingUnder = pendingUnder || under;
        continue;
      }
      if (right === left) continue; // 한 절에 양쪽이 다 있으면 판단하지 않음
      if (over === under) continue;
      if ((over && pendingUnder) || (under && pendingOver)) continue; // 두 쪽을 견주고 방향을 한 번만 말한 경우
      if ((over && right) || (under && left)) forward = true;
      else reversed = true;
    }
  }
  return { forward, reversed };
}
const BAR_SIDE = /(넘|모자|부족|위로|위에|아래|높|낮|칸|튀어|올라|비어|비는)/;
const BEAM_SIDE = /(거리|떨어|오른|왼|받침|기울|내려|평평|수평|균형)/;
const SAME_VALUE = /(같은\s*(수|값|자리|위치|높이|눈금)|높이[^.,]{0,10}(자리|위치|눈금)|눈금|[0-9]\s*(에|자리|위치))/;
const UP = '(올리|올려|늘리|늘려|더하|더해|크게|높이|높여)';
const DOWN = '(내리|내려|줄이|줄여|빼|작게|낮추|낮춰)';
const COMPENSATE = new RegExp(
  `(${UP}.{0,18}${DOWN}|${DOWN}.{0,18}${UP}|같은\\s*만큼|그만큼|똑같이\\s*(바꾸|움직)|(받침점|5|다섯)[을를에]?\\s*(위에|에)?[^.,]{0,10}(놓|놔|더하|더해|넣|추가)|양쪽에[^.,]{0,12}(하나씩|똑같이|같은)|하나씩\\s*(더|놓|놔|넣|추가)|같은\\s*거리)`
);
const COMPARE = /(넘|모자|부족|많|적|크|작|비교|무거|가벼|기울|내려|눌려|평평|같)/;
// 초등학생이 자주 보이는 생각: 큰 수가 있으니 그쪽이 내려간다(받침점과의 거리·합은 보지 않음)
const VALUE_ONLY = /[0-9]+\s*[가이]?\s*(커서|크니까|크기 때문|큰데|더 커)/;
const GENERAL = /(항상|언제나|모든|어떤\s*자료|바뀌어도|달라도|마찬가지|역시|똑같이\s*나타)/;

export function ruleAnalyze(input: AnalysisInput): Analysis {
  // 예상 고르기 줄('[예상] …')은 학생이 쓴 글이 아니므로 글 분석에서 뺀다
  const text = normalizeAnswer(input.text.replace(/^\[예상\].*$/gm, ''));
  const flags: string[] = [];
  const empty = !text || isDontKnow(text);
  if (empty) flags.push(input.step === 'predict' ? '예상의 까닭이 비었거나 “모르겠어요”' : '글 응답이 비었거나 “모르겠어요”');

  const { forward, reversed } = mappingDirection(text);
  if (reversed) flags.push('넘침·모자람과 오른쪽·왼쪽의 대응이 뒤집혔을 수 있음');
  if (isPredictTask(input.taskId) && VALUE_ONLY.test(text) && !BAR_SIDE.test(text) && !/거리/.test(text))
    flags.push('큰 수가 있다는 것만 보고 판단했을 수 있음(받침점과의 거리·넘친 칸과 모자란 칸의 비교는 말하지 않음)');

  const evidenceBits: string[] = [];

  // 자료값의 대응 (같은 색으로 처음부터 보여 주므로 글에 나타날 때만 본다)
  const dataMatch: EvidenceLevel = SAME_VALUE.test(text) ? 'partial' : 'na';

  // 기준값과의 차이 대응
  let deviationMatch: EvidenceLevel = 'no';
  if (forward && !reversed) deviationMatch = 'yes';
  else if (BAR_SIDE.test(text) && BEAM_SIDE.test(text)) deviationMatch = 'partial';

  // 그 대응을 근거로 사용
  let usedAsEvidence: EvidenceLevel = 'na';
  if (isPredictTask(input.taskId)) {
    const bothSides = BAR_SIDE.test(text) && BEAM_SIDE.test(text);
    if (input.prediction === 'unsure' || empty) usedAsEvidence = 'no';
    else usedAsEvidence = COMPARE.test(text) && (bothSides || forward) ? 'yes' : COMPARE.test(text) ? 'partial' : 'no';
    if (input.history?.length) {
      evidenceBits.push(
        `예상과 결과: ${input.history.map((h) => `${h.p}에서 ${h.prediction ? predictionLabel(h.prediction) : '-'} → ${predictionLabel(h.actual)}`).join(' · ')}`
      );
    }
    if (input.prediction && input.round != null) {
      const actual = outcomeAt(input.taskId, input.values, input.round);
      evidenceBits.push(`예상: ${predictionLabel(input.prediction)} (초록색 ${input.round}, 실제: ${predictionLabel(actual)})`);
    }
  } else if (input.taskId === 'change') {
    usedAsEvidence = COMPENSATE.test(text) ? 'yes' : COMPARE.test(text) ? 'partial' : 'no';
    if (input.before)
      evidenceBits.push(`바꾸기 전 [${input.before.join(', ')}] → 후 [${input.values.join(', ')}] (${describeDiff(input.before, input.values)}), 시소: ${CHOICE_LABEL[tiltAt(input.values, input.p)]}`);
  } else if (input.taskId === 'custom') {
    const m = meanOf(input.values);
    const s = sidesAt(input.values, m);
    const r = (x: number) => String(parseFloat(x.toFixed(2)));
    evidenceBits.push(`내 자료 [${input.values.join(', ')}] 평균 ${r(m)} · 평균에서 넘침 ${r(s.over)} = 모자람 ${r(s.under)} · 응답할 때 초록색 ${r(input.p)}`);
    if (input.step === 'link') usedAsEvidence = GENERAL.test(text) && (BAR_SIDE.test(text) || BEAM_SIDE.test(text)) ? 'yes' : GENERAL.test(text) || COMPARE.test(text) ? 'partial' : 'no';
    if (input.step === 'bar' || input.step === 'beam') {
      if (deviationMatch === 'no') deviationMatch = 'na'; // 한 그림에서 수를 구하는 칸
      if (!Number.isInteger(m)) flags.push('평균이 자연수가 아닌 자료');
      const missing = customMissing(input.step, input.values, text);
      if (missing.length) flags.push(`빠진 것: ${missing.join(', ')}`);
    }
  }

  const quote = text.slice(0, 80);
  if (quote) evidenceBits.unshift(`“${quote}${text.length > 80 ? '…' : ''}”`);

  const teacherCheck = reversed || empty;
  if (input.supportsSeen?.length) flags.push(`응답 전 본 도움: ${input.supportsSeen.map(supportLabel).join(', ')}`);

  const suggestedSupport =
    deviationMatch === 'no'
      ? '도움 2(살펴볼 대상 제안): 초록 선 위로 넘친 부분과 아래로 모자란 부분, 받침점 오른쪽과 왼쪽의 거리를 비교하게 하기'
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
