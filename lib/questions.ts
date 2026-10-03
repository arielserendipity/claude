import type { HintKey, HintRef } from './hints';

// 활동 2 기본 자료 (합 35, 7개 → 평균 5)
// 모자란 양: 3+2+1+1 = 7, 넘친 양: 1+2+4 = 7
export const DEFAULT_VALUES = [2, 3, 4, 4, 6, 7, 9];

export type QuestionId = 'q1' | 'q2a' | 'q2b' | 'q3a' | 'q3b' | 'q4';

export interface Idea {
  id: string;
  student: string; // 학생에게 보이는 '꼭 쓸 것' (무엇에 대해 써야 하는지만, 답은 알려 주지 않음)
  teacher: string; // 교사용 채점 기준 설명
  accept: string; // 인정하는 표현 예 (AI 채점 안내용)
  hint: HintKey; // 이 아이디어가 빠졌을 때 보여줄 시각 힌트
  hintTarget?: number; // 강조할 자료값
  // AI를 쓸 수 없을 때의 규칙 채점: 모든 그룹에서 하나 이상 일치하면 충족
  groups: string[][];
}

export interface Question {
  id: QuestionId;
  label: string;
  prompt: string; // 학생에게 보이는 문항
  modelAnswer: string; // 교사용 예시 답안
  ideas: Idea[];
  usesCustomData?: boolean; // 학생이 만든 자료로 답하는 문항
  startP?: number; // 문항을 열 때 평균선·받침점의 처음 위치 (기본 5)
}

// 문항 설계 원칙 (초등 5학년)
// - "어디인가요/무엇인가요"처럼 막연하게 묻지 않고, 그림에서 세거나 계산해서 나오는 '수'를 묻는다.
// - 까닭을 물을 때는 앞 문항에서 직접 확인한 사실(막대의 칸 수 = 추의 거리)을 근거로 쓰게 한다.
// - 문항마다 '꼭 쓸 것'이 채점 기준(아이디어)과 1:1로 대응한다.
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    label: '1',
    prompt:
      '초록 선이나 받침점을 움직여 저울이 수평이 되는 곳을 찾아보세요. 그곳은 몇인가요? 자료 2, 3, 4, 4, 6, 7, 9의 평균을 계산해서 그 수와 비교해 보세요.',
    modelAnswer:
      '받침점을 5에 두면 저울이 수평이 된다. 평균은 (2+3+4+4+6+7+9)÷7=35÷7=5이므로 저울이 수평이 되는 곳과 평균이 같다.',
    startP: 3,
    ideas: [
      {
        id: 'q1_level',
        student: '저울이 수평이 되는 곳 (수)',
        teacher: '받침점(초록 선)을 5에 두면 저울이 수평이 됨',
        accept: '5, 5에서 수평, 받침점이 5일 때 기울지 않음',
        hint: 'MEAN_LINK',
        groups: [['5', '다섯']],
      },
      {
        id: 'q1_mean',
        student: '평균을 계산한 식과 값, 그리고 위의 수와 비교',
        teacher: '평균 35÷7=5를 계산하고 수평이 되는 곳과 같음을 확인',
        accept: '35÷7=5, 모두 더하면 35이고 7로 나누면 5, 평균도 5라서 같다',
        hint: 'LEVELING',
        groups: [
          ['35', '삼십오', '÷', '나누', '나눗', '/', '평균'],
          ['같', '똑같', '일치', '5', '다섯'],
        ],
      },
    ],
  },
  {
    id: 'q2a',
    label: '2-1',
    prompt:
      '9인 막대는 평균선보다 몇 칸 높나요? 균형점 그림에서 9에 있는 추는 받침점에서 몇 칸 떨어져 있나요? 두 수를 비교해 보세요.',
    modelAnswer: '9인 막대는 평균선(5)보다 4칸 높다. 9에 있는 추는 받침점(5)에서 4칸 떨어져 있다. 두 수는 4로 같다.',
    ideas: [
      {
        id: 'q2a_bar',
        student: '막대가 평균선보다 몇 칸 높은지',
        teacher: '9인 막대는 평균선보다 4칸 높다 (9-5=4)',
        accept: '4칸, 9-5=4, 4칸 넘친다, 둘 다 4',
        hint: 'EXCESS_TO_DISTANCE',
        hintTarget: 9,
        groups: [
          ['4', '넷', '네\\s*칸'],
          ['막대', '높', '넘', '평균', '선', '위', '9', '둘\\s*다', '모두', '각각'],
        ],
      },
      {
        id: 'q2a_dist',
        student: '추가 받침점에서 몇 칸 떨어져 있는지',
        teacher: '9에 있는 추는 받침점에서 4칸 떨어져 있다',
        accept: '4칸, 받침점에서 4칸, 5에서 9까지 4, 둘 다 4',
        hint: 'EXCESS_TO_DISTANCE',
        hintTarget: 9,
        groups: [
          ['4', '넷', '네\\s*칸'],
          ['추', '받침', '떨어', '거리', '저울', '사이', '까지', '둘\\s*다', '모두', '각각'],
        ],
      },
      {
        id: 'q2a_same',
        student: '두 수를 비교하면 어떤지',
        teacher: '두 수가 같다 (막대의 넘친 칸 수 = 추와 받침점 사이 거리)',
        accept: '같다, 둘 다 4, 똑같다',
        hint: 'EXCESS_TO_DISTANCE',
        hintTarget: 9,
        groups: [['같', '똑같', '일치', '둘\\s*다', '모두']],
      },
    ],
  },
  {
    id: 'q2b',
    label: '2-2',
    prompt:
      '2인 막대가 평균선까지 올라가려면 몇 칸이 모자라나요? 균형점 그림에서 2에 있는 추는 받침점에서 몇 칸 떨어져 있나요? 두 수를 비교해 보세요.',
    modelAnswer: '2인 막대는 평균선(5)까지 3칸이 모자란다. 2에 있는 추는 받침점(5)에서 3칸 떨어져 있다. 두 수는 3으로 같다.',
    ideas: [
      {
        id: 'q2b_bar',
        student: '막대가 평균선까지 몇 칸 모자란지',
        teacher: '2인 막대는 평균선까지 3칸 모자란다 (5-2=3)',
        accept: '3칸, 5-2=3, 3칸 더 필요, 둘 다 3',
        hint: 'DEFICIT_TO_GAP',
        hintTarget: 2,
        groups: [
          ['3', '셋', '세\\s*칸'],
          ['막대', '모자', '필요', '더', '부족', '빈', '올라', '평균', '선', '2', '둘\\s*다', '모두', '각각'],
        ],
      },
      {
        id: 'q2b_dist',
        student: '추가 받침점에서 몇 칸 떨어져 있는지',
        teacher: '2에 있는 추는 받침점에서 3칸 떨어져 있다',
        accept: '3칸, 받침점에서 3칸, 2에서 5까지 3, 둘 다 3',
        hint: 'DEFICIT_TO_GAP',
        hintTarget: 2,
        groups: [
          ['3', '셋', '세\\s*칸'],
          ['추', '받침', '떨어', '거리', '저울', '사이', '까지', '둘\\s*다', '모두', '각각'],
        ],
      },
      {
        id: 'q2b_same',
        student: '두 수를 비교하면 어떤지',
        teacher: '두 수가 같다 (막대의 모자란 칸 수 = 추와 받침점 사이 거리)',
        accept: '같다, 둘 다 3, 똑같다',
        hint: 'DEFICIT_TO_GAP',
        hintTarget: 2,
        groups: [['같', '똑같', '일치', '둘\\s*다', '모두']],
      },
    ],
  },
  {
    id: 'q3a',
    label: '3-1',
    prompt:
      '막대 그림에서 평균선보다 넘친 칸을 모두 더하면 몇 칸인가요? 모자란 칸을 모두 더하면 몇 칸인가요? 균형점 그림에서 받침점 왼쪽 추들의 거리를 모두 더한 값과 오른쪽 추들의 거리를 모두 더한 값도 구해 보세요.',
    modelAnswer:
      '넘친 칸은 1+2+4=7칸, 모자란 칸은 3+2+1+1=7칸이다. 받침점 왼쪽 추들의 거리의 합은 3+2+1+1=7, 오른쪽은 1+2+4=7이다. 네 수가 모두 7로 같다.',
    ideas: [
      {
        id: 'q3a_bar',
        student: '넘친 칸의 합과 모자란 칸의 합',
        teacher: '넘친 칸의 합 1+2+4=7, 모자란 칸의 합 3+2+1+1=7',
        accept: '넘친 7칸, 모자란 7칸, 둘 다 7',
        hint: 'LEVELING',
        groups: [
          ['7', '일곱'],
          ['넘', '모자', '칸', '막대', '남', '부족'],
        ],
      },
      {
        id: 'q3a_beam',
        student: '왼쪽 거리의 합과 오른쪽 거리의 합',
        teacher: '받침점 왼쪽 추들의 거리의 합 7 = 오른쪽 추들의 거리의 합 7',
        accept: '왼쪽 7, 오른쪽 7, 양쪽 다 7',
        hint: 'SUM_BALANCE',
        groups: [
          ['7', '일곱'],
          ['왼쪽', '오른쪽', '양쪽', '거리', '추', '받침'],
        ],
      },
      {
        id: 'q3a_same',
        student: '네 수를 비교하면 어떤지',
        teacher: '네 수가 모두 같다 (7)',
        accept: '모두 같다, 다 7, 똑같다',
        hint: 'SUM_BALANCE',
        groups: [['같', '똑같', '일치', '모두', '다\\s*7']],
      },
    ],
  },
  {
    id: 'q3b',
    label: '3-2',
    prompt:
      '막대 그림에서 넘친 칸의 합과 모자란 칸의 합이 같으면, 균형점 그림의 저울은 어떻게 되나요? 2번에서 알게 된 것(막대의 칸 수와 추의 거리)을 이용해 까닭을 써 보세요.',
    modelAnswer:
      '저울이 수평이 된다. 2번에서 본 것처럼 막대가 평균선보다 넘치거나 모자란 칸 수는 그 추가 받침점에서 떨어진 거리와 같다. 그래서 넘친 칸의 합은 오른쪽 추들의 거리의 합과 같고, 모자란 칸의 합은 왼쪽 추들의 거리의 합과 같다. 넘친 칸과 모자란 칸의 합이 같으니 양쪽 거리의 합도 같아져 저울이 수평이 된다.',
    ideas: [
      {
        id: 'q3b_level',
        student: '저울이 어떻게 되는지',
        teacher: '저울이 수평이 된다 (기울지 않는다)',
        accept: '수평이 된다, 기울지 않는다, 균형이 맞는다, 평평해진다',
        hint: 'SUM_BALANCE',
        groups: [['수평', '평평', '균형', '기울지', '안\\s*기울', '반듯', '맞']],
      },
      {
        id: 'q3b_reason',
        student: '까닭: 막대의 칸 수와 추의 거리가 어떤 관계인지',
        teacher: '까닭: 막대의 넘친/모자란 칸 수 = 그 추와 받침점 사이 거리(2번) → 양쪽 거리의 합도 같다',
        accept:
          '넘친 칸 수가 추의 거리와 같아서, 넘친 칸은 오른쪽 거리이고 모자란 칸은 왼쪽 거리라서, 칸 수와 거리가 같으니까 양쪽 거리의 합도 같아서',
        hint: 'CELLS_TO_DISTANCE',
        groups: [
          ['칸', '넘', '모자', '막대'],
          ['거리', '떨어', '사이', '간격', '추'],
        ],
      },
    ],
  },
  {
    id: 'q4',
    label: '4',
    prompt:
      "오른쪽 위 '새로운 자료'에서 막대나 추를 놓아 나만의 자료를 만들고, 저울이 수평이 되는 받침점을 찾아보세요(받침점이 자연수가 되게 만들면 쉬워요). 내 자료에서도 넘친 칸의 합과 모자란 칸의 합이 같은지 수로 확인해 써 보세요.",
    modelAnswer:
      '예) 내 자료 3, 5, 10: 받침점(평균) 6에서 수평이 된다. 넘친 칸은 10-6=4, 모자란 칸은 (6-3)+(6-5)=3+1=4이다. 넘친 칸의 합과 모자란 칸의 합이 4로 같다.',
    usesCustomData: true,
    ideas: [
      {
        id: 'q4_data',
        student: '내가 만든 자료와 수평이 되는 받침점(평균)',
        teacher: '자신이 만든 자료값과 수평이 되는 받침점(평균)을 제시',
        accept: '자료 3, 5, 10이고 받침점 6, 평균은 6',
        hint: 'MEAN_LINK',
        groups: [['\\d'], ['평균', '받침', '수평', '자료', '막대', '추']],
      },
      {
        id: 'q4_sums',
        student: '넘친 칸의 합과 모자란 칸의 합 (또는 양쪽 거리의 합)',
        teacher: '넘친 칸·모자란 칸의 합(또는 왼쪽·오른쪽 거리의 합)을 수로 구함',
        accept: '넘친 칸 4, 모자란 칸 4 / 왼쪽 거리 합 4, 오른쪽 거리 합 4',
        hint: 'LEVELING',
        groups: [['\\d'], ['넘', '모자', '칸', '거리', '왼쪽', '오른쪽', '합']],
      },
      {
        id: 'q4_same',
        student: '두 합이 같은지',
        teacher: '두 합이 같음을 확인 (자료가 달라도 성립)',
        accept: '같다, 이번에도 같다, 항상 같다',
        hint: 'SUM_BALANCE',
        groups: [['같', '똑같', '일치', '성립', '항상', '역시']],
      },
    ],
  },
];

export const QUESTION_BY_ID: Record<QuestionId, Question> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q])
) as Record<QuestionId, Question>;

export type Verdict = 'PASS' | 'PARTIAL' | 'RETRY';

export interface EvalResult {
  verdict: Verdict;
  foundIdeaIds: string[];
  missingIdeaIds: string[];
  hints: HintRef[];
  teacherLog: string;
  misconception?: string;
  source: 'ai' | 'rule';
}

// "균형점 그림", "막대 그림"처럼 문항을 옮겨 적은 말 때문에 잘못 채점되지 않도록 지운다.
export function normalizeAnswer(s: string) {
  return s
    .replace(/균형점\s*그림/g, ' ')
    .replace(/막대\s*그림/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCopyOfPrompt(q: Question, answer: string) {
  const a = answer.replace(/\s+/g, '');
  const p = q.prompt.replace(/\s+/g, '');
  return a.length < 4 || p.includes(a);
}

// '모르겠어요', '몰라' 같은 짧은 답은 채점할 내용이 없는 것으로 본다
export function isDontKnow(answer: string) {
  const a = answer.replace(/\s+/g, '');
  return a.length <= 15 && /(모르|몰라|몰루|몰랑|글쎄|잘\s*모|패스|pass|\?{2,})/i.test(a);
}

export function hintsForMissing(q: Question, missingIdeaIds: string[]): HintRef[] {
  const seen = new Set<string>();
  const out: HintRef[] = [];
  for (const idea of q.ideas) {
    if (!missingIdeaIds.includes(idea.id)) continue;
    const k = `${idea.hint}:${idea.hintTarget ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: idea.hint, target: idea.hintTarget });
  }
  return out;
}

export function verdictFrom(q: Question, found: string[]): Verdict {
  if (found.length >= q.ideas.length) return 'PASS';
  if (found.length > 0) return 'PARTIAL';
  return 'RETRY';
}

export function ruleEvaluate(q: Question, answer: string): EvalResult {
  const text = normalizeAnswer(answer);
  const found = isCopyOfPrompt(q, answer) || isDontKnow(answer)
    ? []
    : q.ideas
        .filter((idea) => idea.groups.every((g) => g.some((pat) => new RegExp(pat).test(text))))
        .map((i) => i.id);
  const missing = q.ideas.map((i) => i.id).filter((id) => !found.includes(id));
  const verdict = verdictFrom(q, found);
  const foundDesc = q.ideas.filter((i) => found.includes(i.id)).map((i) => i.teacher);
  const missingDesc = q.ideas.filter((i) => missing.includes(i.id)).map((i) => i.teacher);
  return {
    verdict,
    foundIdeaIds: found,
    missingIdeaIds: missing,
    hints: verdict === 'PASS' ? [] : hintsForMissing(q, missing),
    teacherLog: `[규칙 채점] 충족: ${foundDesc.join(' / ') || '없음'} | 부족: ${missingDesc.join(' / ') || '없음'}`,
    source: 'rule',
  };
}
