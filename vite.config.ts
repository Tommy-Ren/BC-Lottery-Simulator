/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';

const drawApis: Record<string, string> = {
  'lotto-max': 'lmax',
  'lotto-649': 'six49',
  'bc-49': 'bc49',
  'daily-grand': 'dgrd',
};

function handleHistoryRequest(): Connect.NextHandleFunction {
  return (request, response, next) => {
    const incoming = request as unknown as { readonly url?: string; readonly method?: string };
    const outgoing = response as unknown as {
      statusCode: number;
      readonly headersSent: boolean;
      setHeader(name: string, value: string): void;
      end(body?: string): void;
    };
    const match = (incoming.url ?? '/').match(
      /^\/api\/history\/draw\/([^/]+)\/(\d{4}-\d{2}-\d{2})(?:\?.*)?$/,
    );
    if (!match) {
      next();
      return;
    }
    if (incoming.method !== 'GET') {
      outgoing.statusCode = 405;
      outgoing.end();
      return;
    }
    const [, gameId, date] = match;
    const apiId = drawApis[gameId ?? ''];
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (
      !apiId ||
      !date ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      outgoing.statusCode = 400;
      outgoing.setHeader('Content-Type', 'application/json');
      outgoing.end(JSON.stringify({ error: 'Invalid game or draw date.' }));
      return;
    }

    const fetchOfficial = (
      globalThis as unknown as {
        fetch: (
          url: string,
          init: { headers: Record<string, string>; signal: unknown },
        ) => Promise<{
          readonly status: number;
          readonly ok: boolean;
          json(): Promise<unknown>;
        }>;
      }
    ).fetch;
    const timeoutSignal = (
      globalThis as unknown as {
        AbortSignal: { timeout(milliseconds: number): unknown };
      }
    ).AbortSignal.timeout(8_000);
    void fetchOfficial(`https://www.playnow.com/services2/lotto/draw/${apiId}/${date}`, {
      headers: { Accept: 'application/json' },
      signal: timeoutSignal,
    })
      .then(async (upstream) => {
        outgoing.statusCode = upstream.status;
        outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
        outgoing.setHeader('Cache-Control', 'no-store');
        if (!upstream.ok) {
          outgoing.end(JSON.stringify({ error: `Official results returned ${upstream.status}.` }));
          return;
        }
        outgoing.end(JSON.stringify(await upstream.json()));
      })
      .catch(() => {
        if (outgoing.headersSent) return;
        outgoing.statusCode = 502;
        outgoing.setHeader('Content-Type', 'application/json');
        outgoing.end(JSON.stringify({ error: 'Official results are temporarily unavailable.' }));
      });
  };
}

const localHistoryApi: Plugin = {
  name: 'local-playnow-history-api',
  configureServer(server) {
    server.middlewares.use(handleHistoryRequest());
  },
  configurePreviewServer(server) {
    server.middlewares.use(handleHistoryRequest());
  },
};

export default defineConfig({
  plugins: [react(), localHistoryApi],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
