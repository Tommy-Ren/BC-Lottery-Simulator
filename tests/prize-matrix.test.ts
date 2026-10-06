import { describe, expect, it } from 'vitest';
import { lotteryDefinitions } from '../src/data/definitions/lotteries';
import { evaluateSelection } from '../src/domain/lottery/engine';
import {
  drawKenoBonusMultiplier,
  evaluateExtra,
  evaluateKenoPattern,
} from '../src/domain/lottery/features';
import type { RandomSource } from '../src/domain/lottery/random';
import type { LotteryDrawResult, LotterySelection } from '../src/domain/lottery/types';

function standardSelection(
  definition: (typeof lotteryDefinitions)[number],
  draw: LotteryDrawResult,
  mainMatches: number,
  bonus: 'required' | 'excluded' | 'ignored',
  special: 'required' | 'excluded' | 'ignored',
): LotterySelection {
  const pickCount = definition.play.allowedPickCounts[0] ?? definition.draw.mainNumbers.count;
  const selected = draw.mainNumbers.slice(0, mainMatches);
  if (bonus === 'required' && draw.bonusNumber !== undefined) selected.push(draw.bonusNumber);
  const blocked = new Set([
    ...draw.mainNumbers,
    ...(draw.bonusNumber === undefined ? [] : [draw.bonusNumber]),
  ]);
  for (let number = definition.draw.mainNumbers.max; selected.length < pickCount; number -= 1) {
    if (!blocked.has(number)) selected.push(number);
  }

  const specialNumber = definition.draw.specialNumber
    ? special === 'required'
      ? draw.specialNumber
      : draw.specialNumber === definition.draw.specialNumber.min
        ? definition.draw.specialNumber.min + 1
        : definition.draw.specialNumber.min
    : undefined;
  return { mainNumbers: selected.sort((left, right) => left - right), specialNumber };
}

describe('complete configured prize matrix', () => {
  lotteryDefinitions.forEach((definition) => {
    it(`${definition.displayName} resolves every configured prize tier`, () => {
      const draw: LotteryDrawResult = {
        lotteryId: definition.id,
        rulesVersion: definition.rulesVersion,
        seed: 'matrix',
        mainNumbers: Array.from(
          { length: definition.draw.mainNumbers.count },
          (_, index) => definition.draw.mainNumbers.min + index,
        ),
        bonusNumber: definition.draw.hasBonusNumber
          ? definition.draw.mainNumbers.min + definition.draw.mainNumbers.count
          : undefined,
        specialNumber: definition.draw.specialNumber?.min,
      };

      definition.prizeTiers.forEach((tier) => {
        const selection =
          tier.condition.kind === 'keno'
            ? {
                mainNumbers: [
                  ...draw.mainNumbers.slice(0, tier.condition.mainMatches),
                  ...Array.from(
                    { length: tier.condition.pickedNumbers - tier.condition.mainMatches },
                    (_, index) => 21 + index,
                  ),
                ],
              }
            : standardSelection(
                definition,
                draw,
                tier.condition.mainMatches,
                tier.condition.bonus,
                tier.condition.special,
              );

        expect(evaluateSelection(definition, selection, draw).tier?.id, tier.id).toBe(tier.id);
      });
    });
  });

  it('resolves every EXTRA and Pattern Play prize row', () => {
    const draw = [1, 2, 3, 4];
    const extraPrizes = [0, 100, 1_000, 100_000, 50_000_000];
    extraPrizes.forEach((prize, matches) => {
      const selection = [
        ...draw.slice(0, matches),
        ...Array.from({ length: 4 - matches }, (_, index) => 90 - index),
      ];
      expect(evaluateExtra([selection], draw), `${matches} EXTRA matches`).toBe(prize);
    });

    const patternDraw = Array.from({ length: 20 }, (_, index) => index + 1);
    const prizes = [5_000_000, 2_500_000, 200_000, 40_000, 5_000, 1_500, 500, 300];
    prizes.forEach((prize, normalizedMatches) => {
      for (const matches of new Set([normalizedMatches, 20 - normalizedMatches])) {
        const selection = [
          ...patternDraw.slice(0, matches),
          ...Array.from({ length: 20 - matches }, (_, index) => 21 + index),
        ];
        expect(evaluateKenoPattern(selection, patternDraw), `${matches} Pattern matches`).toBe(
          prize,
        );
      }
    });
  });

  it('reaches every configured Keno Bonus multiplier bucket', () => {
    const probabilities = [1 / 2.04, 1 / 2.25, 1 / 24.71, 1 / 49.43, 1 / 346];
    const total = probabilities.reduce((sum, probability) => sum + probability, 0);
    let start = 0;
    [1.5, 2, 5, 7, 10].forEach((multiplier, index) => {
      const probability = probabilities[index] ?? 0;
      const sample = (start + probability / 2) / total;
      const random: RandomSource = { next: () => sample };
      expect(drawKenoBonusMultiplier(random)).toBe(multiplier);
      start += probability;
    });
  });
});
