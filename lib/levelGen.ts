import { Block } from '../types';
import { ITEM_COLORS } from './palette';

// 활동 1: 이전 자료는 그대로 두고 새 자료를 더해, 평균(정답 자리)이 자연수(또는 0.5 단위)가 되게 만든다.
// 새 자료는 여러 자리에 고르게 놓는다. 예전에는 새 자료가 한 곳에만 쌓였다:
// 자료 1개·자연수 정답 단계에서는 자료가 5개쯤 쌓이면 정답을 자연수로 두는 자리가 지금 정답 자리뿐이라
// 새 자료가 매번 정답 자리에 놓였고(정답도 그대로), 자료 2개 단계에서는 정답 자리를 멀리 옮기려고 1이나 10에 쌓였다.
// - 한 단계에 정해진 개수(1개, 빨리 풀면 2개)만 놓는다. 그 개수로는 자연수·0.5 정답을 만들 수 없을 때만 더 놓는다.
// - 정답 자리는 되도록 이전 정답과 다르게 한다. 자연수 정답 단계라도 정해진 개수로 자연수 정답을 바꿀 수 없으면
//   그 단계만 0.5 단위 정답을 허용한다.
// - 정답 자리는 2~9 사이에 둔다(시소 끝에 붙지 않게).
// - 한 자리에는 자료를 3개까지만 쌓는다.
// - 이미 자료가 많은 자리, 새 자료끼리 같은 자리, 시소 끝(1·10)은 피하고, 그중에서 무작위로 고른다.
// - 그래도 받침점이 새 정답 자리와 너무 가까우면 활동 1이 받침점을 멀리 옮겨 놓고 시작한다(startFulcrum).
// - 정답 자리가 양 끝 자료의 한가운데나 가운데 자료와 같아지는 문제는 덜 고른다(오개념과 구별되도록).

const MIN_V = 1;
const MAX_V = 10;
const MAX_STACK = 3;
const MAX_ADD = 5;

// k개의 값(1~10)을 작은 것부터 고르는 모든 경우 (같은 값 허용)
function combos(k: number, from = MIN_V): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let v = from; v <= MAX_V; v++) for (const rest of combos(k - 1, v)) out.push([v, ...rest]);
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Rules {
  range: [number, number]; // 정답 자리가 놓일 범위
  maxStack: number; // 한 자리에 쌓을 수 있는 자료
}

// 새 문제의 받침점 시작 자리: 지금 받침점이 새 정답 자리에서 1칸 이상 떨어져 있으면 그대로 두고,
// 너무 가까우면(그대로 맞아 버리면) 정답 자리에서 3칸 떨어진 쪽(가능하면 가운데 5.5)으로 옮긴다.
export function startFulcrum(current: number, mean: number): number {
  if (Math.abs(current - mean) >= 1) return current;
  if (Math.abs(5.5 - mean) >= 1.5) return 5.5;
  return mean <= 5.5 ? Math.min(MAX_V, mean + 3) : Math.max(MIN_V, mean - 3);
}

export function generateNewBlocks(currentBlocks: Block[], minBlocksToAdd: number, forceInteger: boolean): Block[] {
  const colorAt = (idx: number) => ITEM_COLORS[(currentBlocks.length + idx) % ITEM_COLORS.length];
  const toBlocks = (positions: number[]) =>
    positions.map((pos, idx) => ({
      id: `block-${Date.now()}-${idx}-${pos}`,
      position: pos,
      weight: 1,
      color: colorAt(idx),
      isNew: true,
    }));

  // 첫 문제: 서로 다른 위치의 자료 2개, 평균은 가운데 쪽 자연수 (예: 3과 7 → 5)
  if (currentBlocks.length === 0 && minBlocksToAdd === 2) {
    const avg = 3 + Math.floor(Math.random() * 5); // 3~7
    const maxD = Math.min(avg - MIN_V, MAX_V - avg);
    const d = 1 + Math.floor(Math.random() * maxD);
    return toBlocks(shuffle([avg - d, avg + d]));
  }

  const positions = currentBlocks.map((b) => b.position);
  const n = positions.length;
  const sum = positions.reduce((a, b) => a + b, 0);
  const prevAvg = n > 0 ? sum / n : 5.5;
  const counts = new Map<number, number>();
  positions.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));

  // 조건을 지키는 경우가 없으면 차례로 조금씩 느슨하게 한다
  const ladder: Rules[] = [
    { range: [2, 9], maxStack: MAX_STACK },
    { range: [1.5, 9.5], maxStack: MAX_STACK + 1 },
    { range: [1, 10], maxStack: 99 },
  ];

  const kMin = Math.max(1, minBlocksToAdd);
  type Scored = { vals: number[]; score: number; move: number };
  const scoreFor = (k: number, rules: Rules, half: boolean): Scored[] => {
    const scored: Scored[] = [];
    for (const vals of combos(k)) {
      const total = sum + vals.reduce((a, b) => a + b, 0);
      const N = n + k;
      const ok = half ? (total * 2) % N === 0 : total % N === 0;
      if (!ok) continue;
      const avg = total / N;
      if (avg < rules.range[0] || avg > rules.range[1]) continue;
      const move = Math.abs(avg - prevAvg);
      const added = new Map<number, number>();
      vals.forEach((v) => added.set(v, (added.get(v) ?? 0) + 1));
      if ([...added].some(([v, c]) => (counts.get(v) ?? 0) + c > rules.maxStack)) continue;

      // 점수: 낮을수록 좋음
      const all = [...positions, ...vals];
      const crowd = vals.reduce((a, v) => a + (counts.get(v) ?? 0), 0); // 이미 자료가 있는 자리
      const dup = k - added.size; // 새 자료끼리 같은 자리
      const ends = vals.filter((v) => v === MIN_V || v === MAX_V).length; // 시소 끝
      const same = move < 1e-9 ? 1 : 0; // 이전 정답과 같은 정답 자리
      const farMove = Math.max(0, move - 3); // 너무 멀리 옮겨 가는 정답 자리
      const midrange = (Math.min(...all) + Math.max(...all)) / 2;
      const lookalike = (avg === midrange ? 1 : 0) + (avg === median(all) ? 0.5 : 0);
      scored.push({ vals, move, score: 1.2 * crowd + 2 * dup + 0.6 * ends + 6 * same + 0.8 * farMove + lookalike });
    }
    return scored;
  };
  const changes = (xs: Scored[]) => xs.some((x) => x.move > 1e-9);

  for (const rules of ladder) {
    // 정해진 개수로는 정답 자리를 자연수(0.5)로 만들 수 없을 때만 더 놓는다
    for (let k = kMin; k <= MAX_ADD; k++) {
      let scored = scoreFor(k, rules, !forceInteger);
      if (forceInteger && !changes(scored)) {
        // 자연수로는 정답을 바꿀 수 없는 단계: 이 단계만 0.5 정답을 허용한다
        const half = scoreFor(k, rules, true);
        if (changes(half) || !scored.length) scored = half;
      }
      if (!scored.length) continue;
      const best = Math.min(...scored.map((x) => x.score));
      const pool = scored.filter((x) => x.score <= best + 1);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return toBlocks(shuffle(pick.vals));
    }
  }

  // 여기까지 오지 않지만, 혹시 모를 경우 가운데에 하나 둔다
  return toBlocks([5]);
}
