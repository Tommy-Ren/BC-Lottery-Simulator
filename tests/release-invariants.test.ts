import { describe, expect, it } from 'vitest';
import { lotteryDefinitions } from '../src/data/definitions/lotteries';
import {
  advanceSimulationTime,
  createSimulationClock,
} from '../src/domain/lottery/simulationClock';

describe('release invariants', () => {
  it('advances through 100 Keno draws without duplicates or clock drift', () => {
    const start = '2026-09-26T12:00:00.000Z';
    const clock = createSimulationClock(start, lotteryDefinitions);
    const firstKenoDraw = new Date(clock.nextDrawAt.keno).getTime();
    const target = new Date(firstKenoDraw + 99 * 210_000).toISOString();
    const result = advanceSimulationTime(clock, target, lotteryDefinitions);
    const kenoDraws = result.dueDraws.filter(({ lotteryId }) => lotteryId === 'keno');

    expect(kenoDraws).toHaveLength(100);
    expect(new Set(kenoDraws.map(({ scheduledAt }) => scheduledAt)).size).toBe(100);
    kenoDraws.forEach((event, index) => {
      expect(new Date(event.scheduledAt).getTime()).toBe(firstKenoDraw + index * 210_000);
    });
    expect(new Date(result.state.nextDrawAt.keno).getTime()).toBe(firstKenoDraw + 100 * 210_000);
  });
});
