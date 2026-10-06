import type {
  LotteryDefinition,
  LotteryDrawResult,
  LotterySelection,
  MatchRequirement,
  PrizeEvaluation,
} from './types';
import { createSeededRandom, drawUniqueNumbers, type RandomSource } from './random';
import { assertValidSelection } from './validation';

function requirementMatches(requirement: MatchRequirement, matched: boolean): boolean {
  if (requirement === 'ignored') return true;
  return requirement === 'required' ? matched : !matched;
}

export function quickPickPlay(
  definition: LotteryDefinition,
  random: RandomSource,
  pickCount = definition.play.allowedPickCounts[0],
): readonly LotterySelection[] {
  if (pickCount === undefined || !definition.play.allowedPickCounts.includes(pickCount)) {
    throw new Error(`${definition.id} does not support a pick count of ${String(pickCount)}.`);
  }

  return Array.from({ length: definition.play.selectionsPerPlay }, () => {
    const mainNumbers = drawUniqueNumbers(
      {
        min: definition.draw.mainNumbers.min,
        max: definition.draw.mainNumbers.max,
        count: pickCount,
      },
      random,
    );
    const specialPool = definition.draw.specialNumber;
    const specialNumber = specialPool
      ? drawUniqueNumbers({ ...specialPool, count: 1 }, random)[0]
      : undefined;

    return { mainNumbers, specialNumber };
  });
}

export function generateDraw(definition: LotteryDefinition, seed: string): LotteryDrawResult {
  const random = createSeededRandom(seed);
  const mainNumbers = drawUniqueNumbers(definition.draw.mainNumbers, random);
  const bonusNumber = definition.draw.hasBonusNumber
    ? drawUniqueNumbers(
        {
          min: definition.draw.mainNumbers.min,
          max: definition.draw.mainNumbers.max,
          count: 1,
        },
        random,
        mainNumbers,
      )[0]
    : undefined;
  const specialNumber = definition.draw.specialNumber
    ? drawUniqueNumbers({ ...definition.draw.specialNumber, count: 1 }, random)[0]
    : undefined;

  return {
    lotteryId: definition.id,
    rulesVersion: definition.rulesVersion,
    seed,
    mainNumbers,
    bonusNumber,
    specialNumber,
  };
}

export function evaluateSelection(
  definition: LotteryDefinition,
  selection: LotterySelection,
  draw: LotteryDrawResult,
): PrizeEvaluation {
  assertValidSelection(definition, selection);

  if (draw.lotteryId !== definition.id || draw.rulesVersion !== definition.rulesVersion) {
    throw new Error('The draw and selection definition do not share the same rule version.');
  }

  const drawnMainNumbers = new Set(draw.mainNumbers);
  const mainMatches = selection.mainNumbers.filter((number) => drawnMainNumbers.has(number)).length;
  const bonusMatched =
    draw.bonusNumber !== undefined && selection.mainNumbers.includes(draw.bonusNumber);
  const specialMatched =
    draw.specialNumber !== undefined && selection.specialNumber === draw.specialNumber;

  const tier =
    definition.prizeTiers.find((candidate) => {
      if (candidate.condition.mainMatches !== mainMatches) return false;

      if (candidate.condition.kind === 'keno') {
        return candidate.condition.pickedNumbers === selection.mainNumbers.length;
      }

      return (
        requirementMatches(candidate.condition.bonus, bonusMatched) &&
        requirementMatches(candidate.condition.special, specialMatched)
      );
    }) ?? null;

  return { tier, mainMatches, bonusMatched, specialMatched };
}
