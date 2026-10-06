import { describe, expect, it } from 'vitest';
import { conductGoldBallDraw, createGoldBallCycle } from '../src/domain/lottery/goldBall';
import type { RandomSource } from '../src/domain/lottery/random';

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return {
    next() {
      const value = values[index];
      index += 1;
      if (value === undefined) throw new Error('Test random sequence exhausted.');
      return value;
    },
  };
}

const baseInput = {
  drawId: 'lotto-649-sim-001',
  seed: 'fixture',
  issuedDrawNumbers: ['00000000-01', '00000000-02'],
  advertisedJackpotCents: 1_000_000_000,
} as const;

describe('Gold Ball 30-ball cycle', () => {
  it('removes one $1M white ball and keeps the current cycle', () => {
    const output = conductGoldBallDraw(createGoldBallCycle(), baseInput, sequenceRandom([0.75, 0]));

    expect(output.result).toMatchObject({
      winningDrawNumber: '00000000-02',
      prizeBall: 'white',
      prizeCents: 100_000_000,
      remainingWhiteBallsBefore: 29,
      remainingWhiteBallsAfter: 28,
      cycleReset: false,
    });
    expect(output.state).toEqual({ cycleNumber: 1, remainingWhiteBalls: 28 });
  });

  it('pays the explicit advertised jackpot and resets after Gold Ball', () => {
    const output = conductGoldBallDraw(
      { cycleNumber: 4, remainingWhiteBalls: 11 },
      baseInput,
      sequenceRandom([0, 0.999_999]),
    );

    expect(output.result).toMatchObject({
      winningDrawNumber: '00000000-01',
      prizeBall: 'gold',
      prizeCents: 1_000_000_000,
      cycleNumber: 4,
      remainingWhiteBallsAfter: 29,
      cycleReset: true,
    });
    expect(output.state).toEqual({ cycleNumber: 5, remainingWhiteBalls: 29 });
  });

  it('must draw Gold Ball when no white balls remain', () => {
    const output = conductGoldBallDraw(
      { cycleNumber: 2, remainingWhiteBalls: 0 },
      baseInput,
      sequenceRandom([0, 0]),
    );

    expect(output.result.prizeBall).toBe('gold');
    expect(output.state).toEqual({ cycleNumber: 3, remainingWhiteBalls: 29 });
  });

  it('rejects malformed or empty issued Draw Number pools', () => {
    expect(() =>
      conductGoldBallDraw(
        createGoldBallCycle(),
        { ...baseInput, issuedDrawNumbers: [] },
        sequenceRandom([]),
      ),
    ).toThrow('at least one');
    expect(() =>
      conductGoldBallDraw(
        createGoldBallCycle(),
        { ...baseInput, issuedDrawNumbers: ['123'] },
        sequenceRandom([]),
      ),
    ).toThrow('format');
  });
});
