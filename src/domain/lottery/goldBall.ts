import { createSeededRandom, type RandomSource } from './random';

const initialWhiteBallCount = 29;
const whiteBallPrizeCents = 100_000_000;
const drawNumberPattern = /^\d{8}-\d{2}$/;

export interface GoldBallCycleState {
  readonly cycleNumber: number;
  readonly remainingWhiteBalls: number;
}

export interface GoldBallDrawResult {
  readonly drawId: string;
  readonly seed: string;
  readonly cycleNumber: number;
  readonly winningDrawNumber: string;
  readonly prizeBall: 'white' | 'gold';
  readonly prizeCents: number;
  readonly advertisedJackpotCents: number;
  readonly remainingWhiteBallsBefore: number;
  readonly remainingWhiteBallsAfter: number;
  readonly cycleReset: boolean;
}

export interface ConductGoldBallDrawInput {
  readonly drawId: string;
  readonly seed: string;
  readonly issuedDrawNumbers: readonly string[];
  readonly advertisedJackpotCents: number;
}

export interface ConductGoldBallDrawOutput {
  readonly state: GoldBallCycleState;
  readonly result: GoldBallDrawResult;
}

export function createGoldBallCycle(): GoldBallCycleState {
  return { cycleNumber: 1, remainingWhiteBalls: initialWhiteBallCount };
}

export function conductGoldBallDraw(
  state: GoldBallCycleState,
  input: ConductGoldBallDrawInput,
  random: RandomSource = createSeededRandom(input.seed),
): ConductGoldBallDrawOutput {
  if (
    !Number.isInteger(state.cycleNumber) ||
    state.cycleNumber < 1 ||
    !Number.isInteger(state.remainingWhiteBalls) ||
    state.remainingWhiteBalls < 0 ||
    state.remainingWhiteBalls > initialWhiteBallCount
  ) {
    throw new Error('Gold Ball cycle state is invalid.');
  }

  if (!Number.isSafeInteger(input.advertisedJackpotCents) || input.advertisedJackpotCents <= 0) {
    throw new Error('Gold Ball advertised jackpot must be a positive integer number of cents.');
  }

  const issuedDrawNumbers = [...new Set(input.issuedDrawNumbers)];
  if (issuedDrawNumbers.length === 0) {
    throw new Error('Gold Ball draw requires at least one issued Draw Number.');
  }
  if (issuedDrawNumbers.some((drawNumber) => !drawNumberPattern.test(drawNumber))) {
    throw new Error('Gold Ball Draw Numbers must use the ########-## format.');
  }

  const winningDrawNumber = issuedDrawNumbers[Math.floor(random.next() * issuedDrawNumbers.length)];
  if (winningDrawNumber === undefined) {
    throw new Error('Gold Ball draw could not select a winning Draw Number.');
  }

  const totalPrizeBalls = state.remainingWhiteBalls + 1;
  const prizeBallIndex = Math.floor(random.next() * totalPrizeBalls);
  const prizeBall = prizeBallIndex === state.remainingWhiteBalls ? 'gold' : 'white';
  const cycleReset = prizeBall === 'gold';
  const remainingWhiteBallsAfter = cycleReset
    ? initialWhiteBallCount
    : state.remainingWhiteBalls - 1;

  return {
    state: {
      cycleNumber: cycleReset ? state.cycleNumber + 1 : state.cycleNumber,
      remainingWhiteBalls: remainingWhiteBallsAfter,
    },
    result: {
      drawId: input.drawId,
      seed: input.seed,
      cycleNumber: state.cycleNumber,
      winningDrawNumber,
      prizeBall,
      prizeCents: cycleReset ? input.advertisedJackpotCents : whiteBallPrizeCents,
      advertisedJackpotCents: input.advertisedJackpotCents,
      remainingWhiteBallsBefore: state.remainingWhiteBalls,
      remainingWhiteBallsAfter,
      cycleReset,
    },
  };
}
