import { drawUniqueNumbers, createSeededRandom, type RandomSource } from './random';
import type { LotteryDefinition, LotteryId, LotterySelection } from './types';

export interface TicketAddOns {
  readonly extraPlayCount: number;
  readonly kenoBonus: boolean;
  readonly kenoPatternPlay: boolean;
  readonly comboPickCount?: number;
}

export interface NationalPoolInput {
  readonly advertisedJackpotCents: number;
  readonly poolsFundCents: number;
  readonly otherWinningSelectionsByTier: Readonly<Record<string, number>>;
  readonly simulatedNationalSalesCents: number;
}

export interface SupplementaryDrawResult {
  readonly drawId: string;
  readonly seed: string;
  readonly extraNumbers?: readonly number[];
  readonly kenoBonusMultiplier?: number;
  readonly maxPlusSeries: readonly (readonly number[])[];
  readonly maxMillionsSeries: readonly (readonly number[])[];
  readonly maxPlusPrizeCents: number;
  readonly maxMillionsPrizeCents: number;
  readonly nationalPool: NationalPoolInput;
}

export interface SupplementaryDrawInput {
  readonly advertisedJackpotCents: number;
  readonly poolsFundCents: number;
  readonly simulatedNationalSalesCents: number;
  readonly otherWinningSelectionsByTier?: Readonly<Record<string, number>>;
  readonly maxMillionsCount?: number;
}

function combinations(numbers: readonly number[], choose: number): readonly (readonly number[])[] {
  const output: number[][] = [];
  function visit(start: number, current: number[]): void {
    if (current.length === choose) {
      output.push([...current]);
      return;
    }
    for (let index = start; index <= numbers.length - (choose - current.length); index += 1) {
      const number = numbers[index];
      if (number === undefined) continue;
      current.push(number);
      visit(index + 1, current);
      current.pop();
    }
  }
  visit(0, []);
  return output;
}

export function expandComboSelection(
  definition: LotteryDefinition,
  pickedNumbers: readonly number[],
): readonly LotterySelection[] {
  const sorted = [...pickedNumbers].sort((left, right) => left - right);

  if (definition.id === 'daily-grand') {
    if (sorted.length !== 5)
      throw new Error('Daily Grand Combo 5 requires exactly 5 main numbers.');
    return Array.from({ length: 7 }, (_, index) => ({
      mainNumbers: sorted,
      specialNumber: index + 1,
    }));
  }

  if (definition.id === 'bc-49' || definition.id === 'lotto-649') {
    if (sorted.length === 5) {
      const picked = new Set(sorted);
      return Array.from({ length: 49 }, (_, index) => index + 1)
        .filter((number) => !picked.has(number))
        .map((number) => ({
          mainNumbers: [...sorted, number].sort((left, right) => left - right),
        }));
    }
    if (![7, 8, 9].includes(sorted.length)) {
      throw new Error(`${definition.displayName} Combo requires 5, 7, 8 or 9 numbers.`);
    }
    return combinations(sorted, 6).map((mainNumbers) => ({ mainNumbers }));
  }

  if (definition.id === 'lotto-max') {
    if (![8, 9].includes(sorted.length)) {
      throw new Error('Lotto Max Combo requires 8 or 9 numbers.');
    }
    const baseSelections = combinations(sorted, 7);
    const random = createSeededRandom(`lotto-max-combo:${sorted.join('-')}`);
    return baseSelections.flatMap((mainNumbers) => [
      { mainNumbers },
      ...Array.from({ length: 3 }, () => ({
        mainNumbers: drawUniqueNumbers(definition.draw.mainNumbers, random),
      })),
    ]);
  }

  throw new Error(`${definition.displayName} does not support Combo Play.`);
}

export function generateExtraSelections(
  drawIds: readonly string[],
  playCount: number,
  seed: string,
): Readonly<Record<string, readonly (readonly number[])[]>> {
  const random = createSeededRandom(seed);
  return Object.freeze(
    Object.fromEntries(
      drawIds.map((drawId) => [
        drawId,
        Object.freeze(
          Array.from({ length: playCount }, () =>
            Object.freeze(drawUniqueNumbers({ min: 1, max: 99, count: 4 }, random)),
          ),
        ),
      ]),
    ),
  );
}

export function evaluateExtra(
  selections: readonly (readonly number[])[],
  drawNumbers: readonly number[],
): number {
  const drawn = new Set(drawNumbers);
  const prizesByMatches: Record<number, number> = {
    1: 100,
    2: 1_000,
    3: 100_000,
    4: 50_000_000,
  };
  return selections.reduce((total, selection) => {
    const matches = selection.filter((number) => drawn.has(number)).length;
    return total + (prizesByMatches[matches] ?? 0);
  }, 0);
}

export function evaluateKenoPattern(
  selectedNumbers: readonly number[],
  drawNumbers: readonly number[],
): number {
  if (selectedNumbers.length !== 20) throw new Error('Keno Pattern Play requires 20 numbers.');
  const drawn = new Set(drawNumbers);
  const matches = selectedNumbers.filter((number) => drawn.has(number)).length;
  const normalizedMatches = Math.min(matches, 20 - matches);
  const prizes: Record<number, number> = {
    0: 5_000_000,
    1: 2_500_000,
    2: 200_000,
    3: 40_000,
    4: 5_000,
    5: 1_500,
    6: 500,
    7: 300,
  };
  return prizes[normalizedMatches] ?? 0;
}

export function drawKenoBonusMultiplier(random: RandomSource): number {
  const weighted = [
    { multiplier: 1.5, probability: 1 / 2.04 },
    { multiplier: 2, probability: 1 / 2.25 },
    { multiplier: 5, probability: 1 / 24.71 },
    { multiplier: 7, probability: 1 / 49.43 },
    { multiplier: 10, probability: 1 / 346 },
  ];
  const total = weighted.reduce((sum, item) => sum + item.probability, 0);
  let cursor = random.next() * total;
  for (const item of weighted) {
    cursor -= item.probability;
    if (cursor <= 0) return item.multiplier;
  }
  return 10;
}

function generateSeries(
  count: number,
  definition: LotteryDefinition,
  random: RandomSource,
): readonly (readonly number[])[] {
  return Array.from({ length: count }, () =>
    drawUniqueNumbers(definition.draw.mainNumbers, random),
  );
}

export function generateSupplementaryDraw(
  definition: LotteryDefinition,
  drawId: string,
  seed: string,
  input: SupplementaryDrawInput,
): SupplementaryDrawResult {
  const random = createSeededRandom(seed);
  const isLottoMax = definition.id === 'lotto-max';
  const maxPlusCount = isLottoMax
    ? Math.max(0, Math.floor(input.advertisedJackpotCents / 100_000_000))
    : 0;
  const maxMillionsCount =
    isLottoMax && input.advertisedJackpotCents >= 5_000_000_000 ? (input.maxMillionsCount ?? 0) : 0;
  const estimatedPlays = Math.floor(
    input.simulatedNationalSalesCents / definition.play.basePriceCents,
  );
  const otherWinningSelectionsByTier =
    input.otherWinningSelectionsByTier ??
    Object.fromEntries(
      definition.prizeTiers.map((tier) => [
        tier.id,
        Math.max(0, Math.floor(estimatedPlays / tier.oddsOneIn)),
      ]),
    );

  return {
    drawId,
    seed,
    extraNumbers:
      definition.id === 'keno'
        ? undefined
        : drawUniqueNumbers({ min: 1, max: 99, count: 4 }, random),
    kenoBonusMultiplier: definition.id === 'keno' ? drawKenoBonusMultiplier(random) : undefined,
    maxPlusSeries: generateSeries(maxPlusCount, definition, random),
    maxMillionsSeries: generateSeries(maxMillionsCount, definition, random),
    maxPlusPrizeCents: 10_000_000,
    maxMillionsPrizeCents: 100_000_000,
    nationalPool: {
      advertisedJackpotCents: input.advertisedJackpotCents,
      poolsFundCents: input.poolsFundCents,
      simulatedNationalSalesCents: input.simulatedNationalSalesCents,
      otherWinningSelectionsByTier,
    },
  };
}

export function defaultNationalPoolInput(lotteryId: LotteryId): SupplementaryDrawInput {
  const advertisedJackpots: Record<LotteryId, number> = {
    'lotto-max': 5_000_000_000,
    'lotto-649': 500_000_000,
    'bc-49': 200_000_000,
    'daily-grand': 700_000_000,
    keno: 20_000_000,
  };
  return {
    advertisedJackpotCents: advertisedJackpots[lotteryId],
    poolsFundCents: 1_000_000_000,
    simulatedNationalSalesCents: 4_000_000_000,
    maxMillionsCount: lotteryId === 'lotto-max' ? 2 : 0,
  };
}
