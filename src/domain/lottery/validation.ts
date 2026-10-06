import type { LotteryDefinition, LotterySelection, NumberPoolDefinition } from './types';

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertValidPool(pool: NumberPoolDefinition, label: string): void {
  if (!Number.isInteger(pool.min) || !Number.isInteger(pool.max)) {
    throw new Error(`${label} range must contain integers.`);
  }

  if (pool.min < 0 || pool.max < pool.min) {
    throw new Error(`${label} has an invalid range.`);
  }

  assertPositiveInteger(pool.count, `${label}.count`);

  if (pool.count > pool.max - pool.min + 1) {
    throw new Error(`${label} cannot draw more unique numbers than the pool contains.`);
  }
}

export function assertValidLotteryDefinition(definition: LotteryDefinition): void {
  assertValidPool(definition.draw.mainNumbers, `${definition.id}.draw.mainNumbers`);

  if (definition.draw.specialNumber) {
    assertValidPool(definition.draw.specialNumber, `${definition.id}.draw.specialNumber`);
  }

  assertPositiveInteger(definition.play.basePriceCents, `${definition.id}.play.basePriceCents`);
  assertPositiveInteger(
    definition.play.selectionsPerPlay,
    `${definition.id}.play.selectionsPerPlay`,
  );

  if (definition.play.allowedPickCounts.length === 0) {
    throw new Error(`${definition.id} must allow at least one pick count.`);
  }

  const maximumPoolSize = definition.draw.mainNumbers.max - definition.draw.mainNumbers.min + 1;
  definition.play.allowedPickCounts.forEach((count) => {
    assertPositiveInteger(count, `${definition.id}.play.allowedPickCounts`);
    if (count > maximumPoolSize) {
      throw new Error(`${definition.id} pick count exceeds its number pool.`);
    }
  });

  if (definition.draw.hasBonusNumber && definition.draw.mainNumbers.count >= maximumPoolSize) {
    throw new Error(`${definition.id} has no number left for a bonus draw.`);
  }

  if (definition.draw.schedule.type === 'interval') {
    assertPositiveInteger(
      definition.draw.schedule.intervalSeconds,
      `${definition.id}.draw.schedule.intervalSeconds`,
    );
  } else if (definition.draw.schedule.weekdays.length === 0) {
    throw new Error(`${definition.id} weekly schedule must contain a weekday.`);
  }

  const tierIds = new Set<string>();
  definition.prizeTiers.forEach((tier) => {
    if (tierIds.has(tier.id)) {
      throw new Error(`${definition.id} contains duplicate prize tier ${tier.id}.`);
    }
    tierIds.add(tier.id);

    if (tier.oddsOneIn <= 0) {
      throw new Error(`${definition.id}.${tier.id} must have positive odds.`);
    }
  });

  if (definition.sources.length === 0) {
    throw new Error(`${definition.id} must cite an official source.`);
  }

  definition.sources.forEach((source) => {
    if (!source.url.startsWith('https://www.playnow.com/')) {
      throw new Error(`${definition.id} source must be an official PlayNow URL.`);
    }
  });
}

export function assertValidSelection(
  definition: LotteryDefinition,
  selection: LotterySelection,
): void {
  const allowedCounts = definition.play.allowedPickCounts;
  if (!allowedCounts.includes(selection.mainNumbers.length)) {
    throw new Error(
      `${definition.id} requires one of these pick counts: ${allowedCounts.join(', ')}.`,
    );
  }

  const uniqueNumbers = new Set(selection.mainNumbers);
  if (uniqueNumbers.size !== selection.mainNumbers.length) {
    throw new Error(`${definition.id} selection cannot contain duplicate numbers.`);
  }

  for (const number of selection.mainNumbers) {
    if (
      !Number.isInteger(number) ||
      number < definition.draw.mainNumbers.min ||
      number > definition.draw.mainNumbers.max
    ) {
      throw new Error(`${definition.id} selection contains an out-of-range number.`);
    }
  }

  const specialPool = definition.draw.specialNumber;
  if (specialPool) {
    if (
      selection.specialNumber === undefined ||
      !Number.isInteger(selection.specialNumber) ||
      selection.specialNumber < specialPool.min ||
      selection.specialNumber > specialPool.max
    ) {
      throw new Error(`${definition.id} selection requires a valid special number.`);
    }
  } else if (selection.specialNumber !== undefined) {
    throw new Error(`${definition.id} does not accept a special number.`);
  }
}
