import type { HintKey, HintRef } from './hints';

// 활동 2 기본 자료 (합 35, 7개 → 평균 5)
// 모자란 양: 3+2+1+1 = 7, 넘친 양: 1+2+4 = 7
export const DEFAULT_VALUES = [2, 3, 4, 4, 6, 7, 9];

export type QuestionId = 'q1' | 'q2a' | 'q2b' | 'q3a' | 'q3b' | 'q4';

// 학생은 한 문항의 답을 그림별 칸에 나누어 쓴다
export type PartModel = 'bar' | 'beam' | 'link';

export const PART_TITLE: Record<PartModel, string> = {
  bar: '막대 그림에서',
  beam: '시소 그림에서',
  link: '두 그림을 이어 보면',
};

// 한 아이디어 = 학생 화면의 답 칸 하나 (발문 + 쓰는 칸 + ✓)
export interface Idea {
  id: string;
  part: PartModel; // 어느 그림에 대해 쓰는 칸인지
  ask: string; // 그 칸의 발문 (학생에게 보임, 답은 알려 주지 않음)
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
  prompt: string; // 문항 첫 발문 (그림에서 무엇을 해 볼지)
  modelAnswer: string; // 교사용 예시 답안
  ideas: Idea[];
  usesCustomData?: boolean; // 학생이 만든 자료로 답하는 문항
  startP?: number; // 문항을 열 때 초록색(평균선·받침점)의 처음 위치 (기본 5)
  focusValue?: number; // 문항을 여는 동안 두 그림에서 빛나게 할 자료값 (막대와 추)
}

// 학생이 칸마다 쓴 답 (idea id → 글)
export type PartAnswers = Record<string, string>;

// 문항 설계 원칙 (초등 5학년)
// - 평가하듯 묻지 않고, 그림을 조작하며 스스로 알아내도록 이끄는 발문으로 묻는다.
// - 첫 발문은 막대 그림과 시소 그림에 똑같이 적용되는 하나의 과제로 낸다
//   (예: "9가 평균보다 얼마나 큰지가 두 그림에서 각각 어떻게 나타나는지 찾아보세요").
// - 막대 그림 칸과 시소 그림 칸의 발문은 같은 틀로 묻고(그림 이름과 대상만 바뀜),
//   "이것은 평균과 비교해 어떻다는 뜻일까요?"처럼 그 그림에서의 뜻을 쓰게 한다.
// - 모든 문항에 '두 그림을 이어 보면' 칸을 두어, 막대 그림의 무엇이 시소 그림의 무엇이 되는지 쓰게 한다.
// - 수를 세는 발문은 그림에서 셀 수 있는 것(칸, 거리)만 묻는다.
// - 용어 약속: 두 그림에서 함께 움직이는 초록 표시는 '초록색'이라 부른다.
//   막대 그림의 초록색(초록 선) = '평균선', 시소 그림의 초록색(초록 세모) = '받침점'.
//   두 그림에 함께 하는 조작은 '초록색', 한 그림에 대한 발문은 '평균선' 또는 '받침점'으로만 쓴다.
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    label: '1',
    prompt:
      '초록색(막대 그림의 평균선, 시소 그림의 받침점)은 두 그림에서 함께 움직여요. 자료 2, 3, 4, 4, 6, 7, 9의 평균을 구하고, 초록색을 평균에 놓았을 때 막대 그림과 시소 그림이 각각 어떻게 되는지 살펴보세요.',
    modelAnswer:
      '평균은 35÷7=5이다. [막대 그림] 초록색(평균선)이 5에 있으면 넘친 칸과 모자란 칸이 생기고, 넘친 칸으로 모자란 칸을 채우면 모든 막대가 5로 똑같아진다. 막대 그림에서 평균은 막대들을 고르게 했을 때의 높이이다. ' +
      '[시소 그림] 초록색(받침점)이 5에 있으면 시소가 평평해진다. 시소 그림에서 평균은 시소가 평평해지는 균형점이다. ' +
      '[이어 보기] 평균 5는 막대들을 고르게 한 높이이면서, 시소가 평평해지는 균형점이다. 두 그림의 초록색은 같은 수(평균)를 나타낸다.',
    startP: 3,
    ideas: [
      {
        id: 'q1_bar',
        part: 'bar',
        ask: '초록색이 평균에 있을 때 막대 그림은 어떻게 되나요? 막대 그림에서 평균은 무엇을 뜻할까요?',
        teacher: '넘친 칸으로 모자란 칸을 채우면 모든 막대가 5로 같아짐 → 막대 그림에서 평균은 막대들을 고르게 했을 때의 높이',
        accept:
          '모두 5가 된다, 막대 높이가 똑같아진다, 평균은 막대를 고르게 한 높이, 넘친 칸과 모자란 칸이 같아지는 높이, 넘친 것으로 모자란 것을 채운 높이',
        hint: 'LEVELING',
        groups: [
          ['5', '다섯', '평균', '높이', '넘', '모자', '막대'],
          ['똑같', '같아', '같은', '같다', '같고', '고르', '평평', '나란', '채워', '채우', '채운', '메워', '메우', '반듯'],
        ],
      },
      {
        id: 'q1_beam',
        part: 'beam',
        ask: '초록색이 평균에 있을 때 시소 그림은 어떻게 되나요? 시소 그림에서 평균은 무엇을 뜻할까요?',
        teacher: '받침점이 평균 5에 있으면 시소가 평평해짐 → 시소 그림에서 평균은 시소가 평평해지는 균형점',
        accept: '시소가 평평해진다, 기울지 않는다, 평균은 균형점이다, 평균은 시소가 균형을 이루는 곳, 받침점이 5면 평평',
        hint: 'MEAN_LINK',
        groups: [
          ['5', '다섯', '평균', '받침', '시소', '저울', '균형점'],
          ['평평', '수평', '균형', '기울지', '안\\s*기울', '반듯'],
        ],
      },
      {
        id: 'q1_link',
        part: 'link',
        ask: '두 그림에서 알아낸 평균의 뜻을 비교해 보세요. 두 그림을 함께 생각하면 평균은 어떤 수라고 말할 수 있을까요?',
        teacher: '평균 = 막대들을 고르게 한 높이 = 시소가 평평해지는 균형점 (평균선과 받침점은 같은 수를 나타냄)',
        accept:
          '평균은 막대를 고르게 한 높이이면서 시소가 평평해지는 균형점이다, 막대가 똑같아지는 곳과 시소가 균형을 이루는 곳이 둘 다 평균이다, 평균선이 받침점이 된다',
        hint: 'MEAN_LINK',
        groups: [
          ['고르', '똑같', '같은\\s*높이', '채', '막대', '평균선'],
          ['평평', '수평', '균형', '기울', '시소', '저울', '받침'],
        ],
      },
    ],
  },
  {
    id: 'q2a',
    label: '2-1',
    focusValue: 9,
    prompt: '9는 평균 5보다 큰 자료예요. 9가 평균보다 얼마나 큰지가 막대 그림과 시소 그림에서 각각 어떻게 나타나는지 찾아보세요.',
    modelAnswer:
      '[막대 그림] 9인 막대의 끝은 평균선에서 위로 4칸 떨어져 있다. 9가 평균보다 4만큼 크다는 뜻이다. ' +
      '[시소 그림] 9의 추는 받침점에서 오른쪽으로 4칸 떨어져 있다. 이것도 9가 평균보다 4만큼 크다는 뜻이다. ' +
      '[이어 보기] 두 수는 4로 같다. 막대 그림의 넘친 칸이 시소 그림에서는 추와 받침점 사이의 거리가 된다.',
    ideas: [
      {
        id: 'q2a_bar',
        part: 'bar',
        ask: '9인 막대의 끝은 평균선에서 어느 쪽으로 몇 칸 떨어져 있나요? 이것은 9가 평균과 비교해 어떻다는 뜻일까요?',
        teacher: '평균선 위로 4칸 → 9가 평균보다 4만큼 크다 (넘친 4칸을 다른 막대에 나눠 줄 수 있음)',
        accept: '위로 4칸, 9-5=4, 평균보다 4 크다, 4만큼 넘친다, 4를 나눠 줄 수 있다',
        hint: 'EXCESS_TO_DISTANCE',
        hintTarget: 9,
        groups: [
          ['4', '넷', '네\\s*칸'],
          ['크', '큰', '많', '넘', '차이', '남', '나눠', '나누', '줄\\s*수'],
        ],
      },
      {
        id: 'q2a_beam',
        part: 'beam',
        ask: '9의 추는 받침점에서 어느 쪽으로 몇 칸 떨어져 있나요? 이것은 9가 평균과 비교해 어떻다는 뜻일까요?',
        teacher: '받침점 오른쪽으로 4칸 → 9가 평균(받침점)보다 4만큼 크다',
        accept: '오른쪽으로 4칸, 평균보다 4 크다, 받침점(평균)에서 4만큼 떨어져 있으니 4 크다, 시소를 오른쪽으로 기울게 한다',
        hint: 'EXCESS_TO_DISTANCE',
        hintTarget: 9,
        groups: [
          ['4', '넷', '네\\s*칸'],
          ['크', '큰', '많', '차이', '기울', '무거', '누르', '눌러'],
        ],
      },
      {
        id: 'q2a_link',
        part: 'link',
        ask: '두 그림에서 찾은 수를 비교해 보세요. 막대 그림에서 평균선 위로 넘친 칸은 시소 그림에서 무엇이 되나요?',
        teacher: '두 수가 4로 같다 → 막대의 넘친 칸 수가 추와 받침점 사이의 거리가 된다',
        accept: '둘 다 4로 같다, 넘친 칸이 추와 받침점 사이 거리가 됐다, 넘친 4칸 = 떨어진 4칸',
        hint: 'CELLS_TO_DISTANCE',
        groups: [['거리', '떨어', '사이', '간격', '추', '받침']],
      },
    ],
  },
  {
    id: 'q2b',
    label: '2-2',
    focusValue: 2,
    prompt: '2는 평균 5보다 작은 자료예요. 2가 평균보다 얼마나 작은지가 막대 그림과 시소 그림에서 각각 어떻게 나타나는지 찾아보세요.',
    modelAnswer:
      '[막대 그림] 2인 막대의 끝은 평균선에서 아래로 3칸 떨어져 있다(평균선까지 3칸 모자란다). 2가 평균보다 3만큼 작다는 뜻이다. ' +
      '[시소 그림] 2의 추는 받침점에서 왼쪽으로 3칸 떨어져 있다. 이것도 2가 평균보다 3만큼 작다는 뜻이다. ' +
      '[이어 보기] 두 수는 3으로 같다. 막대 그림에서 평균선 아래로 부족한 칸이 시소 그림에서는 추와 받침점 사이의 거리(받침점 왼쪽)가 된다.',
    ideas: [
      {
        id: 'q2b_bar',
        part: 'bar',
        ask: '2인 막대의 끝은 평균선에서 어느 쪽으로 몇 칸 떨어져 있나요? 이것은 2가 평균과 비교해 어떻다는 뜻일까요?',
        teacher: '평균선 아래로 3칸(평균선까지 3칸 모자람) → 2가 평균보다 3만큼 작다 (평균이 되려면 3을 받아야 함)',
        accept: '아래로 3칸, 3칸 모자란다, 5-2=3, 평균보다 3 작다, 3을 더 받아야 한다',
        hint: 'DEFICIT_TO_GAP',
        hintTarget: 2,
        groups: [
          ['3', '셋', '세\\s*칸'],
          ['작', '적', '모자', '부족', '받아', '받으', '차이', '덜'],
        ],
      },
      {
        id: 'q2b_beam',
        part: 'beam',
        ask: '2의 추는 받침점에서 어느 쪽으로 몇 칸 떨어져 있나요? 이것은 2가 평균과 비교해 어떻다는 뜻일까요?',
        teacher: '받침점 왼쪽으로 3칸 → 2가 평균(받침점)보다 3만큼 작다',
        accept: '왼쪽으로 3칸, 평균보다 3 작다, 받침점(평균)에서 왼쪽으로 3만큼 떨어져 있으니 3 작다, 시소를 왼쪽으로 기울게 한다',
        hint: 'DEFICIT_TO_GAP',
        hintTarget: 2,
        groups: [
          ['3', '셋', '세\\s*칸'],
          ['작', '적', '모자', '부족', '차이', '덜', '가벼', '기울'],
        ],
      },
      {
        id: 'q2b_link',
        part: 'link',
        ask: '두 그림에서 찾은 수를 비교해 보세요. 막대 그림에서 평균선 아래로 부족한 칸은 시소 그림에서 무엇이 되나요?',
        teacher: '두 수가 3으로 같다 → 막대의 부족한(모자란) 칸 수가 추와 받침점 사이의 거리(받침점 왼쪽)가 된다',
        accept: '둘 다 3으로 같다, 부족한 칸이 추와 받침점 사이 거리가 됐다, 모자란 3칸 = 떨어진 3칸, 왼쪽 거리가 된다',
        hint: 'CELLS_TO_DISTANCE',
        groups: [['거리', '떨어', '사이', '간격', '추', '받침']],
      },
    ],
  },
  {
    id: 'q3a',
    label: '3-1',
    prompt:
      "초록색을 평균 5에 두고 '칸' 버튼을 눌러 보세요. 평균보다 큰 쪽과 작은 쪽을 막대 그림과 시소 그림에서 각각 모두 세어 보세요.",
    modelAnswer:
      '[막대 그림] 넘친 칸은 1+2+4=7칸, 모자란 칸은 3+2+1+1=7칸이다. ' +
      '[시소 그림] 받침점 오른쪽 추들의 거리는 1+2+4=7칸, 왼쪽 추들의 거리는 3+2+1+1=7칸이다. ' +
      '[이어 보기] 네 수가 모두 7이다. 넘친 칸의 합은 오른쪽 거리의 합과, 모자란 칸의 합은 왼쪽 거리의 합과 같은 것을 나타낸다.',
    ideas: [
      {
        id: 'q3a_bar',
        part: 'bar',
        ask: '평균선 위로 넘친 칸은 모두 몇 칸이고, 평균선까지 모자란 칸은 모두 몇 칸인가요?',
        teacher: '넘친 칸 1+2+4=7, 모자란 칸 3+2+1+1=7',
        accept: '넘친 칸 7칸 모자란 칸 7칸, 둘 다 7',
        hint: 'LEVELING',
        groups: [
          ['7', '일곱'],
          ['넘', '모자', '남', '부족', '둘\\s*다', '모두'],
        ],
      },
      {
        id: 'q3a_beam',
        part: 'beam',
        ask: '받침점 오른쪽 추들의 거리는 모두 몇 칸이고, 받침점 왼쪽 추들의 거리는 모두 몇 칸인가요?',
        teacher: '오른쪽 거리의 합 1+2+4=7, 왼쪽 거리의 합 3+2+1+1=7',
        accept: '오른쪽 7칸 왼쪽 7칸, 양쪽 다 7',
        hint: 'SUM_BALANCE',
        groups: [
          ['7', '일곱'],
          ['왼', '오른', '양쪽', '둘\\s*다', '모두'],
        ],
      },
      {
        id: 'q3a_link',
        part: 'link',
        ask: '두 그림에서 구한 네 수를 비교해 보세요. 막대 그림의 어떤 합과 시소 그림의 어떤 합이 같은 것을 나타내나요?',
        teacher: '넘친 칸의 합(7) = 오른쪽 거리의 합(7), 모자란 칸의 합(7) = 왼쪽 거리의 합(7)',
        accept: '넘친 칸 합과 오른쪽 거리 합, 모자란 칸 합과 왼쪽 거리 합, 넘친 칸은 오른쪽 모자란 칸은 왼쪽',
        hint: 'CELLS_TO_DISTANCE',
        groups: [
          ['넘', '모자', '칸'],
          ['오른', '왼', '거리'],
        ],
      },
    ],
  },
  {
    id: 'q3b',
    label: '3-2',
    prompt:
      '3-1에서 막대 그림의 넘친 칸과 모자란 칸의 합이 같았고, 시소 그림의 오른쪽과 왼쪽 거리의 합도 같았어요. 이것이 막대 그림과 시소 그림에서 각각 무엇을 뜻하는지 알아보세요.',
    modelAnswer:
      '[막대 그림] 넘친 칸으로 모자란 칸을 남김없이 꼭 맞게 채울 수 있어서 모든 막대가 평균 5로 고르게 된다. ' +
      '[시소 그림] 오른쪽 거리의 합과 왼쪽 거리의 합이 같아서 양쪽 추들이 시소를 기울게 하는 정도가 같으므로 시소가 평평해진다. ' +
      '[이어 보기] 넘친 칸은 시소 그림에서 오른쪽 거리이고, 모자란 칸은 왼쪽 거리이니까, 넘친 칸의 합과 모자란 칸의 합이 같으면 오른쪽 거리의 합과 왼쪽 거리의 합도 같아져서 시소가 평평해진다. 그래서 막대들이 고르게 되는 것과 시소가 평평해지는 것은 같은 뜻이다.',
    ideas: [
      {
        id: 'q3b_bar',
        part: 'bar',
        ask: '넘친 칸의 합과 모자란 칸의 합이 같으면 막대들은 어떻게 될 수 있나요? 넘친 칸을 떼어 모자란 칸에 채운다고 생각해 보세요.',
        teacher: '넘친 칸으로 모자란 칸을 남김없이 꼭 맞게 채울 수 있음 → 모든 막대가 평균 5로 고르게 된다',
        accept: '모두 5가 된다, 막대 높이가 똑같아진다, 남는 칸도 모자란 칸도 없이 딱 맞는다, 고르게 된다',
        hint: 'LEVELING',
        groups: [
          [
            '똑같',
            '같아',
            '같은',
            '고르',
            '평평',
            '나란',
            '딱',
            '꼭',
            '남김\\s*없',
            '남지',
            '남는\\s*(칸|것)?\\s*(이|도)?\\s*없',
            '모두\\s*5',
            '다\\s*5',
            '5가\\s*(돼|되)',
          ],
        ],
      },
      {
        id: 'q3b_beam',
        part: 'beam',
        ask: '오른쪽 거리의 합과 왼쪽 거리의 합이 같으면 시소는 어떻게 되나요? 양쪽 추들이 시소를 기울게 하는 정도를 생각해 보세요.',
        teacher: '양쪽 거리의 합이 같아 양쪽으로 기울게 하는 정도가 같다 → 시소가 평평해진다',
        accept: '평평해진다, 기울지 않는다, 양쪽이 똑같이 기울게 해서 균형이 맞는다',
        hint: 'SUM_BALANCE',
        groups: [['평평', '수평', '균형', '기울지', '안\\s*기울', '반듯']],
      },
      {
        id: 'q3b_link',
        part: 'link',
        ask: "넘친 칸의 합과 모자란 칸의 합이 같으면 왜 시소도 평평해질까요? '넘친 칸은 시소 그림에서 (\u00a0\u00a0\u00a0\u00a0)이고, 모자란 칸은 (\u00a0\u00a0\u00a0\u00a0)이니까 …'처럼 이어서 써 보세요.",
        teacher:
          '넘친 칸 = 받침점 오른쪽 추들의 거리, 모자란 칸 = 왼쪽 추들의 거리 → 두 칸의 합이 같으면 양쪽 거리의 합도 같아 시소가 평평해짐 (막대가 고르게 되는 것과 시소가 평평해지는 것은 같은 뜻)',
        accept:
          '넘친 칸은 오른쪽 거리이고 모자란 칸은 왼쪽 거리이니까 양쪽 거리의 합도 같아져서 평평해진다, 넘친 칸 = 오른쪽 거리이고 모자란 칸 = 왼쪽 거리라서',
        hint: 'CELLS_TO_DISTANCE',
        groups: [
          ['넘', '모자', '칸'],
          ['오른', '왼', '거리'],
        ],
      },
    ],
  },
  {
    id: 'q4',
    label: '4',
    prompt:
      "오른쪽 위 '새로운 자료'에서 막대나 추를 놓아 나만의 자료를 만들어 보세요(평균이 자연수가 되게 만들면 쉬워요). 1~3번에서 한 것을 막대 그림과 시소 그림에서 각각 다시 확인해 보세요.",
    modelAnswer:
      '예) 내 자료 3, 5, 10의 평균은 6이다. [막대 그림] 초록색을 6에 두면 넘친 칸은 10-6=4칸, 모자란 칸은 (6-3)+(6-5)=4칸이다. ' +
      '[시소 그림] 초록색을 6에 두면 시소가 평평해지고, 오른쪽 거리의 합 4와 왼쪽 거리의 합 3+1=4가 같다. ' +
      '[이어 보기] 자료가 바뀌어도 평균에서 넘친 칸의 합과 모자란 칸의 합이 같고, 받침점을 평균에 두면 시소가 평평해진다.',
    usesCustomData: true,
    ideas: [
      {
        id: 'q4_bar',
        part: 'bar',
        ask: '내 자료와 평균을 쓰고, 초록색을 평균에 두었을 때 넘친 칸의 합과 모자란 칸의 합을 구해 보세요.',
        teacher: '자신이 만든 자료와 평균, 넘친 칸의 합과 모자란 칸의 합을 수로 구함',
        accept: '자료 3, 5, 10, 평균 6, 넘친 칸 4칸 모자란 칸 4칸',
        hint: 'LEVELING',
        groups: [['\\d'], ['넘', '모자', '칸', '합']],
      },
      {
        id: 'q4_beam',
        part: 'beam',
        ask: '초록색을 평균에 두었을 때 시소가 어떻게 되는지 쓰고, 오른쪽 거리의 합과 왼쪽 거리의 합을 구해 보세요.',
        teacher: '받침점을 평균에 두면 시소가 평평해짐, 양쪽 거리의 합을 수로 구함',
        accept: '받침점 6에서 평평, 시소가 평평해진다, 오른쪽 거리 합 4 왼쪽 거리 합 4',
        hint: 'MEAN_LINK',
        groups: [['\\d'], ['평평', '수평', '받침', '거리', '왼', '오른']],
      },
      {
        id: 'q4_link',
        part: 'link',
        ask: '처음 자료와 비교해 보세요. 자료가 바뀌어도 두 그림에서 똑같이 나타나는 것은 무엇인가요?',
        teacher: '자료가 달라도 평균에서 넘친 칸의 합 = 모자란 칸의 합, 받침점을 평균에 두면 양쪽 거리의 합이 같아 시소가 평평 (항상 성립)',
        accept: '이번에도 넘친 칸과 모자란 칸의 합이 같고 시소도 평균에서 평평해진다, 초록색을 평균에 두면 언제나 고르게 되고 평평해진다',
        hint: 'SUM_BALANCE',
        groups: [['같', '똑같', '일치', '성립', '항상', '역시', '마찬가지', '언제나', '평평', '수평', '평균']],
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

// "시소 그림", "막대 그림"처럼 발문을 옮겨 적은 말 때문에 잘못 채점되지 않도록 지운다.
export function normalizeAnswer(s: string) {
  return s
    .replace(/(시소|균형점)\s*그림/g, ' ')
    .replace(/막대\s*그림/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 너무 짧거나 문항·발문을 그대로 옮겨 적은 답
export function isCopyOfPrompt(q: Question, idea: Idea, answer: string) {
  const a = answer.replace(/\s+/g, '');
  return a.length < 2 || q.prompt.replace(/\s+/g, '').includes(a) || idea.ask.replace(/\s+/g, '').includes(a);
}

// '모르겠어요', '몰라' 같은 짧은 답은 채점할 내용이 없는 것으로 본다
export function isDontKnow(answer: string) {
  const a = answer.replace(/\s+/g, '');
  return a.length <= 15 && /(모르|몰라|몰루|몰랑|글쎄|잘\s*모|패스|pass|\?{2,})/i.test(a);
}

// 비었거나, 모른다고 했거나, 발문을 옮겨 적은 칸은 채점하지 않는다
export function isBlankPart(q: Question, idea: Idea, answer: string | undefined) {
  const a = (answer ?? '').trim();
  return !a || isDontKnow(a) || isCopyOfPrompt(q, idea, a);
}

// 기록·교사용 메모에 남길 한 줄 답: [막대 그림에서] … / [시소 그림에서] …
export function joinAnswer(q: Question, parts: PartAnswers) {
  return q.ideas
    .map((i) => [i, (parts[i.id] ?? '').trim()] as const)
    .filter(([, t]) => t)
    .map(([i, t]) => `[${PART_TITLE[i.part]}] ${t}`)
    .join('\n');
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

// 아이디어마다 그 칸에 쓴 답만 본다
export function ruleEvaluate(q: Question, parts: PartAnswers): EvalResult {
  const found = q.ideas
    .filter((idea) => {
      const raw = parts[idea.id];
      if (isBlankPart(q, idea, raw)) return false;
      const text = normalizeAnswer(raw ?? '');
      return idea.groups.every((g) => g.some((pat) => new RegExp(pat).test(text)));
    })
    .map((i) => i.id);
  const missing = q.ideas.map((i) => i.id).filter((id) => !found.includes(id));
  const verdict = verdictFrom(q, found);
  const foundDesc = q.ideas.filter((i) => found.includes(i.id)).map((i) => `[${PART_TITLE[i.part]}] ${i.teacher}`);
  const missingDesc = q.ideas.filter((i) => missing.includes(i.id)).map((i) => `[${PART_TITLE[i.part]}] ${i.teacher}`);
  return {
    verdict,
    foundIdeaIds: found,
    missingIdeaIds: missing,
    hints: verdict === 'PASS' ? [] : hintsForMissing(q, missing),
    teacherLog: `[규칙 채점] 충족: ${foundDesc.join(' / ') || '없음'} | 부족: ${missingDesc.join(' / ') || '없음'}`,
    source: 'rule',
  };
}
