// 활동 2: 학생의 답이 '맞는지'를 규칙으로 가린다. 틀리면 도움이 한 단계 오르고, 맞을 때까지 다음으로 넘어가지 못한다.
// - 예상하기(1·2번)는 고른 예상이 결과와 같아야 할 뿐 아니라 까닭도 맞아야 한다:
//   자료와 관련 있는 말(넘친 칸·모자란 칸, 기운 쪽·거리)로 견주었는지, 쓴 말이 실제 자료와 어긋나지 않는지, 대응이 뒤집히지 않았는지.
// - 초등학생이 쓰는 말(위로 올라온 칸, 비어 있는 칸, 반듯해요 …)과 짧은 글도 인정한다. 맞춤법·띄어쓰기·글 길이는 보지 않는다.
// - 엉뚱한 말("그냥", "9가 커서", "막대가 7개라서")이나 자료와 어긋나는 말은 틀린 것으로 본다.
// 이 규칙은 숫자와 낱말만 보는 것이라 완벽하지 않다. 그래서 막혔을 때 선생님이 풀어 줄 수 있다(도움 4단계).

import {
  BarSides,
  COMPENSATE,
  Prediction,
  PREDICT,
  PredictTaskId,
  TaskId,
  Tilt,
  VALUE_ONLY,
  barSidesAt,
  isDontKnow,
  mappingDirection,
  normalizeAnswer,
  outcomeAt,
  tiltAt,
} from './questions';

export interface CheckResult {
  ok: boolean;
  why: string[]; // 틀린 까닭 (교사 기록용)
}
const result = (why: string[]): CheckResult => ({ ok: why.length === 0, why });

const clean = (raw: string) => normalizeAnswer(raw.replace(/^\[예상\].*$/gm, ''));
const SENTENCE = /[.!?\n;]/;
const CLAUSE = /,|이고|이며|그리고|하고|지만|는데/;

// ---- 낱말 ----
const OVER_G = /(넘|위로|위에|위쪽|올라|튀어|큰\s*쪽)/g;
const UNDER_G = /(모자|부족|아래|아랫|밑|비어|빈\s*칸|빈칸|비는|작은\s*쪽)/g;
const OVER_T = new RegExp(OVER_G.source);
const UNDER_T = new RegExp(UNDER_G.source);
const BAR_CONCEPT = /(넘|모자|부족|위로|위에|아래|튀어|올라|비어|빈\s*칸|빈칸|비는|칸|거리)/;
const FLAT_WORD = /(평평|수평|균형|안\s*기울|기울지|안\s*내려|반듯|똑바|가만|나란|흔들리지)/;
const SEESAW_CONCEPT = new RegExp(`(기울|내려|눌려|평평|수평|균형|거리|떨어|멀|가깝|오른|왼|받침|무거|가벼|${FLAT_WORD.source.slice(1, -1)})`);
const COMPARATOR = /(많|적|크|작|길|짧|같|똑같|비슷|비교|더|보다|[0-9]+\s*칸)/;
const RELATION_WORD = /(넘|모자|부족|많|적|같|똑같|칸|부분)/;
const OPERATION = /(자료|추|막대|값|더|빼|지우|옮|올|내리|내려|놓|놔|넣|하나|개|바꾸|움직|[0-9])/;
const CONDITIONAL = /(으면|이면|라면|다면|하면|가면|려면|면\s)/; // "…이면 오른쪽이 내려가요"처럼 규칙을 말하는 문장

const lastIndexOf = (s: string, re: RegExp) => {
  let last = -1;
  const g = new RegExp(re.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(s))) last = m.index;
  return last;
};

// 이번 자료에 대해 한 말(규칙을 말하는 문장은 제외): 넘친 것과 모자란 것 중 어느 쪽이 더 많은지 / 시소의 모습
function claims(text: string) {
  const relation = new Set<BarSides>();
  const tilt = new Set<Tilt>();
  for (const sentence of text.split(SENTENCE)) {
    if (CONDITIONAL.test(sentence)) continue;
    for (const c of sentence.split(CLAUSE)) {
      const hasO = OVER_T.test(c);
      const hasU = UNDER_T.test(c);
      if (/(같|똑같|비슷|동일)/.test(c) && hasO && hasU) relation.add('equal');
      const re = /(많|크|큰|길|적|작|짧)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c))) {
        const before = c.slice(Math.max(0, m.index - 14), m.index);
        let o = lastIndexOf(before, OVER_T);
        let u = lastIndexOf(before, UNDER_T);
        if (o < 0 && u < 0) continue;
        let subject: BarSides = o > u ? 'over' : 'under';
        // "넘친 칸이 모자란 칸보다 많아요": '보다' 앞의 것이 견주는 대상이고, 많은 쪽은 그 반대다
        const than = c.slice(0, m.index).lastIndexOf('보다');
        if (than >= 0) {
          const head = c.slice(0, than);
          o = lastIndexOf(head, OVER_T);
          u = lastIndexOf(head, UNDER_T);
          if (o >= 0 || u >= 0) subject = o > u ? 'under' : 'over';
        }
        const more = /(많|크|큰|길)/.test(m[0]);
        relation.add(more ? subject : subject === 'over' ? 'under' : 'over');
      }
      if (/(오른쪽?)[^.,]{0,8}(내려|눌려|기울|무거|낮)/.test(c)) tilt.add('right');
      if (/(왼쪽?)[^.,]{0,8}(내려|눌려|기울|무거|낮)/.test(c)) tilt.add('left');
      if (FLAT_WORD.test(c)) tilt.add('flat');
    }
  }
  // "넘친 칸이 3칸, 모자란 칸이 10칸"처럼 두 쪽의 수를 모두 말했으면 그 수의 크기로도 본다 (조금 잘못 센 것은 넘어가고, 두 수를 바꿔 쓴 것은 걸러 낸다)
  const over = /(넘|위로|위에|올라|튀어)[^0-9]{0,8}([0-9]+)\s*(칸|개)/.exec(text);
  const under = /(모자|부족|아래|비어|빈\s*칸|빈칸)[^0-9]{0,8}([0-9]+)\s*(칸|개)/.exec(text);
  if (over && under) {
    const a = Number(over[2]);
    const b = Number(under[2]);
    relation.add(a === b ? 'equal' : a > b ? 'over' : 'under');
  }
  return { relation, tilt };
}

const tooShort = (text: string) => text.replace(/\s+/g, '').length < 4;
const emptyAnswer = (text: string) => !text || isDontKnow(text) || tooShort(text);

// ---- 1·2번 예상하기: 고른 예상과 까닭이 모두 맞아야 한다 ----
export interface PredictJudgement {
  ok: boolean;
  selectionOk: boolean;
  reasonOk: boolean;
  why: string[];
}

export function judgePrediction(task: PredictTaskId, p: number, prediction: Prediction | undefined, raw: string): PredictJudgement {
  const values = PREDICT[task].values;
  const actual = outcomeAt(task, values, p);
  const rel = barSidesAt(values, p);
  const tilt = tiltAt(values, p);
  const text = clean(raw);
  const why: string[] = [];

  const selectionOk = !!prediction && prediction !== 'unsure' && prediction === actual;
  if (!selectionOk) why.push(prediction === 'unsure' ? '“아직 모르겠어요”를 고름' : '고른 예상이 결과와 다름');

  const reasonWhy: string[] = [];
  if (emptyAnswer(text)) {
    reasonWhy.push('까닭이 비었거나 너무 짧음/“모르겠어요”');
  } else {
    if (task === 'predictSeesaw') {
      if (!BAR_CONCEPT.test(text)) reasonWhy.push('막대 그림의 넘친 칸·모자란 칸을 말하지 않음');
      else if (!COMPARATOR.test(text)) reasonWhy.push('넘친 칸과 모자란 칸을 견주지 않음');
    } else {
      if (!SEESAW_CONCEPT.test(text)) reasonWhy.push('시소가 기운 쪽이나 거리를 말하지 않음');
      else if (!RELATION_WORD.test(text)) reasonWhy.push('넘친 부분·모자란 부분과 이어 말하지 않음');
    }
    const { forward, reversed } = mappingDirection(text);
    if (reversed && !forward) reasonWhy.push('넘침·모자람과 오른쪽·왼쪽을 뒤집어 말함');
    const c = claims(text);
    if (c.relation.size && !c.relation.has(rel)) reasonWhy.push('넘친 것과 모자란 것 중 어느 쪽이 많은지 자료와 다르게 말함');
    if (c.tilt.size && !c.tilt.has(tilt)) reasonWhy.push('시소의 모습을 자료와 다르게 말함');
    if (VALUE_ONLY.test(text) && !BAR_CONCEPT.test(text)) reasonWhy.push('큰 수가 있다는 것만 보고 판단함');
  }
  why.push(...reasonWhy);
  const reasonOk = reasonWhy.length === 0;
  return { ok: selectionOk && reasonOk, selectionOk, reasonOk, why };
}

// ---- 예상을 세 번 해 본 뒤 정리하는 글 / 자료를 바꿔 본 뒤 정리하는 글 ----
export function checkReflect(task: TaskId, raw: string): CheckResult {
  const text = clean(raw);
  if (emptyAnswer(text)) return result(['글이 비었거나 너무 짧음/“모르겠어요”']);
  const why: string[] = [];
  const { forward, reversed } = mappingDirection(text);
  if (reversed && !forward) why.push('넘침·모자람과 오른쪽·왼쪽을 뒤집어 말함');
  if (task === 'predictSeesaw') {
    if (!BAR_CONCEPT.test(text)) why.push('막대 그림의 넘친 칸·모자란 칸을 말하지 않음');
    else if (!COMPARATOR.test(text)) why.push('넘친 칸과 모자란 칸을 견주지 않음');
  } else if (task === 'predictBars') {
    if (!SEESAW_CONCEPT.test(text)) why.push('시소가 기운 쪽이나 거리를 말하지 않음');
  } else if (task === 'change') {
    if (!(FLAT_WORD.test(text) || COMPENSATE.test(text) || /기울/.test(text))) why.push('시소가 평평한지/기우는지를 말하지 않음');
    else if (!OPERATION.test(text)) why.push('어떻게 바꾸었는지를 말하지 않음');
  }
  return result(why);
}

// ---- 3번 ‘두 그림을 이어 보면’: 평균이 두 그림에서 각각 무슨 뜻이고 어떻게 이어지는지 ----
// 인정: ① 평균(초록 선·받침점·균형)을 말하면서 넘친 칸·모자란 칸·거리·합·평평함 같은 연결을 말함,
//       ② 넘친 칸과 모자란 칸이 같다/시소가 평평하다처럼 두 그림에서 똑같이 나타나는 것을 말함.
const MEAN_WORD = /(평균|균형|받침점|초록)/;
const CONNECT_WORD = /(넘|모자|거리|합|평평|수평|균형|같|똑같|연결|대응|이어|오른|왼|높이|칸|기준|차이)/;
export function checkLink(raw: string): CheckResult {
  const text = clean(raw);
  if (emptyAnswer(text)) return result(['글이 비었거나 너무 짧음/“모르겠어요”']);
  const why: string[] = [];
  const { forward, reversed } = mappingDirection(text);
  if (reversed && !forward) why.push('넘침·모자람과 오른쪽·왼쪽을 뒤집어 말함');
  const meanLink = MEAN_WORD.test(text) && CONNECT_WORD.test(text);
  const same = /(같|똑같|비슷|동일|마찬가지)/.test(text) && /(넘|모자|합|거리|양쪽|왼쪽|오른쪽|높이|칸)/.test(text);
  if (!(meanLink || FLAT_WORD.test(text) || same)) why.push('평균의 뜻과 두 그림의 연결(넘친 칸·모자란 칸·거리·평평함)을 말하지 않음');
  return result(why);
}

// ---- 4번 ‘바꾸기 전 예상’: 평평하게 지키는 방법에 대한 생각 ----
export function checkMethod(raw: string): CheckResult {
  const text = clean(raw);
  if (emptyAnswer(text)) return result(['글이 비었거나 너무 짧음/“모르겠어요”']);
  const why: string[] = [];
  if (!(COMPENSATE.test(text) || FLAT_WORD.test(text) || /기울/.test(text))) why.push('시소가 평평한지/기우는지를 말하지 않음');
  else if (!OPERATION.test(text)) why.push('자료를 어떻게 바꿀지를 말하지 않음');
  return result(why);
}
