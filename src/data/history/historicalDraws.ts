import snapshotJson from './playnow-winning-numbers.json';

export type HistoricalGameId = 'lotto-max' | 'lotto-649' | 'bc-49' | 'daily-grand';

export interface HistoricalDraw {
  readonly gameId: HistoricalGameId;
  readonly drawNumber: number;
  readonly drawDate: string;
  readonly mainNumbers: readonly number[];
  readonly bonusNumber?: number;
  readonly extraNumbers: readonly number[];
}

export interface FrequencyEntry {
  readonly number: number;
  readonly count: number;
  readonly percent: number;
}

export interface CombinationFrequency {
  readonly numbers: readonly number[];
  readonly count: number;
  readonly percentOfDraws: number;
}

export interface CombinationAnalysis {
  readonly top: readonly CombinationFrequency[];
  readonly drawsAnalyzed: number;
  readonly totalOccurrences: number;
  readonly uniqueCombinations: number;
  readonly repeatedCombinations: number;
  readonly repeatedOccurrences: number;
  readonly maximumFrequency: number;
  readonly possibleCombinations: number;
}

export interface NumberRankEntry extends FrequencyEntry {
  readonly rank: number;
  readonly averageDrawGap: number | null;
  readonly currentDrought: number;
}

export interface DistributionStatistics {
  readonly values: number[];
  readonly mean: number;
  readonly median: number;
  readonly variance: number;
  readonly standardDeviation: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly averageSumPerDraw: number;
  readonly averageSpanPerDraw: number;
  readonly averageAdjacentGap: number | null;
  readonly evenCount: number;
  readonly oddCount: number;
}

export const historicalGameConfig: Record<
  HistoricalGameId,
  { readonly label: string; readonly maxNumber: number; readonly accent: string }
> = {
  'lotto-max': { label: 'Lotto Max', maxNumber: 52, accent: '#73be22' },
  'lotto-649': { label: 'Lotto 6/49', maxNumber: 49, accent: '#005293' },
  'bc-49': { label: 'BC/49', maxNumber: 49, accent: '#d1272e' },
  'daily-grand': { label: 'Daily Grand', maxNumber: 49, accent: '#f58220' },
};

interface Snapshot {
  readonly schemaVersion: number;
  readonly source: string;
  readonly sourceApi: string;
  readonly fetchedAt: string;
  readonly range: { readonly from: string; readonly to: string };
  readonly drawCount: number;
  readonly draws: readonly HistoricalDraw[];
}

export const historicalDrawSnapshot = snapshotJson as Snapshot;

function selectedDrawNumbers(draw: HistoricalDraw, kind: 'main' | 'bonus'): number[] {
  if (kind === 'main') return [...draw.mainNumbers];
  return typeof draw.bonusNumber === 'number' ? [draw.bonusNumber] : [];
}

export function drawsForGame(
  gameId: HistoricalGameId,
  from = historicalDrawSnapshot.range.from,
  to = historicalDrawSnapshot.range.to,
): readonly HistoricalDraw[] {
  return historicalDrawSnapshot.draws
    .filter((draw) => draw.gameId === gameId && draw.drawDate >= from && draw.drawDate <= to)
    .sort((left, right) => right.drawDate.localeCompare(left.drawDate));
}

export function numberFrequencies(
  gameId: HistoricalGameId,
  kind: 'main' | 'bonus' = 'main',
  from = historicalDrawSnapshot.range.from,
  to = historicalDrawSnapshot.range.to,
): readonly FrequencyEntry[] {
  const config = historicalGameConfig[gameId];
  const draws = drawsForGame(gameId, from, to);
  const counts = new Map<number, number>();
  for (let number = 1; number <= config.maxNumber; number += 1) counts.set(number, 0);

  draws.forEach((draw) => {
    const numbers = selectedDrawNumbers(draw, kind);
    numbers.forEach((number) => {
      if (number !== undefined) counts.set(number, (counts.get(number) ?? 0) + 1);
    });
  });

  return [...counts.entries()].map(([number, count]) => ({
    number,
    count,
    percent: draws.length === 0 ? 0 : (count / draws.length) * 100,
  }));
}

export function rankNumberFrequencies(
  gameId: HistoricalGameId,
  kind: 'main' | 'bonus',
  from: string,
  to: string,
): readonly NumberRankEntry[] {
  const draws = [...drawsForGame(gameId, from, to)].sort((left, right) =>
    left.drawDate.localeCompare(right.drawDate),
  );
  const frequencies = numberFrequencies(gameId, kind, from, to);
  const appearances = new Map<number, number[]>();

  frequencies.forEach(({ number }) => appearances.set(number, []));
  draws.forEach((draw, index) => {
    const numbers = selectedDrawNumbers(draw, kind);
    numbers.forEach((number) => appearances.get(number)?.push(index));
  });

  return [...frequencies]
    .sort((left, right) => right.count - left.count || left.number - right.number)
    .map((entry, index) => {
      const indexes = appearances.get(entry.number) ?? [];
      const gaps = indexes.slice(1).map((value, gapIndex) => value - indexes[gapIndex]!);
      return {
        ...entry,
        rank: index + 1,
        averageDrawGap:
          gaps.length === 0 ? null : gaps.reduce((total, gap) => total + gap, 0) / gaps.length,
        currentDrought: indexes.length === 0 ? draws.length : draws.length - 1 - indexes.at(-1)!,
      };
    });
}

export function numberDistributionStatistics(
  draws: readonly HistoricalDraw[],
  kind: 'main' | 'bonus',
): DistributionStatistics | null {
  const valuesByDraw = draws
    .map((draw) => selectedDrawNumbers(draw, kind))
    .filter((values) => values.length > 0);
  const values = valuesByDraw.flat().sort((left, right) => left - right);
  if (values.length === 0) return null;

  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const median =
    values.length % 2 === 0
      ? ((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2
      : (values[Math.floor(values.length / 2)] ?? 0);
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  const spans = valuesByDraw.map((items) => Math.max(...items) - Math.min(...items));
  const adjacentGaps = valuesByDraw.flatMap((items) => {
    const ordered = [...items].sort((left, right) => left - right);
    return ordered.slice(1).map((value, index) => value - ordered[index]!);
  });

  return {
    values,
    mean,
    median,
    variance,
    standardDeviation: Math.sqrt(variance),
    minimum: values[0] ?? 0,
    maximum: values.at(-1) ?? 0,
    averageSumPerDraw:
      valuesByDraw.reduce(
        (total, items) => total + items.reduce((sum, value) => sum + value, 0),
        0,
      ) / valuesByDraw.length,
    averageSpanPerDraw: spans.reduce((total, span) => total + span, 0) / spans.length,
    averageAdjacentGap:
      adjacentGaps.length === 0
        ? null
        : adjacentGaps.reduce((total, gap) => total + gap, 0) / adjacentGaps.length,
    evenCount: values.filter((value) => value % 2 === 0).length,
    oddCount: values.filter((value) => value % 2 !== 0).length,
  };
}

export function numberCombinationFrequencies(
  draws: readonly HistoricalDraw[],
  size: number,
  limit = 10,
): readonly CombinationFrequency[] {
  const poolSize = Math.max(0, ...draws.flatMap((draw) => draw.mainNumbers));
  return analyzeNumberCombinations(draws, size, poolSize, limit).top;
}

function binomialCoefficient(poolSize: number, size: number): number {
  if (size < 0 || size > poolSize) return 0;
  const k = Math.min(size, poolSize - size);
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = (result * (poolSize - k + index)) / index;
  }
  return Math.round(result);
}

export function analyzeNumberCombinations(
  draws: readonly HistoricalDraw[],
  size: number,
  poolSize: number,
  limit = 10,
): CombinationAnalysis {
  const counts = new Map<string, { numbers: number[]; count: number }>();
  if (!Number.isInteger(size) || size < 2 || draws.length === 0) {
    return {
      top: [],
      drawsAnalyzed: draws.length,
      totalOccurrences: 0,
      uniqueCombinations: 0,
      repeatedCombinations: 0,
      repeatedOccurrences: 0,
      maximumFrequency: 0,
      possibleCombinations: binomialCoefficient(poolSize, size),
    };
  }

  draws.forEach((draw) => {
    const numbers = [...draw.mainNumbers].sort((left, right) => left - right);
    if (size > numbers.length) return;
    const selected: number[] = [];
    const visit = (start: number) => {
      if (selected.length === size) {
        const key = selected.join('-');
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { numbers: [...selected], count: 1 });
        return;
      }
      for (let index = start; index <= numbers.length - (size - selected.length); index += 1) {
        selected.push(numbers[index]!);
        visit(index + 1);
        selected.pop();
      }
    };
    visit(0);
  });

  const allCombinations = [...counts.values()];
  const totalOccurrences = allCombinations.reduce(
    (total, combination) => total + combination.count,
    0,
  );
  const repeated = allCombinations.filter((combination) => combination.count > 1);

  return {
    top: allCombinations
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.numbers
            .join(',')
            .localeCompare(right.numbers.join(','), undefined, { numeric: true }),
      )
      .slice(0, limit)
      .map(({ numbers, count }) => ({
        numbers,
        count,
        percentOfDraws: (count / draws.length) * 100,
      })),
    drawsAnalyzed: draws.length,
    totalOccurrences,
    uniqueCombinations: allCombinations.length,
    repeatedCombinations: repeated.length,
    repeatedOccurrences: repeated.reduce((total, combination) => total + combination.count - 1, 0),
    maximumFrequency: allCombinations.reduce(
      (maximum, combination) => Math.max(maximum, combination.count),
      0,
    ),
    possibleCombinations: binomialCoefficient(poolSize, size),
  };
}
