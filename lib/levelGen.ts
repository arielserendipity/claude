import { Block } from '../types';
import { ITEM_COLORS } from './palette';

// 활동 1: 이전 추는 그대로 두고 새 추를 더해, 평균(균형점)이 자연수(또는 0.5 단위)가 되게 만든다.
export function generateNewBlocks(currentBlocks: Block[], minBlocksToAdd: number, forceInteger: boolean): Block[] {
  const minVal = 1;
  const maxVal = 10;
  const colorAt = (idx: number) => ITEM_COLORS[(currentBlocks.length + idx) % ITEM_COLORS.length];

  // 첫 문제: 서로 다른 위치의 추 2개, 평균은 가운데 쪽 자연수 (예: 3과 7 → 5)
  if (currentBlocks.length === 0 && minBlocksToAdd === 2) {
    const avg = 3 + Math.floor(Math.random() * 5); // 3~7
    const maxD = Math.min(avg - minVal, maxVal - avg);
    const d = 1 + Math.floor(Math.random() * maxD);
    return [avg - d, avg + d].map((pos, idx) => ({
      id: `block-${Date.now()}-${idx}-${pos}`,
      position: pos,
      weight: 1,
      color: colorAt(idx),
      isNew: true,
    }));
  }
  const currentSum = currentBlocks.reduce((acc, b) => acc + b.position, 0);

  let validOptions: { newSum: number; blocksCount: number; avg: number }[] = [];
  let actualBlocksToAdd = minBlocksToAdd;

  while (actualBlocksToAdd <= 10) {
    const totalCount = currentBlocks.length + actualBlocksToAdd;
    for (let newSum = actualBlocksToAdd * minVal; newSum <= actualBlocksToAdd * maxVal; newSum++) {
      const totalSum = currentSum + newSum;
      const avg = totalSum / totalCount;
      const isInt = totalSum % totalCount === 0;
      const isHalf = (totalSum * 2) % totalCount === 0;

      if (forceInteger && isInt) {
        validOptions.push({ newSum, blocksCount: actualBlocksToAdd, avg });
      } else if (!forceInteger && (isInt || isHalf)) {
        validOptions.push({ newSum, blocksCount: actualBlocksToAdd, avg });
      }
    }
    if (validOptions.length > 0) break;
    actualBlocksToAdd++;
  }

  if (validOptions.length === 0) {
    return Array.from({ length: minBlocksToAdd }).map((_, idx) => ({
      id: `block-${Date.now()}-${idx}`,
      position: 5,
      weight: 1,
      color: colorAt(idx),
      isNew: true,
    }));
  }

  const prevAvg = currentBlocks.length > 0 ? currentSum / currentBlocks.length : 5.5;

  // 이전 정답과 멀리 떨어진 평균 위치를 채택하여 받침점이 크게 움직이도록 유도
  validOptions.sort((a, b) => {
    const distB = Math.abs(b.avg - prevAvg) + Math.abs(b.avg - 5.5) * 0.1;
    const distA = Math.abs(a.avg - prevAvg) + Math.abs(a.avg - 5.5) * 0.1;
    return distB - distA;
  });

  const differentOptions = validOptions.filter((o) => Math.abs(o.avg - prevAvg) >= 0.5);
  if (differentOptions.length > 0) {
    validOptions = differentOptions;
  }

  const topCandidates = validOptions.slice(0, Math.max(1, Math.floor(validOptions.length / 3)));
  const selectedOption = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  let maxAttempts = 100;
  while (maxAttempts-- > 0) {
    const partition: number[] = [];
    let rSum = 0;
    let success = true;

    for (let i = 0; i < selectedOption.blocksCount - 1; i++) {
      const remaining = selectedOption.blocksCount - 1 - i;
      const minAllowed = Math.max(minVal, selectedOption.newSum - rSum - remaining * maxVal);
      const maxAllowed = Math.min(maxVal, selectedOption.newSum - rSum - remaining * minVal);

      if (minAllowed > maxAllowed) {
        success = false;
        break;
      }

      const val = Math.floor(Math.random() * (maxAllowed - minAllowed + 1)) + minAllowed;
      partition.push(val);
      rSum += val;
    }

    if (success) {
      const lastVal = selectedOption.newSum - rSum;
      if (lastVal >= minVal && lastVal <= maxVal) {
        partition.push(lastVal);
        return partition.map((pos, idx) => ({
          id: `block-${Date.now()}-${idx}-${pos}`,
          position: pos,
          weight: 1,
          color: colorAt(idx),
          isNew: true,
        }));
      }
    }
  }

  return Array.from({ length: selectedOption.blocksCount }).map((_, idx) => ({
    id: `block-${Date.now()}-${idx}`,
    position: Math.round(selectedOption.newSum / selectedOption.blocksCount),
    weight: 1,
    color: colorAt(idx),
    isNew: true,
  }));
}
