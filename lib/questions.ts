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
  usesCustomData?: boolean; // 학생이 바꾼 자료로 답하는 문항
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    label: '1',
    prompt: '막대 그림의 평균 5와 균형점 그림의 평균 5는 각각 무엇으로 나타나나요?',
    modelAnswer:
      '막대 그림에서는 높이 5인 가로선(평균선, 막대들을 고르게 했을 때의 높이)으로, 균형점 그림에서는 저울이 수평을 이루는 받침점의 위치(5)로 나타난다.',
    ideas: [
      {
        id: 'q1_bar',
        student: '막대 그림에서는 무엇으로 나타나는지',
        teacher: '막대 그림: 평균 5 = 높이 5의 평균선(막대를 고르게 한 높이)',
        accept: '평균선, 가로선, 초록 선, 5에 그은 줄, 막대를 똑같이 맞춘 높이 등',
        hint: 'MEAN_LINK',
        groups: [['선', '줄', '가로', '고르', '평평', '높이', '같게', '똑같', '5\\s*칸']],
      },
      {
        id: 'q1_balance',
        student: '균형점 그림에서는 무엇으로 나타나는지',
        teacher: '균형점 그림: 평균 5 = 받침점의 위치(수평을 이루는 점)',
        accept: '받침점, 받침대, 세모, 삼각형, 저울이 수평이 되는 곳, 균형이 맞는 점 등',
        hint: 'MEAN_LINK',
        groups: [['받침', '수평', '균형', '기울', '중심', '지지', '세모', '삼각', '가운데\\s*점']],
      },
    ],
  },
  {
    id: 'q2a',
    label: '2-1',
    prompt: '9인 막대에서 5보다 넘친 4칸은 균형점 그림의 어디에 해당하나요?',
    modelAnswer: '9의 추와 받침점(5) 사이의 거리, 곧 받침점에서 오른쪽으로 4칸 떨어진 거리에 해당한다.',
    ideas: [
      {
        id: 'q2a_distance',
        student: '균형점 그림의 어느 부분인지',
        teacher: '넘친 4칸 = 9의 추와 받침점 사이의 거리(오른쪽 4칸)',
        accept: '9 추와 받침점 사이, 받침점에서 9까지 4칸, 5와 9 사이 간격, 9가 받침점에서 떨어진 만큼 등',
        hint: 'EXCESS_TO_DISTANCE',
        hintTarget: 9,
        groups: [
          ['거리', '사이', '떨어', '간격', '칸', '만큼', '까지'],
          ['받침', '5', '균형점', '중심', '세모', '삼각', '추', '9'],
        ],
      },
    ],
  },
  {
    id: 'q2b',
    label: '2-2',
    prompt: '반대로, 2의 추와 받침점 5 사이의 3칸은 막대 그림의 어디인가요?',
    modelAnswer: '2인 막대의 위쪽에서 평균선(5)까지 비어 있는, 모자란 3칸에 해당한다.',
    ideas: [
      {
        id: 'q2b_gap',
        student: '막대 그림의 어느 부분인지',
        teacher: '받침점까지의 3칸 = 2인 막대 위에서 평균선까지 모자란(빈) 3칸',
        accept: '2 막대 위의 빈 칸, 평균선까지 모자란 부분, 2에서 5까지 채워야 하는 3칸, 막대가 5에 못 미치는 만큼 등',
        hint: 'DEFICIT_TO_GAP',
        hintTarget: 2,
        groups: [
          ['모자', '부족', '빈', '비어', '비는', '채우', '채워', '없는', '더', '올라', '필요', '못\\s*미', '까지'],
          ['평균', '선', '5', '위', '막대', '2'],
        ],
      },
    ],
  },
  {
    id: 'q3a',
    label: '3-1',
    prompt:
      "막대 그림에서 '모자란 양과 넘친 양이 같다'는 설명은 균형점 그림에서는 어떻게 표현되나요? 왜 같은 관계인가요?",
    modelAnswer:
      '받침점 왼쪽 추들의 거리의 합(3+2+1+1=7)과 오른쪽 추들의 거리의 합(1+2+4=7)이 같아서 저울이 수평을 이루는 것으로 표현된다. 각 막대가 평균선보다 넘치거나 모자란 칸 수가 바로 그 추와 받침점 사이의 거리이기 때문이다.',
    ideas: [
      {
        id: 'q3a_expr',
        student: '균형점 그림에서 어떻게 나타나는지',
        teacher: '표현: 받침점 왼쪽 거리의 합 = 오른쪽 거리의 합 (그래서 수평)',
        accept: '왼쪽 거리와 오른쪽 거리가 같다, 양쪽 추까지 떨어진 칸을 모두 더하면 같다, 그래서 저울이 수평이다 등 ("합"이라는 말이 없어도 양쪽 거리가 같다는 뜻이면 인정)',
        hint: 'SUM_BALANCE',
        groups: [
          ['거리', '떨어', '간격', '칸', '추'],
          ['합', '더하', '더한', '더해', '모두', '전체', '총', '왼쪽', '오른쪽', '양쪽', '양\\s*쪽'],
          ['같', '똑같', '균형', '수평', '평평', '맞'],
        ],
      },
      {
        id: 'q3a_why',
        student: '왜 같은 관계인지 (까닭)',
        teacher: '이유: 막대의 넘친/모자란 칸 수 = 그 추와 받침점 사이의 거리',
        accept: '넘친 칸이 곧 거리라서, 모자란 칸과 추까지의 거리가 같아서, 막대가 5에서 벗어난 만큼 추가 받침점에서 떨어져 있어서 등',
        hint: 'CELLS_TO_DISTANCE',
        groups: [
          ['넘', '모자', '남', '부족', '차이', '칸', '벗어'],
          ['거리', '떨어', '사이', '간격'],
        ],
      },
    ],
  },
  {
    id: 'q3b',
    label: '3-2',
    prompt:
      "반대로, 균형점 그림에서 '받침점 왼쪽 추들의 거리의 합과 오른쪽 추들의 거리의 합이 같다'는 설명은 막대 그림에서는 어떻게 표현되나요? 왜 같은 관계인가요?",
    modelAnswer:
      '막대 그림에서는 평균선보다 넘친 칸 수의 합(7)과 모자란 칸 수의 합(7)이 같다는 것, 곧 넘친 부분을 옮겨 모자란 부분을 채우면 모든 막대가 평균 높이로 고르게 된다는 것으로 표현된다. 추와 받침점 사이의 거리가 곧 막대가 평균선에서 넘치거나 모자란 칸 수이기 때문이다.',
    ideas: [
      {
        id: 'q3b_expr',
        student: '막대 그림에서 어떻게 나타나는지',
        teacher: '표현: 평균선보다 넘친 칸의 합 = 모자란 칸의 합 (옮겨 채우면 고르게 됨)',
        accept: '넘친 칸과 모자란 칸이 같다, 넘친 것을 옮기면 모자란 곳이 채워진다, 막대를 고르게 하면 모두 5가 된다 등',
        hint: 'LEVELING',
        groups: [
          ['넘', '남', '많', '초과', '위로', '높'],
          ['모자', '부족', '빈', '비어', '적', '낮'],
          ['같', '똑같', '채우', '채워', '고르', '평평', '옮기', '옮겨', '맞', '나눠', '나누'],
        ],
      },
      {
        id: 'q3b_why',
        student: '왜 같은 관계인지 (까닭)',
        teacher: '이유: 추와 받침점 사이 거리 = 막대가 평균선에서 넘치거나 모자란 칸 수',
        accept: '추까지의 거리가 넘치거나 모자란 칸 수와 같아서, 거리 1칸이 막대 1칸이라서 등',
        hint: 'CELLS_TO_DISTANCE',
        groups: [
          ['거리', '떨어', '사이', '간격'],
          ['칸', '넘', '모자', '남', '부족', '차이', '막대'],
        ],
      },
    ],
  },
  {
    id: 'q4',
    label: '4',
    prompt:
      "오른쪽 위 '새로운 자료'를 눌러 막대나 추를 직접 놓아 나만의 자료를 만들어 보세요(활동 1에서 푼 문제를 불러와도 좋아요). 새 자료에서도 위와 같은 관계가 있나요? 내가 만든 자료와 함께 써 보세요.",
    modelAnswer:
      '자료가 달라져도 평균선(받침점)이 평균에 있을 때는 넘친 양의 합과 모자란 양의 합이, 받침점 왼쪽 거리의 합과 오른쪽 거리의 합이 항상 같다. (학생이 만든 자료의 수치를 근거로 제시)',
    usesCustomData: true,
    ideas: [
      {
        id: 'q4_always',
        student: '새 자료에서도 같은 관계가 있는지',
        teacher: '일반화: 자료가 달라져도 평균에서는 같은 관계가 성립함',
        accept: '새 자료도 같았다, 항상 같다, 어떤 자료든 성립한다, 이번에도 수평이 되었다 등',
        hint: 'SUM_BALANCE',
        groups: [['항상', '늘', '언제나', '모든', '어떤', '바꿔도', '바꾸어도', '달라도', '달라져도', '바뀌어도', '마다', '성립', '같', '똑같', '그대로', '역시', '수평', '균형']],
      },
      {
        id: 'q4_evidence',
        student: '내가 만든 자료의 수 (예: 막대 높이, 추 위치, 평균)',
        teacher: '근거: 자신이 살펴본 자료의 값(수치)으로 확인',
        accept: '자료의 값, 평균, 넘친·모자란 칸 수, 거리의 합 등 수를 하나라도 들어 설명',
        hint: 'LEVELING',
        groups: [['\\d', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열']],
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
