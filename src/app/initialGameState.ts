import { lotteryDefinitions } from '../data/definitions/lotteries';
import { createWallet } from '../domain/economy/wallet';
import { createGoldBallCycle } from '../domain/lottery/goldBall';
import { createSimulationClock } from '../domain/lottery/simulationClock';
import { createTicketStore } from '../domain/lottery/tickets';
import type { AppGameState } from '../storage/gameStateSnapshot';

export function createInitialGameState(now = new Date().toISOString()): AppGameState {
  return {
    ticketStore: createTicketStore(createWallet(100_000, now)),
    drawCycles: { 'bc-49': 1, 'lotto-649': 1, 'daily-grand': 1, 'lotto-max': 1, keno: 1 },
    drawResults: {},
    goldBallCycle: createGoldBallCycle(),
    goldBallResults: {},
    clock: createSimulationClock(now, lotteryDefinitions),
  };
}
