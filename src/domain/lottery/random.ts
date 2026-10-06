import type { NumberPoolDefinition } from './types';

export interface RandomSource {
  next(): number;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string): RandomSource {
  let state = hashSeed(seed);

  return {
    next(): number {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

export function drawUniqueNumbers(
  pool: NumberPoolDefinition,
  random: RandomSource,
  excluded: readonly number[] = [],
): readonly number[] {
  const excludedNumbers = new Set(excluded);
  const candidates: number[] = [];

  for (let number = pool.min; number <= pool.max; number += 1) {
    if (!excludedNumbers.has(number)) {
      candidates.push(number);
    }
  }

  if (pool.count > candidates.length) {
    throw new Error('The number pool does not contain enough available values.');
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    const currentValue = candidates[index];
    const swapValue = candidates[swapIndex];
    if (currentValue === undefined || swapValue === undefined) {
      throw new Error('Random selection produced an invalid array index.');
    }
    candidates[index] = swapValue;
    candidates[swapIndex] = currentValue;
  }

  return candidates.slice(0, pool.count).sort((left, right) => left - right);
}
