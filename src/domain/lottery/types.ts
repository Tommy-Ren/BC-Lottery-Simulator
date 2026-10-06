export type LotteryId = 'lotto-max' | 'lotto-649' | 'bc-49' | 'daily-grand' | 'keno';

export type Weekday =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface NumberPoolDefinition {
  readonly min: number;
  readonly max: number;
  readonly count: number;
}

export interface WeeklyDrawSchedule {
  readonly type: 'weekly';
  readonly weekdays: readonly Weekday[];
  readonly drawTime: string;
  readonly salesCutoffTime: string;
  readonly timeZone: 'America/Vancouver';
}

export interface IntervalDrawSchedule {
  readonly type: 'interval';
  readonly intervalSeconds: number;
}

export type DrawSchedule = WeeklyDrawSchedule | IntervalDrawSchedule;

export interface OfficialRuleSource {
  readonly label: string;
  readonly url: string;
  readonly effectiveFrom?: string;
  readonly verifiedOn: string;
}

export interface DrawDefinition {
  readonly mainNumbers: NumberPoolDefinition;
  readonly hasBonusNumber: boolean;
  readonly specialNumber?: NumberPoolDefinition;
  readonly schedule: DrawSchedule;
}

export interface PlayDefinition {
  readonly basePriceCents: number;
  readonly selectionsPerPlay: number;
  readonly oddsBasis: 'per-play' | 'per-selection' | 'per-one-dollar-wager';
  readonly allowedPickCounts: readonly number[];
  readonly maxSelectionsPerTransaction?: number;
  readonly maxAdvanceDraws?: number;
  readonly wagerOptionsCents?: readonly number[];
  readonly specialNumberMode?: 'player-selected' | 'computer-generated';
}

export type MatchRequirement = 'required' | 'excluded' | 'ignored';

export interface StandardPrizeCondition {
  readonly kind: 'standard';
  readonly mainMatches: number;
  readonly bonus: MatchRequirement;
  readonly special: MatchRequirement;
}

export interface KenoPrizeCondition {
  readonly kind: 'keno';
  readonly pickedNumbers: number;
  readonly mainMatches: number;
}

export type PrizeCondition = StandardPrizeCondition | KenoPrizeCondition;

export type PrizeAward =
  | {
      readonly type: 'fixed-cash';
      readonly amountCents: number;
      readonly sharedPoolCapCents?: number;
    }
  | { readonly type: 'free-play'; readonly valueCents: number }
  | {
      readonly type: 'pool-share';
      readonly poolPercent?: number;
      readonly advertisedPoolCents?: number;
    }
  | {
      readonly type: 'annuity-or-cash';
      readonly annuityLabel: string;
      readonly lumpSumCents: number;
      readonly shareLumpSumIfMultiple?: boolean;
    };

export interface PrizeTierDefinition {
  readonly id: string;
  readonly label: string;
  readonly condition: PrizeCondition;
  readonly award: PrizeAward;
  readonly oddsOneIn: number;
}

export interface GameFeatureDefinition {
  readonly id:
    | 'extra'
    | 'gold-ball'
    | 'maxplus'
    | 'maxmillions'
    | 'combo-play'
    | 'keno-bonus'
    | 'keno-pattern-play';
  readonly displayName: string;
  readonly summary: string;
  readonly priceCents?: number;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface LotteryDefinition {
  readonly id: LotteryId;
  readonly rulesVersion: string;
  readonly displayName: string;
  readonly description: string;
  readonly draw: DrawDefinition;
  readonly play: PlayDefinition;
  readonly prizeTiers: readonly PrizeTierDefinition[];
  readonly features: readonly GameFeatureDefinition[];
  readonly sources: readonly OfficialRuleSource[];
}

export interface LotterySelection {
  readonly mainNumbers: readonly number[];
  readonly specialNumber?: number;
}

export interface LotteryDrawResult {
  readonly lotteryId: LotteryId;
  readonly rulesVersion: string;
  readonly seed: string;
  readonly mainNumbers: readonly number[];
  readonly bonusNumber?: number;
  readonly specialNumber?: number;
}

export interface PrizeEvaluation {
  readonly tier: PrizeTierDefinition | null;
  readonly mainMatches: number;
  readonly bonusMatched: boolean;
  readonly specialMatched: boolean;
}
