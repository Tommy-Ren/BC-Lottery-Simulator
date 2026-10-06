import {
  getHistoricalDraws,
  mergeLiveHistoricalDraws,
  type HistoricalDraw,
  type HistoricalGameId,
} from './historicalDraws';

const games: ReadonlyArray<{
  readonly id: HistoricalGameId;
  readonly apiId: string;
  readonly weekdays: readonly number[];
}> = [
  { id: 'lotto-max', apiId: 'lmax', weekdays: [2, 5] },
  { id: 'lotto-649', apiId: 'six49', weekdays: [3, 6] },
  { id: 'bc-49', apiId: 'bc49', weekdays: [3, 6] },
  { id: 'daily-grand', apiId: 'dgrd', weekdays: [1, 4] },
];

let activeRefresh: Promise<{ readonly added: number }> | null = null;

function vancouverToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function scheduledDatesAfter(lastDrawDate: string, today: string, weekdays: readonly number[]) {
  const latest = new Date(`${lastDrawDate}T12:00:00Z`);
  const end = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(latest.getTime()) || Number.isNaN(end.getTime())) return [];

  // A stale snapshot should not trigger a request for every historical date on page open.
  const earliest = new Date(Math.max(latest.getTime(), end.getTime() - 45 * 24 * 60 * 60 * 1000));
  const dates: string[] = [];
  for (
    const cursor = new Date(earliest);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    if (cursor > latest && weekdays.includes(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
  }
  return dates;
}

async function fetchDraw(
  game: (typeof games)[number],
  date: string,
): Promise<HistoricalDraw | null> {
  const response = await fetch(`/api/history/draw/${game.id}/${date}`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not retrieve ${game.id} results for ${date}.`);
  const result: unknown = await response.json();
  if (typeof result !== 'object' || result === null) return null;
  const record = result as Record<string, unknown>;
  if (!Array.isArray(record.drawNbrs) || record.drawNbrs.length === 0) return null;
  if (!record.drawNbrs.every((number) => Number.isInteger(number))) return null;

  return {
    gameId: game.id,
    drawNumber: Number.isSafeInteger(record.drawNbr) ? Number(record.drawNbr) : 0,
    drawDate: date,
    mainNumbers: record.drawNbrs as number[],
    ...(Number.isInteger(record.bonusNbr) ? { bonusNumber: Number(record.bonusNbr) } : {}),
    extraNumbers: Array.isArray(record.extraNbrs)
      ? record.extraNbrs.filter((number): number is number => Number.isInteger(number))
      : [],
  };
}

async function refresh(): Promise<{ readonly added: number }> {
  const today = vancouverToday();
  const draws = getHistoricalDraws();
  const jobs = games.flatMap((game) => {
    const lastDrawDate = draws
      .filter((draw) => draw.gameId === game.id)
      .reduce((latest, draw) => (draw.drawDate > latest ? draw.drawDate : latest), '');
    return lastDrawDate
      ? scheduledDatesAfter(lastDrawDate, today, game.weekdays).map((date) => ({ game, date }))
      : [];
  });

  const found: HistoricalDraw[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      if (!job) continue;
      const draw = await fetchDraw(job.game, job.date);
      if (draw) found.push(draw);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, () => worker()));
  return { added: mergeLiveHistoricalDraws(found) };
}

export function refreshLatestHistoricalDraws(): Promise<{ readonly added: number }> {
  if (activeRefresh) return activeRefresh;
  activeRefresh = refresh().finally(() => {
    activeRefresh = null;
  });
  return activeRefresh;
}
