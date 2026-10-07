const drawApis = {
  'lotto-max': 'lmax',
  'lotto-649': 'six49',
  'bc-49': 'bc49',
  'daily-grand': 'dgrd',
};

function queryValue(value) {
  return typeof value === 'string' ? value : '';
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const gameId = queryValue(request.query.gameId);
  const date = queryValue(request.query.date);
  const apiId = drawApis[gameId];
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (
    !apiId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return response.status(400).json({ error: 'Invalid game or draw date.' });
  }

  try {
    const upstream = await fetch(
      `https://www.playnow.com/services2/lotto/draw/${apiId}/${date}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
    );
    response.setHeader('Cache-Control', 'no-store');
    if (upstream.status === 400 || upstream.status === 404) {
      return response.status(404).json({ error: 'No draw results for this date.' });
    }
    if (!upstream.ok) {
      return response.status(502).json({ error: 'Official results are temporarily unavailable.' });
    }
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: 'Official results are temporarily unavailable.' });
  }
}
