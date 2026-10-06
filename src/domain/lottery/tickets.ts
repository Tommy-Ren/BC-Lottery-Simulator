import { applyWalletCommand, type WalletState } from '../economy/wallet';
import { evaluateSelection } from './engine';
import {
  evaluateExtra,
  evaluateKenoPattern,
  generateExtraSelections,
  type SupplementaryDrawResult,
  type TicketAddOns,
} from './features';
import type { GoldBallDrawResult } from './goldBall';
import type {
  LotteryDefinition,
  LotteryDrawResult,
  LotteryId,
  LotterySelection,
  PrizeEvaluation,
} from './types';
import { assertValidSelection } from './validation';

export type PlayableLotteryId = Extract<
  LotteryId,
  'bc-49' | 'lotto-649' | 'daily-grand' | 'lotto-max' | 'keno'
>;

export interface TicketGoldBallSettlement {
  readonly result: GoldBallDrawResult;
  readonly matchedDrawNumber?: string;
  readonly prizeCents: number;
}

export interface TicketSettlement {
  readonly drawId: string;
  readonly draw: LotteryDrawResult;
  readonly evaluations: readonly PrizeEvaluation[];
  readonly cashPrizeCents: number;
  readonly baseCashPrizeCents: number;
  readonly poolPrizeCents: number;
  readonly extraPrizeCents: number;
  readonly patternPrizeCents: number;
  readonly maxSeriesPrizeCents: number;
  readonly kenoBonusMultiplier?: number;
  readonly goldBallPrizeCents: number;
  readonly freePlayCount: number;
  readonly unresolvedPoolShareTierIds: readonly string[];
  readonly goldBall?: TicketGoldBallSettlement;
  readonly supplementaryDraw?: SupplementaryDrawResult;
  readonly settledAt: string;
}

export interface Ticket {
  readonly id: string;
  readonly purchaseCommandId: string;
  readonly lotteryId: PlayableLotteryId;
  readonly rulesVersion: string;
  readonly drawId: string;
  readonly drawIds: readonly string[];
  readonly drawCount: number;
  readonly purchasedAt: string;
  readonly selections: readonly LotterySelection[];
  readonly playCount: number;
  readonly costCents: number;
  readonly wagerCents: number;
  readonly walletTransactionId: string;
  readonly goldBallDrawNumbers: readonly string[];
  readonly addOns: TicketAddOns;
  readonly extraSelectionsByDraw: Readonly<Record<string, readonly (readonly number[])[]>>;
  readonly status: 'purchased' | 'partially-settled' | 'settled';
  readonly settlements: readonly TicketSettlement[];
  readonly settlement?: TicketSettlement;
}

export interface TicketStore {
  readonly wallet: WalletState;
  readonly tickets: readonly Ticket[];
  readonly nextGoldBallSerial: number;
}

export interface PurchaseTicketCommand {
  readonly commandId: string;
  readonly ticketId: string;
  readonly lotteryId: PlayableLotteryId;
  readonly drawId: string;
  readonly drawIds?: readonly string[];
  readonly purchasedAt: string;
  readonly selections: readonly LotterySelection[];
  readonly wagerCents?: number;
  readonly addOns?: Partial<TicketAddOns>;
}

function immutableSelection(selection: LotterySelection): LotterySelection {
  return Object.freeze({
    mainNumbers: Object.freeze([...selection.mainNumbers].sort((left, right) => left - right)),
    specialNumber: selection.specialNumber,
  });
}

export function formatGoldBallDrawNumber(serial: number): string {
  if (!Number.isSafeInteger(serial) || serial < 1 || serial > 9_999_999_999) {
    throw new Error('Gold Ball serial must be between 1 and 9,999,999,999.');
  }

  const digits = serial.toString().padStart(10, '0');
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

export function createTicketStore(wallet: WalletState): TicketStore {
  return { wallet, tickets: [], nextGoldBallSerial: 1 };
}

export function purchaseTicket(
  state: TicketStore,
  definition: LotteryDefinition,
  command: PurchaseTicketCommand,
): TicketStore {
  if (command.lotteryId !== definition.id) {
    throw new Error('Purchase command and lottery definition do not match.');
  }

  const existingTicket = state.tickets.find(
    (ticket) => ticket.purchaseCommandId === command.commandId,
  );
  if (existingTicket) return state;

  if (state.tickets.some((ticket) => ticket.id === command.ticketId)) {
    throw new Error(`Ticket id ${command.ticketId} already exists.`);
  }

  if (
    command.selections.length === 0 ||
    command.selections.length % definition.play.selectionsPerPlay !== 0
  ) {
    throw new Error(
      `${definition.displayName} requires ${definition.play.selectionsPerPlay} selection(s) per play.`,
    );
  }

  const addOns: TicketAddOns = Object.freeze({
    extraPlayCount: command.addOns?.extraPlayCount ?? 0,
    kenoBonus: command.addOns?.kenoBonus ?? false,
    kenoPatternPlay: command.addOns?.kenoPatternPlay ?? false,
    comboPickCount: command.addOns?.comboPickCount,
  });

  if (addOns.kenoPatternPlay) {
    if (
      definition.id !== 'keno' ||
      command.selections.length !== 1 ||
      command.selections[0]?.mainNumbers.length !== 20
    ) {
      throw new Error('Keno Pattern Play requires exactly one selection of 20 numbers.');
    }
  } else {
    command.selections.forEach((selection) => assertValidSelection(definition, selection));
  }

  if (
    !Number.isInteger(addOns.extraPlayCount) ||
    addOns.extraPlayCount < 0 ||
    addOns.extraPlayCount > 10
  ) {
    throw new Error('EXTRA allows between 0 and 10 plays per ticket.');
  }
  if (definition.id === 'keno' && addOns.extraPlayCount > 0) {
    throw new Error('Keno does not support EXTRA.');
  }
  if (definition.id !== 'keno' && (addOns.kenoBonus || addOns.kenoPatternPlay)) {
    throw new Error('Keno add-ons can only be used with Keno.');
  }

  const drawIds = [...new Set(command.drawIds ?? [command.drawId])];
  if (drawIds.length === 0 || drawIds[0] !== command.drawId) {
    throw new Error('The primary draw id must be the first draw in the ticket.');
  }
  if (
    definition.play.maxAdvanceDraws !== undefined &&
    drawIds.length > definition.play.maxAdvanceDraws
  ) {
    throw new Error(
      `${definition.displayName} allows at most ${definition.play.maxAdvanceDraws} advance draws.`,
    );
  }

  const playCount = addOns.kenoPatternPlay
    ? 1
    : command.selections.length / definition.play.selectionsPerPlay;
  const maximumPlays = definition.play.maxSelectionsPerTransaction;
  if (
    addOns.comboPickCount === undefined &&
    maximumPlays !== undefined &&
    playCount > maximumPlays
  ) {
    throw new Error(`${definition.displayName} allows at most ${maximumPlays} plays per purchase.`);
  }

  const wagerCents = command.wagerCents ?? definition.play.basePriceCents;
  if (
    definition.play.wagerOptionsCents !== undefined &&
    !definition.play.wagerOptionsCents.includes(wagerCents)
  ) {
    throw new Error(`${definition.displayName} does not support a ${wagerCents}-cent wager.`);
  }
  if (
    definition.play.wagerOptionsCents === undefined &&
    wagerCents !== definition.play.basePriceCents
  ) {
    throw new Error(`${definition.displayName} uses a fixed price per play.`);
  }

  const baseCostCents = addOns.kenoPatternPlay
    ? 200 * drawIds.length
    : playCount * wagerCents * drawIds.length;
  const kenoBonusCostCents = addOns.kenoBonus ? baseCostCents : 0;
  const extraCostCents = addOns.extraPlayCount * 100 * drawIds.length;
  const costCents = baseCostCents + kenoBonusCostCents + extraCostCents;
  const walletTransactionId = `purchase:${command.commandId}`;
  const wallet = applyWalletCommand(state.wallet, {
    id: walletTransactionId,
    type: 'ticket-purchase',
    amountCents: -costCents,
    occurredAt: command.purchasedAt,
    referenceId: command.ticketId,
  });

  const goldBallDrawNumbers =
    definition.id === 'lotto-649'
      ? Array.from({ length: playCount }, (_, index) =>
          formatGoldBallDrawNumber(state.nextGoldBallSerial + index),
        )
      : [];
  const extraSelectionsByDraw =
    addOns.extraPlayCount > 0
      ? generateExtraSelections(drawIds, addOns.extraPlayCount, `extra:${command.commandId}`)
      : {};

  const ticket: Ticket = Object.freeze({
    id: command.ticketId,
    purchaseCommandId: command.commandId,
    lotteryId: command.lotteryId,
    rulesVersion: definition.rulesVersion,
    drawId: command.drawId,
    drawIds: Object.freeze(drawIds),
    drawCount: drawIds.length,
    purchasedAt: command.purchasedAt,
    selections: Object.freeze(command.selections.map(immutableSelection)),
    playCount,
    costCents,
    wagerCents,
    walletTransactionId,
    goldBallDrawNumbers: Object.freeze(goldBallDrawNumbers),
    addOns,
    extraSelectionsByDraw: Object.freeze(extraSelectionsByDraw),
    status: 'purchased',
    settlements: Object.freeze([]),
  });

  return {
    wallet,
    tickets: [...state.tickets, ticket],
    nextGoldBallSerial: state.nextGoldBallSerial + goldBallDrawNumbers.length,
  };
}

function settleTicket(
  ticket: Ticket,
  definition: LotteryDefinition,
  drawId: string,
  draw: LotteryDrawResult,
  settledAt: string,
  goldBallDraw?: GoldBallDrawResult,
  supplementaryDraw?: SupplementaryDrawResult,
  localWinningSelectionsByTier: Readonly<Record<string, number>> = {},
): Ticket {
  if (ticket.settlements.some((settlement) => settlement.drawId === drawId)) return ticket;
  if (!ticket.drawIds.includes(drawId)) return ticket;
  if (ticket.lotteryId !== definition.id || ticket.rulesVersion !== definition.rulesVersion) {
    throw new Error('Ticket and draw do not share the same lottery rule version.');
  }

  const evaluations: readonly PrizeEvaluation[] = ticket.addOns.kenoPatternPlay
    ? ticket.selections.map((selection) => ({
        tier: null,
        mainMatches: selection.mainNumbers.filter((number) => draw.mainNumbers.includes(number))
          .length,
        bonusMatched: false,
        specialMatched: false,
      }))
    : ticket.selections.map((selection) => evaluateSelection(definition, selection, draw));
  let baseCashPrizeCents = 0;
  let poolPrizeCents = 0;
  let goldBallPrizeCents = 0;
  let freePlayCount = 0;
  const unresolvedPoolShareTierIds: string[] = [];

  evaluations.forEach(({ tier }) => {
    if (!tier) return;
    if (tier.award.type === 'fixed-cash') {
      if (tier.award.sharedPoolCapCents === undefined) {
        baseCashPrizeCents +=
          tier.award.amountCents *
          (definition.id === 'keno' ? ticket.wagerCents / definition.play.basePriceCents : 1);
      } else {
        if (supplementaryDraw) {
          const winnerCount =
            (supplementaryDraw.nationalPool.otherWinningSelectionsByTier[tier.id] ?? 0) +
            (localWinningSelectionsByTier[tier.id] ?? 1);
          baseCashPrizeCents +=
            winnerCount > 6
              ? Math.floor(tier.award.sharedPoolCapCents / winnerCount)
              : tier.award.amountCents;
        } else {
          unresolvedPoolShareTierIds.push(tier.id);
        }
      }
    }
    if (tier.award.type === 'free-play') freePlayCount += 1;
    if (tier.award.type === 'pool-share') {
      if (supplementaryDraw) {
        const poolCents =
          tier.award.advertisedPoolCents ??
          (tier.award.poolPercent === undefined
            ? supplementaryDraw.nationalPool.advertisedJackpotCents
            : Math.floor(
                (supplementaryDraw.nationalPool.poolsFundCents * tier.award.poolPercent) / 100,
              ));
        const winnerCount =
          (supplementaryDraw.nationalPool.otherWinningSelectionsByTier[tier.id] ?? 0) +
          (localWinningSelectionsByTier[tier.id] ?? 1);
        poolPrizeCents += Math.floor(poolCents / winnerCount);
      } else {
        unresolvedPoolShareTierIds.push(tier.id);
      }
    }
    if (tier.award.type === 'annuity-or-cash') {
      unresolvedPoolShareTierIds.push(tier.id);
    }
  });

  if (definition.id === 'keno') {
    baseCashPrizeCents = Math.min(baseCashPrizeCents, 20_000_000);
  }

  const extraPrizeCents = supplementaryDraw?.extraNumbers
    ? evaluateExtra(ticket.extraSelectionsByDraw[drawId] ?? [], supplementaryDraw.extraNumbers)
    : 0;
  const patternPrizeCents = ticket.addOns.kenoPatternPlay
    ? evaluateKenoPattern(ticket.selections[0]?.mainNumbers ?? [], draw.mainNumbers)
    : 0;
  const maxSeriesPrizeCents =
    definition.id === 'lotto-max' && supplementaryDraw
      ? ticket.selections.reduce((total, selection) => {
          const key = selection.mainNumbers.join(',');
          const maxPlusMatches = supplementaryDraw.maxPlusSeries.filter(
            (series) => series.join(',') === key,
          ).length;
          const maxMillionsMatches = supplementaryDraw.maxMillionsSeries.filter(
            (series) => series.join(',') === key,
          ).length;
          return (
            total +
            maxPlusMatches * supplementaryDraw.maxPlusPrizeCents +
            maxMillionsMatches * supplementaryDraw.maxMillionsPrizeCents
          );
        }, 0)
      : 0;
  const kenoBonusMultiplier = ticket.addOns.kenoBonus
    ? supplementaryDraw?.kenoBonusMultiplier
    : undefined;
  if (kenoBonusMultiplier !== undefined) {
    baseCashPrizeCents = Math.min(
      Math.floor(baseCashPrizeCents * kenoBonusMultiplier),
      200_000_000,
    );
  }
  const cashPrizeCents =
    baseCashPrizeCents + poolPrizeCents + extraPrizeCents + patternPrizeCents + maxSeriesPrizeCents;

  let goldBall: TicketGoldBallSettlement | undefined;
  if (ticket.lotteryId === 'lotto-649' && goldBallDraw) {
    if (goldBallDraw.drawId !== drawId) {
      throw new Error('Gold Ball result and Classic Draw do not share the same draw id.');
    }
    const matchedDrawNumber = ticket.goldBallDrawNumbers.find(
      (drawNumber) => drawNumber === goldBallDraw.winningDrawNumber,
    );
    goldBallPrizeCents = matchedDrawNumber ? goldBallDraw.prizeCents : 0;
    goldBall = Object.freeze({
      result: goldBallDraw,
      matchedDrawNumber,
      prizeCents: goldBallPrizeCents,
    });
  }

  const settlement: TicketSettlement = Object.freeze({
    drawId,
    draw,
    evaluations: Object.freeze(evaluations),
    cashPrizeCents,
    baseCashPrizeCents,
    poolPrizeCents,
    extraPrizeCents,
    patternPrizeCents,
    maxSeriesPrizeCents,
    kenoBonusMultiplier,
    goldBallPrizeCents,
    freePlayCount,
    unresolvedPoolShareTierIds: Object.freeze(unresolvedPoolShareTierIds),
    goldBall,
    supplementaryDraw,
    settledAt,
  });
  const settlements = Object.freeze([...ticket.settlements, settlement]);

  return Object.freeze({
    ...ticket,
    status: settlements.length === ticket.drawIds.length ? 'settled' : 'partially-settled',
    settlements,
    settlement,
  });
}

export function settleTicketsForDraw(
  state: TicketStore,
  definition: LotteryDefinition,
  drawId: string,
  draw: LotteryDrawResult,
  settledAt: string,
  goldBallDraw?: GoldBallDrawResult,
  supplementaryDraw?: SupplementaryDrawResult,
): TicketStore {
  const localWinningSelectionsByTier: Record<string, number> = {};
  state.tickets
    .filter(
      (ticket) =>
        ticket.drawIds.includes(drawId) &&
        ticket.lotteryId === definition.id &&
        !ticket.addOns.kenoPatternPlay,
    )
    .forEach((ticket) => {
      ticket.selections.forEach((selection) => {
        const tier = evaluateSelection(definition, selection, draw).tier;
        if (tier)
          localWinningSelectionsByTier[tier.id] = (localWinningSelectionsByTier[tier.id] ?? 0) + 1;
      });
    });
  const tickets = state.tickets.map((ticket) =>
    settleTicket(
      ticket,
      definition,
      drawId,
      draw,
      settledAt,
      goldBallDraw,
      supplementaryDraw,
      localWinningSelectionsByTier,
    ),
  );
  let wallet = state.wallet;

  tickets.forEach((ticket) => {
    const settlement = ticket.settlements.find((candidate) => candidate.drawId === drawId);
    if (!settlement || settlement.cashPrizeCents <= 0) return;

    wallet = applyWalletCommand(wallet, {
      id: `prize:${ticket.id}:${drawId}`,
      type: 'prize',
      amountCents: settlement.cashPrizeCents,
      occurredAt: settledAt,
      referenceId: ticket.id,
    });
  });

  tickets.forEach((ticket) => {
    const settlement = ticket.settlements.find((candidate) => candidate.drawId === drawId);
    if (!settlement || settlement.goldBallPrizeCents <= 0) return;

    wallet = applyWalletCommand(wallet, {
      id: `gold-ball-prize:${ticket.id}:${drawId}`,
      type: 'prize',
      amountCents: settlement.goldBallPrizeCents,
      occurredAt: settledAt,
      referenceId: ticket.id,
    });
  });

  return { ...state, wallet, tickets };
}
