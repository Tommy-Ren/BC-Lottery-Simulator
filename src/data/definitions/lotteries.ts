import type {
  GameFeatureDefinition,
  LotteryDefinition,
  MatchRequirement,
  PrizeAward,
  PrizeTierDefinition,
} from '../../domain/lottery/types';
import { assertValidLotteryDefinition } from '../../domain/lottery/validation';

const verifiedOn = '2026-09-26';

function standardTier(
  id: string,
  label: string,
  mainMatches: number,
  award: PrizeAward,
  oddsOneIn: number,
  bonus: MatchRequirement = 'ignored',
  special: MatchRequirement = 'ignored',
): PrizeTierDefinition {
  return {
    id,
    label,
    condition: { kind: 'standard', mainMatches, bonus, special },
    award,
    oddsOneIn,
  };
}

function kenoTier(
  pickedNumbers: number,
  mainMatches: number,
  amountDollars: number,
  oddsOneIn: number,
): PrizeTierDefinition {
  return {
    id: `pick-${pickedNumbers}-match-${mainMatches}`,
    label: `Pick ${pickedNumbers} / Match ${mainMatches}`,
    condition: { kind: 'keno', pickedNumbers, mainMatches },
    award: { type: 'fixed-cash', amountCents: amountDollars * 100 },
    oddsOneIn,
  };
}

const extraFeature: GameFeatureDefinition = {
  id: 'extra',
  displayName: 'EXTRA',
  summary:
    'Add $1 per play. Four unique numbers from 1–99 are generated; prizes depend on matches.',
  priceCents: 100,
  details: {
    numberPool: { min: 1, max: 99, count: 4 },
    maxSelectionsPerTicket: 10,
    prizeTable: [
      { matches: 4, amountCents: 50_000_000, oddsOneIn: 3_764_376 },
      { matches: 3, amountCents: 100_000, oddsOneIn: 9_906 },
      { matches: 2, amountCents: 1_000, oddsOneIn: 141 },
      { matches: 1, amountCents: 100, oddsOneIn: 6.8 },
    ],
  },
};

const lottoMax: LotteryDefinition = {
  id: 'lotto-max',
  rulesVersion: 'playnow-2026-04-10',
  displayName: 'Lotto Max',
  description:
    'Each $6 Play includes four selections of 7 numbers from 1–52; the main jackpot can reach $90M.',
  draw: {
    mainNumbers: { min: 1, max: 52, count: 7 },
    hasBonusNumber: true,
    schedule: {
      type: 'weekly',
      weekdays: ['tuesday', 'friday'],
      drawTime: '19:30',
      salesCutoffTime: '19:21',
      timeZone: 'America/Vancouver',
    },
  },
  play: {
    basePriceCents: 600,
    selectionsPerPlay: 4,
    oddsBasis: 'per-play',
    allowedPickCounts: [7],
    maxSelectionsPerTransaction: 10,
    maxAdvanceDraws: 26,
  },
  prizeTiers: [
    standardTier('7/7', '7/7', 7, { type: 'pool-share' }, 33_446_140, 'excluded'),
    standardTier(
      '6/7+',
      '6/7 + Bonus',
      6,
      { type: 'pool-share', poolPercent: 18.5 },
      4_778_020,
      'required',
    ),
    standardTier('6/7', '6/7', 6, { type: 'pool-share', poolPercent: 18.85 }, 108_591, 'excluded'),
    standardTier(
      '5/7+',
      '5/7 + Bonus',
      5,
      { type: 'pool-share', poolPercent: 12.25 },
      36_197,
      'required',
    ),
    standardTier('5/7', '5/7', 5, { type: 'pool-share', poolPercent: 27.5 }, 1_684, 'excluded'),
    standardTier(
      '4/7+',
      '4/7 + Bonus',
      4,
      { type: 'pool-share', poolPercent: 22.9 },
      1_010,
      'required',
    ),
    standardTier('4/7', '4/7', 4, { type: 'fixed-cash', amountCents: 2_000 }, 72.2, 'excluded'),
    standardTier(
      '3/7+',
      '3/7 + Bonus',
      3,
      { type: 'fixed-cash', amountCents: 2_000 },
      72.2,
      'required',
    ),
    standardTier('3/7', '3/7', 3, { type: 'free-play', valueCents: 600 }, 7, 'excluded'),
  ],
  features: [
    {
      id: 'maxplus',
      displayName: 'MAXPLUS',
      summary:
        'Each $1M in the main jackpot funds one independent 7/52 draw, with a prize of at least $100,000 per draw.',
      details: {
        prizeCents: 10_000_000,
        seriesPerJackpotMillion: 1,
        maximumAdvertisedSeries: 90,
        winCondition: '7/7 only; win or share',
      },
    },
    {
      id: 'maxmillions',
      displayName: 'MAXMILLIONS',
      summary: 'When the main jackpot reaches $50M, an independent 7/52 draw awards $1M.',
      details: {
        activationJackpotCents: 5_000_000_000,
        prizeCents: 100_000_000,
        winCondition: '7/7 only; win or share',
      },
    },
    {
      id: 'combo-play',
      displayName: 'Combo Play',
      summary: 'Choose 8 or 9 numbers to expand into all possible 7-number combinations.',
      details: {
        options: [
          { pickedNumbers: 8, selections: 32, priceCents: 4_800 },
          { pickedNumbers: 9, selections: 144, priceCents: 21_600 },
        ],
      },
    },
    extraFeature,
  ],
  sources: [
    {
      label: 'PlayNow Lotto Max',
      url: 'https://www.playnow.com/lottery/lotto-max/',
      effectiveFrom: '2026-04-10',
      verifiedOn,
    },
    {
      label: 'Lotto Max Game Conditions',
      url: 'https://www.playnow.com/resources/pdf/lottery/lotto-max/lotto-max-game-conditions-in-effect-april-10-2026-1030pm-est.pdf',
      effectiveFrom: '2026-04-10',
      verifiedOn,
    },
  ],
};

const lotto649: LotteryDefinition = {
  id: 'lotto-649',
  rulesVersion: 'playnow-2024-01-22',
  displayName: 'Lotto 6/49',
  description:
    'Each $3 Play includes one Classic Selection of 6 from 49 and a unique Gold Ball Draw Number.',
  draw: {
    mainNumbers: { min: 1, max: 49, count: 6 },
    hasBonusNumber: true,
    schedule: {
      type: 'weekly',
      weekdays: ['wednesday', 'saturday'],
      drawTime: '19:30',
      salesCutoffTime: '19:21',
      timeZone: 'America/Vancouver',
    },
  },
  play: {
    basePriceCents: 300,
    selectionsPerPlay: 1,
    oddsBasis: 'per-selection',
    allowedPickCounts: [6],
    maxSelectionsPerTransaction: 10,
    maxAdvanceDraws: 26,
  },
  prizeTiers: [
    standardTier(
      '6/6',
      '6/6 Classic Jackpot',
      6,
      { type: 'pool-share', advertisedPoolCents: 500_000_000 },
      13_983_816,
      'excluded',
    ),
    standardTier(
      '5/6+',
      '5/6 + Bonus',
      5,
      { type: 'pool-share', poolPercent: 32.15 },
      2_330_636,
      'required',
    ),
    standardTier('5/6', '5/6', 5, { type: 'pool-share', poolPercent: 13.5 }, 55_492, 'excluded'),
    standardTier('4/6', '4/6', 4, { type: 'pool-share', poolPercent: 54.35 }, 1_033, 'ignored'),
    standardTier('3/6', '3/6', 3, { type: 'fixed-cash', amountCents: 1_000 }, 56.7),
    standardTier(
      '2/6+',
      '2/6 + Bonus',
      2,
      { type: 'fixed-cash', amountCents: 500 },
      81.2,
      'required',
    ),
    standardTier('2/6', '2/6', 2, { type: 'free-play', valueCents: 300 }, 8.3, 'excluded'),
  ],
  features: [
    {
      id: 'gold-ball',
      displayName: 'Gold Ball Draw',
      summary:
        'Each play receives a unique 10-digit number. A ticket number is drawn first, followed by a $1M white ball or the Gold Ball Jackpot.',
      details: {
        numberFormat: '########-##',
        initialPrizeBalls: 30,
        initialWhiteBalls: 29,
        whiteBallPrizeCents: 100_000_000,
        goldBalls: 1,
        whiteBallRemoval: true,
        resetAfterGoldBall: true,
      },
    },
    {
      id: 'combo-play',
      displayName: 'Combo Play',
      summary:
        'Choose 5, 7, 8, or 9 numbers to expand into the specified number of 6-number combinations.',
      details: {
        options: [
          { pickedNumbers: 5, selections: 44, priceCents: 13_200 },
          { pickedNumbers: 7, selections: 7, priceCents: 2_100 },
          { pickedNumbers: 8, selections: 28, priceCents: 8_400 },
          { pickedNumbers: 9, selections: 84, priceCents: 25_200 },
        ],
      },
    },
    extraFeature,
  ],
  sources: [
    {
      label: 'PlayNow Lotto 6/49',
      url: 'https://www.playnow.com/lottery/lotto-649/',
      effectiveFrom: '2024-01-22',
      verifiedOn,
    },
    {
      label: 'Lotto 6/49 Game Conditions',
      url: 'https://www.playnow.com/mb/resources/documents/lottery/lotto-649/game-conditions-as-of-sept-14-2022.pdf?v=2',
      effectiveFrom: '2024-01-22',
      verifiedOn,
    },
  ],
};

const bc49: LotteryDefinition = {
  id: 'bc-49',
  rulesVersion: 'playnow-verified-2026-09-26',
  displayName: 'BC/49',
  description:
    '$1 per 6/49 selection, with a fixed $2M jackpot and draws every Wednesday and Saturday.',
  draw: {
    mainNumbers: { min: 1, max: 49, count: 6 },
    hasBonusNumber: true,
    schedule: {
      type: 'weekly',
      weekdays: ['wednesday', 'saturday'],
      drawTime: '19:30',
      salesCutoffTime: '19:21',
      timeZone: 'America/Vancouver',
    },
  },
  play: {
    basePriceCents: 100,
    selectionsPerPlay: 1,
    oddsBasis: 'per-selection',
    allowedPickCounts: [6],
    maxSelectionsPerTransaction: 10,
    maxAdvanceDraws: 26,
  },
  prizeTiers: [
    standardTier(
      '6/6',
      '6/6',
      6,
      { type: 'pool-share', advertisedPoolCents: 200_000_000 },
      13_983_816,
      'excluded',
    ),
    standardTier(
      '5/6+',
      '5/6 + Bonus',
      5,
      { type: 'fixed-cash', amountCents: 7_500_000, sharedPoolCapCents: 45_000_000 },
      2_330_636,
      'required',
    ),
    standardTier('5/6', '5/6', 5, { type: 'fixed-cash', amountCents: 75_000 }, 55_492, 'excluded'),
    standardTier('4/6', '4/6', 4, { type: 'fixed-cash', amountCents: 7_500 }, 1_033),
    standardTier('3/6', '3/6', 3, { type: 'fixed-cash', amountCents: 1_000 }, 56),
    standardTier(
      '2/6+',
      '2/6 + Bonus',
      2,
      { type: 'fixed-cash', amountCents: 500 },
      81,
      'required',
    ),
  ],
  features: [
    {
      id: 'combo-play',
      displayName: 'Combo Play',
      summary:
        'Choose 5, 7, 8, or 9 numbers to expand into the specified number of 6-number combinations.',
      details: {
        options: [
          { pickedNumbers: 5, selections: 44, priceCents: 4_400 },
          { pickedNumbers: 7, selections: 7, priceCents: 700 },
          { pickedNumbers: 8, selections: 28, priceCents: 2_800 },
          { pickedNumbers: 9, selections: 84, priceCents: 8_400 },
        ],
      },
    },
    extraFeature,
  ],
  sources: [
    {
      label: 'PlayNow BC/49',
      url: 'https://www.playnow.com/lottery/bc-49/',
      verifiedOn,
    },
  ],
};

const dailyGrand: LotteryDefinition = {
  id: 'daily-grand',
  rulesVersion: 'playnow-verified-2026-09-26',
  displayName: 'Daily Grand',
  description: '$3 per selection of 5 from 49, with a system-generated GRAND NUMBER from 1–7.',
  draw: {
    mainNumbers: { min: 1, max: 49, count: 5 },
    hasBonusNumber: false,
    specialNumber: { min: 1, max: 7, count: 1 },
    schedule: {
      type: 'weekly',
      weekdays: ['monday', 'thursday'],
      drawTime: '19:30',
      salesCutoffTime: '19:21',
      timeZone: 'America/Vancouver',
    },
  },
  play: {
    basePriceCents: 300,
    selectionsPerPlay: 1,
    oddsBasis: 'per-selection',
    allowedPickCounts: [5],
    maxSelectionsPerTransaction: 10,
    maxAdvanceDraws: 26,
    specialNumberMode: 'computer-generated',
  },
  prizeTiers: [
    standardTier(
      '5/5+grand',
      '5/5 + GRAND NUMBER',
      5,
      {
        type: 'annuity-or-cash',
        annuityLabel: '$1,000 a day for life',
        lumpSumCents: 700_000_000,
        shareLumpSumIfMultiple: true,
      },
      13_348_188,
      'ignored',
      'required',
    ),
    standardTier(
      '5/5',
      '5/5',
      5,
      {
        type: 'annuity-or-cash',
        annuityLabel: '$25,000 a year for life',
        lumpSumCents: 50_000_000,
        shareLumpSumIfMultiple: true,
      },
      2_224_698,
      'ignored',
      'excluded',
    ),
    standardTier(
      '4/5+grand',
      '4/5 + GRAND',
      4,
      { type: 'fixed-cash', amountCents: 100_000 },
      60_674,
      'ignored',
      'required',
    ),
    standardTier(
      '4/5',
      '4/5',
      4,
      { type: 'fixed-cash', amountCents: 50_000 },
      10_112,
      'ignored',
      'excluded',
    ),
    standardTier(
      '3/5+grand',
      '3/5 + GRAND',
      3,
      { type: 'fixed-cash', amountCents: 10_000 },
      1_411,
      'ignored',
      'required',
    ),
    standardTier(
      '3/5',
      '3/5',
      3,
      { type: 'fixed-cash', amountCents: 2_000 },
      235.2,
      'ignored',
      'excluded',
    ),
    standardTier(
      '2/5+grand',
      '2/5 + GRAND',
      2,
      { type: 'fixed-cash', amountCents: 1_000 },
      100.8,
      'ignored',
      'required',
    ),
    standardTier(
      '1/5+grand',
      '1/5 + GRAND',
      1,
      { type: 'fixed-cash', amountCents: 400 },
      19.7,
      'ignored',
      'required',
    ),
    standardTier(
      '0/5+grand',
      '0/5 + GRAND',
      0,
      { type: 'free-play', valueCents: 300 },
      12.3,
      'ignored',
      'required',
    ),
  ],
  features: [
    {
      id: 'combo-play',
      displayName: 'Combo 5',
      summary:
        'Pair the same five main numbers with all seven GRAND NUMBER values to create seven plays.',
      details: {
        pickedMainNumbers: 5,
        selections: 7,
        priceCents: 2_100,
      },
    },
    extraFeature,
  ],
  sources: [
    {
      label: 'PlayNow Daily Grand',
      url: 'https://www.playnow.com/lottery/daily-grand/',
      verifiedOn,
    },
  ],
};

const kenoPrizeTiers = [
  kenoTier(1, 1, 2, 4),
  kenoTier(2, 2, 10, 17),
  kenoTier(3, 3, 25, 73),
  kenoTier(3, 2, 2, 8),
  kenoTier(4, 4, 50, 327),
  kenoTier(4, 3, 5, 24),
  kenoTier(4, 2, 1, 5),
  kenoTier(5, 5, 500, 1_551),
  kenoTier(5, 4, 15, 83),
  kenoTier(5, 3, 2, 12),
  kenoTier(6, 6, 1_500, 7_753),
  kenoTier(6, 5, 50, 324),
  kenoTier(6, 4, 5, 36),
  kenoTier(6, 3, 1, 8),
  kenoTier(7, 7, 5_000, 40_980),
  kenoTier(7, 6, 150, 1_366),
  kenoTier(7, 5, 15, 116),
  kenoTier(7, 4, 2, 20),
  kenoTier(7, 3, 1, 6),
  kenoTier(8, 8, 15_000, 230_115),
  kenoTier(8, 7, 400, 6_233),
  kenoTier(8, 6, 50, 423),
  kenoTier(8, 5, 10, 55),
  kenoTier(8, 4, 2, 13),
  kenoTier(9, 9, 25_000, 1_380_688),
  kenoTier(9, 8, 2_500, 30_682),
  kenoTier(9, 7, 200, 1_691),
  kenoTier(9, 6, 25, 175),
  kenoTier(9, 5, 4, 31),
  kenoTier(9, 4, 1, 9),
  kenoTier(10, 10, 200_000, 8_911_712),
  kenoTier(10, 9, 10_000, 163_382),
  kenoTier(10, 8, 500, 7_385),
  kenoTier(10, 7, 50, 621),
  kenoTier(10, 6, 10, 88),
  kenoTier(10, 5, 3, 20),
  kenoTier(10, 0, 3, 22),
] as const;

const keno: LotteryDefinition = {
  id: 'keno',
  rulesVersion: 'playnow-verified-2026-09-26',
  displayName: 'Keno',
  description:
    'Choose 1–10 numbers from 1–80; 20 numbers are drawn every 3 minutes and 30 seconds.',
  draw: {
    mainNumbers: { min: 1, max: 80, count: 20 },
    hasBonusNumber: false,
    schedule: { type: 'interval', intervalSeconds: 210 },
  },
  play: {
    basePriceCents: 100,
    selectionsPerPlay: 1,
    oddsBasis: 'per-one-dollar-wager',
    allowedPickCounts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    wagerOptionsCents: [100, 200, 500, 1_000],
    maxAdvanceDraws: 99,
  },
  prizeTiers: kenoPrizeTiers,
  features: [
    {
      id: 'keno-bonus',
      displayName: 'Keno Bonus',
      summary:
        'Adds 100% to the wager; prizes are multiplied by a factor drawn before the results.',
      details: {
        costMultiplier: 2,
        prizeCapCents: 200_000_000,
        multiplierOdds: [
          { multiplier: 1.5, oddsOneIn: 2.04 },
          { multiplier: 2, oddsOneIn: 2.25 },
          { multiplier: 5, oddsOneIn: 24.71 },
          { multiplier: 7, oddsOneIn: 49.43 },
          { multiplier: 10, oddsOneIn: 346 },
        ],
      },
    },
    {
      id: 'keno-pattern-play',
      displayName: 'Keno Pattern Play',
      summary:
        'A fixed $2 play with symmetric prizes based on matches or misses across 20 preset numbers.',
      priceCents: 200,
      details: {
        prizeTable: [
          { matches: '20 or 0', amountCents: 5_000_000, oddsOneIn: 12_823_377 },
          { matches: '19 or 1', amountCents: 2_500_000, oddsOneIn: 336_614 },
          { matches: '18 or 2', amountCents: 200_000, oddsOneIn: 19_988 },
          { matches: '17 or 3', amountCents: 40_000, oddsOneIn: 2_016 },
          { matches: '16 or 4', amountCents: 5_000, oddsOneIn: 308 },
          { matches: '15 or 5', amountCents: 1_500, oddsOneIn: 67 },
          { matches: '14 or 6', amountCents: 500, oddsOneIn: 20 },
          { matches: '13 or 7', amountCents: 300, oddsOneIn: 8 },
        ],
      },
    },
  ],
  sources: [
    {
      label: 'PlayNow Keno',
      url: 'https://www.playnow.com/keno/',
      verifiedOn,
    },
    {
      label: 'PlayNow How to Play Keno',
      url: 'https://www.playnow.com/keno/learn/',
      verifiedOn,
    },
    {
      label: 'PlayNow Keno Purchase Flow',
      url: 'https://www.playnow.com/keno/play/',
      verifiedOn,
    },
  ],
};

export const lotteryDefinitions = [lottoMax, lotto649, bc49, dailyGrand, keno] as const;

lotteryDefinitions.forEach(assertValidLotteryDefinition);

export function getLotteryDefinition(id: LotteryDefinition['id']): LotteryDefinition {
  const definition = lotteryDefinitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown lottery definition: ${id}.`);
  return definition;
}
