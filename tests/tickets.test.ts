import { describe, expect, it } from 'vitest';
import { getLotteryDefinition } from '../src/data/definitions/lotteries';
import { createWallet } from '../src/domain/economy/wallet';
import type { GoldBallDrawResult } from '../src/domain/lottery/goldBall';
import {
  generateSupplementaryDraw,
  type SupplementaryDrawResult,
} from '../src/domain/lottery/features';
import {
  createTicketStore,
  formatGoldBallDrawNumber,
  purchaseTicket,
  settleTicketsForDraw,
} from '../src/domain/lottery/tickets';
import type { LotteryDrawResult } from '../src/domain/lottery/types';

const timestamp = '2026-09-26T12:00:00.000Z';

describe('ticket purchase', () => {
  it('atomically debits the wallet and creates an immutable BC/49 ticket', () => {
    const definition = getLotteryDefinition('bc-49');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'command-1',
      ticketId: 'ticket-1',
      lotteryId: 'bc-49',
      drawId: 'bc-49-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6] }],
    });

    expect(purchased.wallet.balanceCents).toBe(9_900);
    expect(purchased.tickets).toHaveLength(1);
    expect(purchased.tickets[0]).toMatchObject({
      costCents: 100,
      drawId: 'bc-49-001',
      rulesVersion: definition.rulesVersion,
      status: 'purchased',
    });
    expect(Object.isFrozen(purchased.tickets[0])).toBe(true);
  });

  it('returns the original state for a repeated purchase command', () => {
    const definition = getLotteryDefinition('bc-49');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const command = {
      commandId: 'command-1',
      ticketId: 'ticket-1',
      lotteryId: 'bc-49' as const,
      drawId: 'bc-49-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6] }],
    };
    const purchased = purchaseTicket(initial, definition, command);
    expect(purchaseTicket(purchased, definition, command)).toBe(purchased);
  });

  it('issues unique official-format Gold Ball numbers', () => {
    const definition = getLotteryDefinition('lotto-649');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const first = purchaseTicket(initial, definition, {
      commandId: 'command-1',
      ticketId: 'ticket-1',
      lotteryId: 'lotto-649',
      drawId: 'lotto-649-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6] }],
    });
    const second = purchaseTicket(first, definition, {
      commandId: 'command-2',
      ticketId: 'ticket-2',
      lotteryId: 'lotto-649',
      drawId: 'lotto-649-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [7, 8, 9, 10, 11, 12] }],
    });

    expect(first.tickets[0]?.goldBallDrawNumbers).toEqual(['00000000-01']);
    expect(second.tickets[1]?.goldBallDrawNumbers).toEqual(['00000000-02']);
    expect(formatGoldBallDrawNumber(1_234_567_890)).toBe('12345678-90');
  });

  it('purchases multiple Lotto 6/49 plays in one atomic transaction', () => {
    const definition = getLotteryDefinition('lotto-649');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'multi-play-command',
      ticketId: 'multi-play-ticket',
      lotteryId: 'lotto-649',
      drawId: 'lotto-649-001',
      purchasedAt: timestamp,
      selections: [
        { mainNumbers: [1, 2, 3, 4, 5, 6] },
        { mainNumbers: [7, 8, 9, 10, 11, 12] },
        { mainNumbers: [13, 14, 15, 16, 17, 18] },
      ],
    });

    expect(purchased.wallet.balanceCents).toBe(9_100);
    expect(purchased.tickets[0]).toMatchObject({ playCount: 3, costCents: 900 });
    expect(purchased.tickets[0]?.goldBallDrawNumbers).toEqual([
      '00000000-01',
      '00000000-02',
      '00000000-03',
    ]);
    expect(purchased.wallet.transactions).toHaveLength(2);
  });

  it('rejects invalid selections before charging the wallet', () => {
    const definition = getLotteryDefinition('bc-49');
    const initial = createTicketStore(createWallet(10_000, timestamp));

    expect(() =>
      purchaseTicket(initial, definition, {
        commandId: 'command-1',
        ticketId: 'ticket-1',
        lotteryId: 'bc-49',
        drawId: 'bc-49-001',
        purchasedAt: timestamp,
        selections: [{ mainNumbers: [1, 1, 2, 3, 4, 5] }],
      }),
    ).toThrow('duplicate');
    expect(initial.wallet.balanceCents).toBe(10_000);
  });

  it('prices four Lotto Max selections as one $6 play', () => {
    const definition = getLotteryDefinition('lotto-max');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'max-command',
      ticketId: 'max-ticket',
      lotteryId: 'lotto-max',
      drawId: 'lotto-max-001',
      purchasedAt: timestamp,
      selections: [
        { mainNumbers: [1, 2, 3, 4, 5, 6, 7] },
        { mainNumbers: [8, 9, 10, 11, 12, 13, 14] },
        { mainNumbers: [15, 16, 17, 18, 19, 20, 21] },
        { mainNumbers: [22, 23, 24, 25, 26, 27, 28] },
      ],
    });

    expect(purchased.tickets[0]).toMatchObject({ playCount: 1, costCents: 600 });
    expect(purchased.wallet.balanceCents).toBe(9_400);
  });

  it('stores the system-generated Daily Grand number on the immutable ticket', () => {
    const definition = getLotteryDefinition('daily-grand');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'grand-command',
      ticketId: 'grand-ticket',
      lotteryId: 'daily-grand',
      drawId: 'daily-grand-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5], specialNumber: 7 }],
    });

    expect(purchased.tickets[0]?.selections[0]?.specialNumber).toBe(7);
    expect(purchased.tickets[0]?.costCents).toBe(300);
    expect(Object.isFrozen(purchased.tickets[0]?.selections[0])).toBe(true);
  });

  it('prices a multi-draw Keno ticket from its selected wager', () => {
    const definition = getLotteryDefinition('keno');
    const initial = createTicketStore(createWallet(100_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'keno-command',
      ticketId: 'keno-ticket',
      lotteryId: 'keno',
      drawId: 'keno-001',
      drawIds: ['keno-001', 'keno-002', 'keno-003'],
      wagerCents: 500,
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5] }],
    });

    expect(purchased.tickets[0]).toMatchObject({
      drawCount: 3,
      wagerCents: 500,
      costCents: 1_500,
      status: 'purchased',
    });
    expect(purchased.wallet.balanceCents).toBe(98_500);
  });

  it('rejects unsupported Keno wagers and more than 99 draws', () => {
    const definition = getLotteryDefinition('keno');
    const initial = createTicketStore(createWallet(100_000, timestamp));
    const baseCommand = {
      commandId: 'keno-command',
      ticketId: 'keno-ticket',
      lotteryId: 'keno' as const,
      drawId: 'keno-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1] }],
    };

    expect(() => purchaseTicket(initial, definition, { ...baseCommand, wagerCents: 300 })).toThrow(
      'does not support',
    );
    expect(() =>
      purchaseTicket(initial, definition, {
        ...baseCommand,
        drawIds: Array.from(
          { length: 100 },
          (_, index) => `keno-${(index + 1).toString().padStart(3, '0')}`,
        ),
      }),
    ).toThrow('99');
  });

  it('atomically includes EXTRA and Keno Bonus in the ticket cost', () => {
    const bc49 = purchaseTicket(
      createTicketStore(createWallet(10_000, timestamp)),
      getLotteryDefinition('bc-49'),
      {
        commandId: 'extra-command',
        ticketId: 'extra-ticket',
        lotteryId: 'bc-49',
        drawId: 'bc-49-001',
        purchasedAt: timestamp,
        selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6] }],
        addOns: { extraPlayCount: 2 },
      },
    );
    const keno = purchaseTicket(
      createTicketStore(createWallet(10_000, timestamp)),
      getLotteryDefinition('keno'),
      {
        commandId: 'bonus-command',
        ticketId: 'bonus-ticket',
        lotteryId: 'keno',
        drawId: 'keno-001',
        wagerCents: 500,
        purchasedAt: timestamp,
        selections: [{ mainNumbers: [1, 2, 3] }],
        addOns: { kenoBonus: true },
      },
    );

    expect(bc49.tickets[0]).toMatchObject({ costCents: 300 });
    expect(bc49.tickets[0]?.extraSelectionsByDraw['bc-49-001']).toHaveLength(2);
    expect(keno.tickets[0]).toMatchObject({ costCents: 1_000 });
  });
});

describe('ticket settlement', () => {
  it('settles a fixed prize once and credits the wallet idempotently', () => {
    const definition = getLotteryDefinition('bc-49');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'command-1',
      ticketId: 'ticket-1',
      lotteryId: 'bc-49',
      drawId: 'bc-49-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 20, 21, 22] }],
    });
    const draw: LotteryDrawResult = {
      lotteryId: 'bc-49',
      rulesVersion: definition.rulesVersion,
      seed: 'fixture',
      mainNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };

    const settled = settleTicketsForDraw(purchased, definition, 'bc-49-001', draw, timestamp);
    const repeated = settleTicketsForDraw(settled, definition, 'bc-49-001', draw, timestamp);

    expect(settled.tickets[0]?.settlement?.evaluations[0]?.tier?.id).toBe('3/6');
    expect(settled.tickets[0]?.settlement?.cashPrizeCents).toBe(1_000);
    expect(settled.wallet.balanceCents).toBe(10_900);
    expect(repeated.wallet.balanceCents).toBe(10_900);
  });

  it('leaves pool-share prizes unresolved for the later national pool model', () => {
    const definition = getLotteryDefinition('lotto-649');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'command-1',
      ticketId: 'ticket-1',
      lotteryId: 'lotto-649',
      drawId: 'lotto-649-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6] }],
    });
    const draw: LotteryDrawResult = {
      lotteryId: 'lotto-649',
      rulesVersion: definition.rulesVersion,
      seed: 'fixture',
      mainNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };

    const settled = settleTicketsForDraw(purchased, definition, 'lotto-649-001', draw, timestamp);
    expect(settled.tickets[0]?.settlement?.unresolvedPoolShareTierIds).toEqual(['6/6']);
    expect(settled.wallet.balanceCents).toBe(9_700);
  });

  it('settles and idempotently credits a matching Gold Ball Draw Number', () => {
    const definition = getLotteryDefinition('lotto-649');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'gold-command',
      ticketId: 'gold-ticket',
      lotteryId: 'lotto-649',
      drawId: 'lotto-649-001',
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [10, 11, 12, 13, 14, 15] }],
    });
    const draw: LotteryDrawResult = {
      lotteryId: 'lotto-649',
      rulesVersion: definition.rulesVersion,
      seed: 'classic-fixture',
      mainNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };
    const goldBallDraw: GoldBallDrawResult = {
      drawId: 'lotto-649-001',
      seed: 'gold-fixture',
      cycleNumber: 1,
      winningDrawNumber: '00000000-01',
      prizeBall: 'white',
      prizeCents: 100_000_000,
      advertisedJackpotCents: 1_000_000_000,
      remainingWhiteBallsBefore: 29,
      remainingWhiteBallsAfter: 28,
      cycleReset: false,
    };

    const settled = settleTicketsForDraw(
      purchased,
      definition,
      'lotto-649-001',
      draw,
      timestamp,
      goldBallDraw,
    );
    const repeated = settleTicketsForDraw(
      settled,
      definition,
      'lotto-649-001',
      draw,
      timestamp,
      goldBallDraw,
    );

    expect(settled.tickets[0]?.settlement?.goldBall).toMatchObject({
      matchedDrawNumber: '00000000-01',
      prizeCents: 100_000_000,
    });
    expect(settled.wallet.balanceCents).toBe(100_009_700);
    expect(repeated.wallet.balanceCents).toBe(100_009_700);
  });

  it('settles a fixed Daily Grand tier and leaves annuities unresolved', () => {
    const definition = getLotteryDefinition('daily-grand');
    const initial = createTicketStore(createWallet(10_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'grand-command',
      ticketId: 'grand-ticket',
      lotteryId: 'daily-grand',
      drawId: 'daily-grand-001',
      purchasedAt: timestamp,
      selections: [
        { mainNumbers: [1, 2, 3, 20, 21], specialNumber: 7 },
        { mainNumbers: [1, 2, 3, 4, 5], specialNumber: 7 },
      ],
    });
    const draw: LotteryDrawResult = {
      lotteryId: 'daily-grand',
      rulesVersion: definition.rulesVersion,
      seed: 'grand-fixture',
      mainNumbers: [1, 2, 3, 4, 5],
      specialNumber: 7,
    };

    const settled = settleTicketsForDraw(purchased, definition, 'daily-grand-001', draw, timestamp);

    expect(settled.tickets[0]?.settlement?.cashPrizeCents).toBe(10_000);
    expect(settled.tickets[0]?.settlement?.unresolvedPoolShareTierIds).toEqual(['5/5+grand']);
  });

  it('partially settles multi-draw Keno tickets and applies the $200,000 cap', () => {
    const definition = getLotteryDefinition('keno');
    const initial = createTicketStore(createWallet(100_000, timestamp));
    const purchased = purchaseTicket(initial, definition, {
      commandId: 'keno-command',
      ticketId: 'keno-ticket',
      lotteryId: 'keno',
      drawId: 'keno-001',
      drawIds: ['keno-001', 'keno-002'],
      wagerCents: 1_000,
      purchasedAt: timestamp,
      selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }],
    });
    const firstDraw: LotteryDrawResult = {
      lotteryId: 'keno',
      rulesVersion: definition.rulesVersion,
      seed: 'keno-fixture-1',
      mainNumbers: Array.from({ length: 20 }, (_, index) => index + 1),
    };
    const secondDraw: LotteryDrawResult = {
      ...firstDraw,
      seed: 'keno-fixture-2',
      mainNumbers: Array.from({ length: 20 }, (_, index) => index + 21),
    };

    const first = settleTicketsForDraw(purchased, definition, 'keno-001', firstDraw, timestamp);
    const second = settleTicketsForDraw(first, definition, 'keno-002', secondDraw, timestamp);

    expect(first.tickets[0]).toMatchObject({ status: 'partially-settled' });
    expect(first.tickets[0]?.settlement?.cashPrizeCents).toBe(20_000_000);
    expect(second.tickets[0]).toMatchObject({ status: 'settled' });
    expect(second.tickets[0]?.settlements).toHaveLength(2);
    expect(second.wallet.balanceCents).toBe(20_101_000);
  });

  it('settles EXTRA, Keno Bonus and Pattern Play through the shared wallet', () => {
    const bcDefinition = getLotteryDefinition('bc-49');
    const bcPurchased = purchaseTicket(
      createTicketStore(createWallet(100_000, timestamp)),
      bcDefinition,
      {
        commandId: 'extra-command',
        ticketId: 'extra-ticket',
        lotteryId: 'bc-49',
        drawId: 'bc-49-001',
        purchasedAt: timestamp,
        selections: [{ mainNumbers: [10, 11, 12, 13, 14, 15] }],
        addOns: { extraPlayCount: 1 },
      },
    );
    const extraNumbers = bcPurchased.tickets[0]?.extraSelectionsByDraw['bc-49-001']?.[0];
    const bcDraw: LotteryDrawResult = {
      lotteryId: 'bc-49',
      rulesVersion: bcDefinition.rulesVersion,
      seed: 'bc-draw',
      mainNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };
    const bcSupplementary = {
      ...generateSupplementaryDraw(bcDefinition, 'bc-49-001', 'extra-draw', {
        advertisedJackpotCents: 200_000_000,
        poolsFundCents: 100_000_000,
        simulatedNationalSalesCents: 1_000_000_000,
      }),
      extraNumbers,
    } as SupplementaryDrawResult;
    const bcSettled = settleTicketsForDraw(
      bcPurchased,
      bcDefinition,
      'bc-49-001',
      bcDraw,
      timestamp,
      undefined,
      bcSupplementary,
    );
    expect(bcSettled.tickets[0]?.settlement?.extraPrizeCents).toBe(50_000_000);

    const kenoDefinition = getLotteryDefinition('keno');
    const bonusPurchased = purchaseTicket(
      createTicketStore(createWallet(100_000, timestamp)),
      kenoDefinition,
      {
        commandId: 'bonus-command',
        ticketId: 'bonus-ticket',
        lotteryId: 'keno',
        drawId: 'keno-001',
        purchasedAt: timestamp,
        selections: [{ mainNumbers: [1] }],
        addOns: { kenoBonus: true },
      },
    );
    const kenoDraw: LotteryDrawResult = {
      lotteryId: 'keno',
      rulesVersion: kenoDefinition.rulesVersion,
      seed: 'keno-draw',
      mainNumbers: Array.from({ length: 20 }, (_, index) => index + 1),
    };
    const bonusSupplementary = {
      ...generateSupplementaryDraw(kenoDefinition, 'keno-001', 'bonus-draw', {
        advertisedJackpotCents: 20_000_000,
        poolsFundCents: 20_000_000,
        simulatedNationalSalesCents: 100_000_000,
      }),
      kenoBonusMultiplier: 10,
    };
    const bonusSettled = settleTicketsForDraw(
      bonusPurchased,
      kenoDefinition,
      'keno-001',
      kenoDraw,
      timestamp,
      undefined,
      bonusSupplementary,
    );
    expect(bonusSettled.tickets[0]?.settlement).toMatchObject({
      baseCashPrizeCents: 2_000,
      kenoBonusMultiplier: 10,
    });

    const patternPurchased = purchaseTicket(
      createTicketStore(createWallet(100_000, timestamp)),
      kenoDefinition,
      {
        commandId: 'pattern-command',
        ticketId: 'pattern-ticket',
        lotteryId: 'keno',
        drawId: 'keno-001',
        wagerCents: 200,
        purchasedAt: timestamp,
        selections: [{ mainNumbers: Array.from({ length: 20 }, (_, index) => index + 1) }],
        addOns: { kenoPatternPlay: true },
      },
    );
    const patternSettled = settleTicketsForDraw(
      patternPurchased,
      kenoDefinition,
      'keno-001',
      kenoDraw,
      timestamp,
      undefined,
      bonusSupplementary,
    );
    expect(patternSettled.tickets[0]?.settlement?.patternPrizeCents).toBe(5_000_000);
  });

  it('splits an advertised national jackpot across local and simulated winners', () => {
    const definition = getLotteryDefinition('lotto-649');
    const purchased = purchaseTicket(
      createTicketStore(createWallet(10_000, timestamp)),
      definition,
      {
        commandId: 'pool-command',
        ticketId: 'pool-ticket',
        lotteryId: 'lotto-649',
        drawId: 'lotto-649-001',
        purchasedAt: timestamp,
        selections: [{ mainNumbers: [1, 2, 3, 4, 5, 6] }],
      },
    );
    const draw: LotteryDrawResult = {
      lotteryId: 'lotto-649',
      rulesVersion: definition.rulesVersion,
      seed: 'pool-draw',
      mainNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };
    const supplementary = generateSupplementaryDraw(definition, 'lotto-649-001', 'pool-features', {
      advertisedJackpotCents: 500_000_000,
      poolsFundCents: 1_000_000_000,
      simulatedNationalSalesCents: 4_000_000_000,
      otherWinningSelectionsByTier: { '6/6': 2 },
    });
    const settled = settleTicketsForDraw(
      purchased,
      definition,
      'lotto-649-001',
      draw,
      timestamp,
      undefined,
      supplementary,
    );

    expect(settled.tickets[0]?.settlement?.poolPrizeCents).toBe(166_666_666);
    expect(settled.tickets[0]?.settlement?.unresolvedPoolShareTierIds).toEqual([]);
  });

  it('settles matching MAXPLUS and MAXMILLIONS series', () => {
    const definition = getLotteryDefinition('lotto-max');
    const selections = [
      { mainNumbers: [1, 2, 3, 4, 5, 6, 7] },
      { mainNumbers: [8, 9, 10, 11, 12, 13, 14] },
      { mainNumbers: [15, 16, 17, 18, 19, 20, 21] },
      { mainNumbers: [22, 23, 24, 25, 26, 27, 28] },
    ];
    const purchased = purchaseTicket(
      createTicketStore(createWallet(100_000, timestamp)),
      definition,
      {
        commandId: 'max-series-command',
        ticketId: 'max-series-ticket',
        lotteryId: 'lotto-max',
        drawId: 'lotto-max-001',
        purchasedAt: timestamp,
        selections,
      },
    );
    const draw: LotteryDrawResult = {
      lotteryId: 'lotto-max',
      rulesVersion: definition.rulesVersion,
      seed: 'max-draw',
      mainNumbers: [30, 31, 32, 33, 34, 35, 36],
      bonusNumber: 37,
    };
    const generated = generateSupplementaryDraw(definition, 'lotto-max-001', 'max-features', {
      advertisedJackpotCents: 5_000_000_000,
      poolsFundCents: 1_000_000_000,
      simulatedNationalSalesCents: 4_000_000_000,
      maxMillionsCount: 2,
    });
    const supplementary: SupplementaryDrawResult = {
      ...generated,
      maxPlusSeries: [selections[0]?.mainNumbers ?? []],
      maxMillionsSeries: [selections[1]?.mainNumbers ?? []],
    };
    const settled = settleTicketsForDraw(
      purchased,
      definition,
      'lotto-max-001',
      draw,
      timestamp,
      undefined,
      supplementary,
    );

    expect(settled.tickets[0]?.settlement?.maxSeriesPrizeCents).toBe(110_000_000);
  });
});
