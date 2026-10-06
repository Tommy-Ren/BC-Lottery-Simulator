import type { GoldBallCycleState, GoldBallDrawResult } from '../domain/lottery/goldBall';
import type { SimulationClockState } from '../domain/lottery/simulationClock';
import type { PlayableLotteryId, TicketStore } from '../domain/lottery/tickets';
import type { LotteryDrawResult } from '../domain/lottery/types';

export const GAME_STATE_SCHEMA_VERSION = 2 as const;
export const initialTimestamp = '2026-09-26T12:00:00.000Z';

export interface AppGameState {
  readonly ticketStore: TicketStore;
  readonly drawCycles: Readonly<Record<PlayableLotteryId, number>>;
  readonly drawResults: Readonly<Record<string, LotteryDrawResult>>;
  readonly goldBallCycle: GoldBallCycleState;
  readonly goldBallResults: Readonly<Record<string, GoldBallDrawResult>>;
  readonly clock: SimulationClockState;
}

export interface GameStateSnapshot {
  readonly schemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly state: AppGameState;
}

const lotteryIds: readonly PlayableLotteryId[] = [
  'bc-49',
  'lotto-649',
  'daily-grand',
  'lotto-max',
  'keno',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isSafeCents(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

function assertDrawResult(value: unknown): void {
  if (
    !isRecord(value) ||
    !lotteryIds.includes(value.lotteryId as PlayableLotteryId) ||
    typeof value.rulesVersion !== 'string' ||
    typeof value.seed !== 'string' ||
    !isIntegerArray(value.mainNumbers) ||
    (value.bonusNumber !== undefined && !Number.isInteger(value.bonusNumber)) ||
    (value.specialNumber !== undefined && !Number.isInteger(value.specialNumber))
  ) {
    throw new Error('The save contains an invalid main draw result.');
  }
}

function assertSettlement(value: unknown): asserts value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    typeof value.drawId !== 'string' ||
    !Array.isArray(value.evaluations) ||
    !isSafeCents(value.cashPrizeCents) ||
    !isSafeCents(value.goldBallPrizeCents) ||
    !Number.isSafeInteger(value.freePlayCount) ||
    (value.freePlayCount as number) < 0 ||
    !Array.isArray(value.unresolvedPoolShareTierIds) ||
    !value.unresolvedPoolShareTierIds.every((tierId) => typeof tierId === 'string') ||
    !isIsoDate(value.settledAt)
  ) {
    throw new Error('The save contains an invalid ticket settlement.');
  }
  assertDrawResult(value.draw);
}

function assertWallet(value: unknown): void {
  if (!isRecord(value) || !isSafeCents(value.balanceCents) || !Array.isArray(value.transactions)) {
    throw new Error('The wallet in the save is invalid.');
  }

  let expectedBalance = 0;
  value.transactions.forEach((transaction, index) => {
    if (
      !isRecord(transaction) ||
      typeof transaction.id !== 'string' ||
      typeof transaction.amountCents !== 'number' ||
      !Number.isSafeInteger(transaction.amountCents) ||
      !isSafeCents(transaction.balanceBeforeCents) ||
      !isSafeCents(transaction.balanceAfterCents) ||
      !isIsoDate(transaction.occurredAt)
    ) {
      throw new Error(`Wallet transaction ${index + 1} in the save is invalid.`);
    }
    if (
      transaction.balanceBeforeCents !== expectedBalance ||
      transaction.balanceAfterCents !== expectedBalance + transaction.amountCents
    ) {
      throw new Error('The wallet ledger in the save does not balance.');
    }
    expectedBalance = transaction.balanceAfterCents;
  });

  if (value.balanceCents !== expectedBalance)
    throw new Error('The saved balance does not match the wallet ledger.');
}

function assertTicketStore(value: unknown): void {
  if (
    !isRecord(value) ||
    !Array.isArray(value.tickets) ||
    !Number.isSafeInteger(value.nextGoldBallSerial) ||
    (value.nextGoldBallSerial as number) < 1
  ) {
    throw new Error('The ticket store in the save is invalid.');
  }
  assertWallet(value.wallet);

  const ids = new Set<string>();
  value.tickets.forEach((ticket, index) => {
    if (
      !isRecord(ticket) ||
      typeof ticket.id !== 'string' ||
      typeof ticket.purchaseCommandId !== 'string' ||
      !lotteryIds.includes(ticket.lotteryId as PlayableLotteryId) ||
      typeof ticket.rulesVersion !== 'string' ||
      typeof ticket.drawId !== 'string' ||
      !Array.isArray(ticket.drawIds) ||
      !ticket.drawIds.every((drawId) => typeof drawId === 'string') ||
      typeof ticket.drawCount !== 'number' ||
      !Number.isSafeInteger(ticket.drawCount) ||
      ticket.drawCount !== ticket.drawIds.length ||
      !isIsoDate(ticket.purchasedAt) ||
      !Array.isArray(ticket.selections) ||
      !ticket.selections.every(
        (selection) =>
          isRecord(selection) &&
          Array.isArray(selection.mainNumbers) &&
          selection.mainNumbers.every((number) => Number.isInteger(number)),
      ) ||
      typeof ticket.playCount !== 'number' ||
      !Number.isSafeInteger(ticket.playCount) ||
      ticket.playCount < 1 ||
      !isSafeCents(ticket.costCents) ||
      !isSafeCents(ticket.wagerCents) ||
      typeof ticket.walletTransactionId !== 'string' ||
      !Array.isArray(ticket.goldBallDrawNumbers) ||
      !ticket.goldBallDrawNumbers.every((drawNumber) => typeof drawNumber === 'string') ||
      !isRecord(ticket.addOns) ||
      typeof ticket.addOns.extraPlayCount !== 'number' ||
      !Number.isSafeInteger(ticket.addOns.extraPlayCount) ||
      typeof ticket.addOns.kenoBonus !== 'boolean' ||
      typeof ticket.addOns.kenoPatternPlay !== 'boolean' ||
      !isRecord(ticket.extraSelectionsByDraw) ||
      !['purchased', 'partially-settled', 'settled'].includes(ticket.status as string) ||
      !Array.isArray(ticket.settlements)
    ) {
      throw new Error(`Ticket ${index + 1} in the save is invalid.`);
    }
    if (ids.has(ticket.id)) throw new Error('The save contains a duplicate ticket ID.');
    ids.add(ticket.id);
    const settledDrawIds = new Set<string>();
    ticket.settlements.forEach((settlement) => {
      assertSettlement(settlement);
      const drawId = settlement.drawId as string;
      if (settledDrawIds.has(drawId))
        throw new Error('The save contains a duplicate ticket settlement.');
      settledDrawIds.add(drawId);
    });
  });
}

export function assertValidGameState(value: unknown): asserts value is AppGameState {
  if (!isRecord(value)) throw new Error('The saved state must be an object.');
  assertTicketStore(value.ticketStore);

  if (!isRecord(value.drawCycles)) throw new Error('The save is missing draw cycle IDs.');
  const drawCycles = value.drawCycles;
  lotteryIds.forEach((lotteryId) => {
    const cycle = drawCycles[lotteryId];
    if (!Number.isSafeInteger(cycle) || (cycle as number) < 1) {
      throw new Error(`The ${lotteryId} draw cycle in the save is invalid.`);
    }
  });

  if (!isRecord(value.drawResults) || !isRecord(value.goldBallResults)) {
    throw new Error('Draw results in the save are invalid.');
  }
  Object.values(value.drawResults).forEach(assertDrawResult);
  Object.values(value.goldBallResults).forEach((result) => {
    if (
      !isRecord(result) ||
      typeof result.drawId !== 'string' ||
      typeof result.seed !== 'string' ||
      typeof result.winningDrawNumber !== 'string' ||
      !['white', 'gold'].includes(result.prizeBall as string) ||
      !isSafeCents(result.prizeCents)
    ) {
      throw new Error('The save contains an invalid Gold Ball result.');
    }
  });

  if (
    !isRecord(value.goldBallCycle) ||
    !Number.isSafeInteger(value.goldBallCycle.cycleNumber) ||
    (value.goldBallCycle.cycleNumber as number) < 1 ||
    !Number.isInteger(value.goldBallCycle.remainingWhiteBalls) ||
    (value.goldBallCycle.remainingWhiteBalls as number) < 0 ||
    (value.goldBallCycle.remainingWhiteBalls as number) > 29
  ) {
    throw new Error('The Gold Ball cycle in the save is invalid.');
  }

  if (!isRecord(value.clock) || !isIsoDate(value.clock.now) || !isRecord(value.clock.nextDrawAt)) {
    throw new Error('The simulation clock in the save is invalid.');
  }
  const nextDrawAt = value.clock.nextDrawAt;
  lotteryIds.forEach((lotteryId) => {
    if (!isIsoDate(nextDrawAt[lotteryId])) {
      throw new Error(`The next draw time for ${lotteryId} in the save is invalid.`);
    }
  });
}

export function createGameStateSnapshot(
  state: AppGameState,
  savedAt = new Date().toISOString(),
): GameStateSnapshot {
  assertValidGameState(state);
  return { schemaVersion: GAME_STATE_SCHEMA_VERSION, savedAt, state };
}

export function migrateGameState(value: unknown): GameStateSnapshot {
  if (!isRecord(value)) throw new Error('The JSON root must be an object.');

  let state: unknown;
  let savedAt: unknown;
  if (value.schemaVersion === GAME_STATE_SCHEMA_VERSION) {
    state = value.state;
    savedAt = value.savedAt;
  } else if (value.schemaVersion === 1) {
    const legacyState = isRecord(value.state) ? value.state : value;
    state = {
      ...legacyState,
      goldBallResults: isRecord(legacyState.goldBallResults) ? legacyState.goldBallResults : {},
    };
    savedAt = value.savedAt;
  } else {
    throw new Error(`Unsupported save schema version: ${String(value.schemaVersion)}.`);
  }

  if (!isIsoDate(savedAt)) throw new Error('The save timestamp is invalid.');
  assertValidGameState(state);
  return createGameStateSnapshot(state, savedAt);
}

export function parseGameStateJson(json: string): GameStateSnapshot {
  try {
    return migrateGameState(JSON.parse(json) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error('The file is not valid JSON.', { cause: error });
    throw error;
  }
}

export function serializeGameState(state: AppGameState): string {
  return `${JSON.stringify(createGameStateSnapshot(state), null, 2)}\n`;
}
