import { describe, expect, it } from 'vitest';
import { getLotteryDefinition, lotteryDefinitions } from '../src/data/definitions/lotteries';
import {
  advanceSimulationTime,
  createSimulationClock,
  nextScheduledDrawAt,
  soonestScheduledDraw,
} from '../src/domain/lottery/simulationClock';

describe('unified simulation clock', () => {
  it('schedules Keno every 3 minutes 30 seconds', () => {
    const start = '2026-09-26T12:00:00.000Z';
    const clock = createSimulationClock(start, lotteryDefinitions);

    expect(clock.nextDrawAt.keno).toBe('2026-09-26T12:03:30.000Z');
    expect(soonestScheduledDraw(clock)).toEqual({
      lotteryId: 'keno',
      scheduledAt: '2026-09-26T12:03:30.000Z',
    });

    const advanced = advanceSimulationTime(clock, '2026-09-26T12:07:00.000Z', lotteryDefinitions);
    expect(advanced.dueDraws.filter(({ lotteryId }) => lotteryId === 'keno')).toHaveLength(2);
    expect(advanced.state.nextDrawAt.keno).toBe('2026-09-26T12:10:30.000Z');
  });

  it('resolves weekly schedules in America/Vancouver', () => {
    expect(nextScheduledDrawAt(getLotteryDefinition('lotto-649'), '2026-09-26T12:00:00.000Z')).toBe(
      '2026-09-27T02:30:00.000Z',
    );
    expect(
      nextScheduledDrawAt(getLotteryDefinition('daily-grand'), '2026-09-26T12:00:00.000Z'),
    ).toBe('2026-09-29T02:30:00.000Z');
  });

  it('rejects time travel and unchanged target times', () => {
    const clock = createSimulationClock('2026-09-26T12:00:00.000Z', lotteryDefinitions);
    expect(() =>
      advanceSimulationTime(clock, '2026-09-26T12:00:00.000Z', lotteryDefinitions),
    ).toThrow('later');
  });
});
