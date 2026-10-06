import { describe, expect, it } from 'vitest';
import { getLotteryDefinition } from '../src/data/definitions/lotteries';
import {
  drawKenoBonusMultiplier,
  evaluateExtra,
  evaluateKenoPattern,
  expandComboSelection,
  generateSupplementaryDraw,
} from '../src/domain/lottery/features';
import type { RandomSource } from '../src/domain/lottery/random';

function constantRandom(value: number): RandomSource {
  return { next: () => value };
}

describe('official add-on mechanics', () => {
  it('expands BC/49 and Lotto 6/49 Combo 5, 7, 8 and 9 correctly', () => {
    for (const lotteryId of ['bc-49', 'lotto-649'] as const) {
      const definition = getLotteryDefinition(lotteryId);
      expect(expandComboSelection(definition, [1, 2, 3, 4, 5])).toHaveLength(44);
      expect(expandComboSelection(definition, [1, 2, 3, 4, 5, 6, 7])).toHaveLength(7);
      expect(expandComboSelection(definition, [1, 2, 3, 4, 5, 6, 7, 8])).toHaveLength(28);
      expect(expandComboSelection(definition, [1, 2, 3, 4, 5, 6, 7, 8, 9])).toHaveLength(84);
    }
  });

  it('expands Daily Grand Combo 5 across all GRAND NUMBER values', () => {
    const selections = expandComboSelection(getLotteryDefinition('daily-grand'), [1, 2, 3, 4, 5]);
    expect(selections).toHaveLength(7);
    expect(selections.map(({ specialNumber }) => specialNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('expands Lotto Max Combo 8 and 9 into four-selection plays', () => {
    const definition = getLotteryDefinition('lotto-max');
    expect(expandComboSelection(definition, [1, 2, 3, 4, 5, 6, 7, 8])).toHaveLength(32);
    expect(expandComboSelection(definition, [1, 2, 3, 4, 5, 6, 7, 8, 9])).toHaveLength(144);
  });

  it('uses the official EXTRA fixed prize table', () => {
    const draw = [1, 2, 3, 4];
    expect(evaluateExtra([[1, 2, 3, 4]], draw)).toBe(50_000_000);
    expect(evaluateExtra([[1, 2, 3, 9]], draw)).toBe(100_000);
    expect(evaluateExtra([[1, 2, 8, 9]], draw)).toBe(1_000);
    expect(evaluateExtra([[1, 7, 8, 9]], draw)).toBe(100);
  });

  it('pays Pattern Play symmetrically for matches and misses', () => {
    const firstTwenty = Array.from({ length: 20 }, (_, index) => index + 1);
    const lastTwenty = Array.from({ length: 20 }, (_, index) => index + 61);
    expect(evaluateKenoPattern(firstTwenty, firstTwenty)).toBe(5_000_000);
    expect(evaluateKenoPattern(firstTwenty, lastTwenty)).toBe(5_000_000);
  });

  it('draws every official Keno Bonus multiplier boundary', () => {
    expect(drawKenoBonusMultiplier(constantRandom(0))).toBe(1.5);
    expect(drawKenoBonusMultiplier(constantRandom(0.999_999))).toBe(10);
  });

  it('generates MAXPLUS/MAXMILLIONS and auditable national inputs', () => {
    const result = generateSupplementaryDraw(
      getLotteryDefinition('lotto-max'),
      'lotto-max-001',
      'feature-fixture',
      {
        advertisedJackpotCents: 5_000_000_000,
        poolsFundCents: 1_000_000_000,
        simulatedNationalSalesCents: 4_000_000_000,
        maxMillionsCount: 2,
      },
    );

    expect(result.maxPlusSeries).toHaveLength(50);
    expect(result.maxMillionsSeries).toHaveLength(2);
    expect(result.nationalPool.otherWinningSelectionsByTier['3/7']).toBeGreaterThan(0);
  });
});
