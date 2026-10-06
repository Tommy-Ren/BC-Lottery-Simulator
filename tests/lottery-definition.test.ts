import { describe, expect, it } from 'vitest';
import { getLotteryDefinition, lotteryDefinitions } from '../src/data/definitions/lotteries';
import { evaluateSelection, generateDraw, quickPickPlay } from '../src/domain/lottery/engine';
import { createSeededRandom } from '../src/domain/lottery/random';
import type { LotteryDrawResult } from '../src/domain/lottery/types';
import { assertValidLotteryDefinition } from '../src/domain/lottery/validation';

describe('official lottery definitions', () => {
  it('ships the five PlayNow games in scope', () => {
    expect(lotteryDefinitions.map(({ id }) => id)).toEqual([
      'lotto-max',
      'lotto-649',
      'bc-49',
      'daily-grand',
      'keno',
    ]);
  });

  it.each(lotteryDefinitions)('validates $displayName ($id)', (definition) => {
    expect(() => assertValidLotteryDefinition(definition)).not.toThrow();
    expect(definition.sources.every(({ url }) => url.startsWith('https://www.playnow.com/'))).toBe(
      true,
    );
  });

  it('uses the Lotto Max rules effective April 10, 2026', () => {
    const definition = getLotteryDefinition('lotto-max');
    expect(definition.play.basePriceCents).toBe(600);
    expect(definition.play.selectionsPerPlay).toBe(4);
    expect(definition.draw.mainNumbers).toEqual({ min: 1, max: 52, count: 7 });
    expect(definition.features.map(({ id }) => id)).toEqual([
      'maxplus',
      'maxmillions',
      'combo-play',
      'extra',
    ]);
  });

  it('represents the Lotto 6/49 Classic and Gold Ball structure', () => {
    const definition = getLotteryDefinition('lotto-649');
    expect(definition.play.basePriceCents).toBe(300);
    expect(definition.draw.mainNumbers).toEqual({ min: 1, max: 49, count: 6 });
    expect(definition.features.some(({ id }) => id === 'gold-ball')).toBe(true);
  });

  it('contains the complete Keno main prize table', () => {
    const definition = getLotteryDefinition('keno');
    expect(definition.prizeTiers).toHaveLength(37);
    expect(definition.play.wagerOptionsCents).toEqual([100, 200, 500, 1_000]);
    expect(definition.draw.schedule).toEqual({ type: 'interval', intervalSeconds: 210 });
  });
});

describe('deterministic draw and quick pick engine', () => {
  it.each(lotteryDefinitions)('replays the same $displayName draw from its seed', (definition) => {
    expect(generateDraw(definition, 'draw-2026-001')).toEqual(
      generateDraw(definition, 'draw-2026-001'),
    );
  });

  it.each(lotteryDefinitions)('draws legal unique numbers for $displayName', (definition) => {
    const draw = generateDraw(definition, `legal-${definition.id}`);
    expect(draw.mainNumbers).toHaveLength(definition.draw.mainNumbers.count);
    expect(new Set(draw.mainNumbers)).toHaveLength(definition.draw.mainNumbers.count);
    expect(
      draw.mainNumbers.every(
        (number) =>
          number >= definition.draw.mainNumbers.min && number <= definition.draw.mainNumbers.max,
      ),
    ).toBe(true);

    if (draw.bonusNumber !== undefined) {
      expect(draw.mainNumbers).not.toContain(draw.bonusNumber);
    }
  });

  it('creates four independent selections for one Lotto Max play', () => {
    const selections = quickPickPlay(
      getLotteryDefinition('lotto-max'),
      createSeededRandom('lotto-max-quick-pick'),
    );
    expect(selections).toHaveLength(4);
    expect(selections.every(({ mainNumbers }) => mainNumbers.length === 7)).toBe(true);
  });

  it('supports every official Keno pick count', () => {
    const definition = getLotteryDefinition('keno');
    for (let pickCount = 1; pickCount <= 10; pickCount += 1) {
      const [selection] = quickPickPlay(
        definition,
        createSeededRandom(`keno-${pickCount}`),
        pickCount,
      );
      expect(selection?.mainNumbers).toHaveLength(pickCount);
    }
  });
});

describe('prize evaluation', () => {
  it('recognizes Lotto Max 6/7 plus Bonus', () => {
    const definition = getLotteryDefinition('lotto-max');
    const draw: LotteryDrawResult = {
      lotteryId: 'lotto-max',
      rulesVersion: definition.rulesVersion,
      seed: 'fixture',
      mainNumbers: [1, 2, 3, 4, 5, 6, 7],
      bonusNumber: 8,
    };
    expect(
      evaluateSelection(definition, { mainNumbers: [1, 2, 3, 4, 5, 6, 8] }, draw).tier?.id,
    ).toBe('6/7+');
  });

  it('recognizes Lotto 6/49 2/6 plus Bonus', () => {
    const definition = getLotteryDefinition('lotto-649');
    const draw: LotteryDrawResult = {
      lotteryId: 'lotto-649',
      rulesVersion: definition.rulesVersion,
      seed: 'fixture',
      mainNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };
    expect(
      evaluateSelection(definition, { mainNumbers: [1, 2, 7, 20, 21, 22] }, draw).tier?.id,
    ).toBe('2/6+');
  });

  it('recognizes the Daily Grand free play tier', () => {
    const definition = getLotteryDefinition('daily-grand');
    const draw: LotteryDrawResult = {
      lotteryId: 'daily-grand',
      rulesVersion: definition.rulesVersion,
      seed: 'fixture',
      mainNumbers: [1, 2, 3, 4, 5],
      specialNumber: 7,
    };
    expect(
      evaluateSelection(definition, { mainNumbers: [10, 11, 12, 13, 14], specialNumber: 7 }, draw)
        .tier?.id,
    ).toBe('0/5+grand');
  });

  it('recognizes Keno Pick 10 / Match 0', () => {
    const definition = getLotteryDefinition('keno');
    const draw: LotteryDrawResult = {
      lotteryId: 'keno',
      rulesVersion: definition.rulesVersion,
      seed: 'fixture',
      mainNumbers: Array.from({ length: 20 }, (_, index) => index + 1),
    };
    expect(
      evaluateSelection(
        definition,
        { mainNumbers: Array.from({ length: 10 }, (_, index) => index + 41) },
        draw,
      ).tier?.id,
    ).toBe('pick-10-match-0');
  });
});
