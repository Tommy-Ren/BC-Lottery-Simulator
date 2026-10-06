import type { LotteryDefinition, LotteryId, Weekday } from './types';

export interface SimulationClockState {
  readonly now: string;
  readonly nextDrawAt: Readonly<Record<LotteryId, string>>;
}

export interface ScheduledDrawEvent {
  readonly lotteryId: LotteryId;
  readonly scheduledAt: string;
}

export interface AdvanceSimulationResult {
  readonly state: SimulationClockState;
  readonly dueDraws: readonly ScheduledDrawEvent[];
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Vancouver',
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function vancouverParts(date: Date): { weekday: Weekday; time: string } {
  const parts = formatter.formatToParts(date);
  const weekday = parts.find(({ type }) => type === 'weekday')?.value.toLowerCase() as
    Weekday | undefined;
  const hour = parts.find(({ type }) => type === 'hour')?.value;
  const minute = parts.find(({ type }) => type === 'minute')?.value;
  if (!weekday || !hour || !minute) throw new Error('Could not resolve Vancouver draw time.');
  return { weekday, time: `${hour.padStart(2, '0')}:${minute}` };
}

export function nextScheduledDrawAt(definition: LotteryDefinition, after: string): string {
  const afterDate = new Date(after);
  if (Number.isNaN(afterDate.getTime()))
    throw new Error('Simulation time must be a valid ISO date.');

  if (definition.draw.schedule.type === 'interval') {
    return new Date(
      afterDate.getTime() + definition.draw.schedule.intervalSeconds * 1_000,
    ).toISOString();
  }

  const candidate = new Date(afterDate);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  const maximumMinutes = 8 * 24 * 60;

  for (let index = 0; index < maximumMinutes; index += 1) {
    const { weekday, time } = vancouverParts(candidate);
    if (
      definition.draw.schedule.weekdays.includes(weekday) &&
      time === definition.draw.schedule.drawTime
    ) {
      return candidate.toISOString();
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  throw new Error(`Could not find the next scheduled draw for ${definition.id}.`);
}

export function createSimulationClock(
  now: string,
  definitions: readonly LotteryDefinition[],
): SimulationClockState {
  const nextDrawAt = Object.fromEntries(
    definitions.map((definition) => [definition.id, nextScheduledDrawAt(definition, now)]),
  ) as Record<LotteryId, string>;
  return { now: new Date(now).toISOString(), nextDrawAt };
}

export function advanceSimulationTime(
  state: SimulationClockState,
  targetTime: string,
  definitions: readonly LotteryDefinition[],
): AdvanceSimulationResult {
  const target = new Date(targetTime);
  const current = new Date(state.now);
  if (Number.isNaN(target.getTime()) || target <= current) {
    throw new Error('Simulation target time must be later than the current time.');
  }

  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const nextDrawAt = { ...state.nextDrawAt };
  const dueDraws: ScheduledDrawEvent[] = [];

  while (true) {
    const nextEntry = Object.entries(nextDrawAt).sort((left, right) =>
      left[1].localeCompare(right[1]),
    )[0] as [LotteryId, string] | undefined;
    if (!nextEntry || new Date(nextEntry[1]) > target) break;

    const [lotteryId, scheduledAt] = nextEntry;
    dueDraws.push({ lotteryId, scheduledAt });
    const definition = definitionsById.get(lotteryId);
    if (!definition) throw new Error(`Missing definition for scheduled lottery ${lotteryId}.`);
    nextDrawAt[lotteryId] = nextScheduledDrawAt(definition, scheduledAt);
  }

  return {
    state: { now: target.toISOString(), nextDrawAt },
    dueDraws,
  };
}

export function soonestScheduledDraw(state: SimulationClockState): ScheduledDrawEvent {
  const entry = Object.entries(state.nextDrawAt).sort((left, right) =>
    left[1].localeCompare(right[1]),
  )[0] as [LotteryId, string] | undefined;
  if (!entry) throw new Error('Simulation clock has no scheduled draws.');
  return { lotteryId: entry[0], scheduledAt: entry[1] };
}
