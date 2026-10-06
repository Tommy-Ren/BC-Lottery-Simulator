import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourceOrigin = 'https://www.playnow.com';
const games = [
  { id: 'lotto-max', apiId: 'lmax', weekdays: [2, 5] },
  { id: 'lotto-649', apiId: 'six49', weekdays: [3, 6] },
  { id: 'bc-49', apiId: 'bc49', weekdays: [3, 6] },
  { id: 'daily-grand', apiId: 'dgrd', weekdays: [1, 4] },
];
const outputPath = resolve('src/data/history/playnow-winning-numbers.json');
const endDate = new Date(`${process.argv[2] ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);
const startDate = process.argv[3] ? new Date(`${process.argv[3]}T12:00:00Z`) : new Date(endDate);
if (!process.argv[3]) startDate.setUTCFullYear(startDate.getUTCFullYear() - 5);
if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
  throw new Error('Usage: npm run sync:draws -- <to YYYY-MM-DD> [from YYYY-MM-DD]');
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

const jobs = [];
for (const game of games) {
  for (
    const cursor = new Date(startDate);
    cursor <= endDate;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    if (game.weekdays.includes(cursor.getUTCDay())) jobs.push({ game, date: isoDate(cursor) });
  }
}

async function fetchDraw({ game, date }, attempt = 1) {
  const url = `${sourceOrigin}/services2/lotto/draw/${game.apiId}/${date}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    if (attempt < 4) return fetchDraw({ game, date }, attempt + 1);
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  const value = await response.json();
  if (!Array.isArray(value.drawNbrs) || value.drawNbrs.length === 0) {
    throw new Error(`Missing draw result: ${url}`);
  }
  return {
    gameId: game.id,
    drawNumber: value.drawNbr,
    drawDate: date,
    mainNumbers: value.drawNbrs,
    bonusNumber: value.bonusNbr ?? null,
    extraNumbers: value.extraNbrs ?? [],
  };
}

async function pooledMap(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return output;
}

const draws = await pooledMap(jobs, 8, fetchDraw);
draws.sort(
  (left, right) =>
    left.drawDate.localeCompare(right.drawDate) || left.gameId.localeCompare(right.gameId),
);
const snapshot = {
  schemaVersion: 1,
  source: `${sourceOrigin}/lottery/winning-numbers/`,
  sourceApi: `${sourceOrigin}/services2/lotto/draw/{game}/{date}`,
  fetchedAt: new Date().toISOString(),
  range: { from: isoDate(startDate), to: isoDate(endDate) },
  drawCount: draws.length,
  games: games.map(({ id, apiId, weekdays }) => ({ id, apiId, weekdays })),
  draws,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
process.stdout.write(`Saved ${draws.length} official draws to ${outputPath}\n`);
