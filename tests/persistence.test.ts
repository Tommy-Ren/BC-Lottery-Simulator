import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../src/app/initialGameState';
import { IndexedDbGameStateRepository } from '../src/storage/indexedDbGameStateRepository';
import {
  createGameStateSnapshot,
  parseGameStateJson,
  serializeGameState,
} from '../src/storage/gameStateSnapshot';

describe('versioned game-state persistence', () => {
  it('round-trips a validated v2 JSON snapshot', () => {
    const state = createInitialGameState();
    const restored = parseGameStateJson(serializeGameState(state));

    expect(restored.schemaVersion).toBe(2);
    expect(restored.state).toEqual(state);
  });

  it('migrates a v1 snapshot by adding Gold Ball result storage', () => {
    const state = createInitialGameState();
    const legacyState = { ...state } as Record<string, unknown>;
    delete legacyState.goldBallResults;
    const restored = parseGameStateJson(
      JSON.stringify({ schemaVersion: 1, savedAt: '2026-09-26T12:00:00.000Z', state: legacyState }),
    );

    expect(restored.schemaVersion).toBe(2);
    expect(restored.state.goldBallResults).toEqual({});
  });

  it('rejects malformed JSON, unknown schemas and an unbalanced wallet', () => {
    expect(() => parseGameStateJson('{')).toThrow('The file is not valid JSON.');
    expect(() => parseGameStateJson(JSON.stringify({ schemaVersion: 99 }))).toThrow(
      'Unsupported save schema version:',
    );

    const snapshot = createGameStateSnapshot(createInitialGameState());
    const corrupted = structuredClone(snapshot) as unknown as {
      state: { ticketStore: { wallet: { balanceCents: number } } };
    };
    corrupted.state.ticketStore.wallet.balanceCents = 1;
    expect(() => parseGameStateJson(JSON.stringify(corrupted))).toThrow(
      'The saved balance does not match the wallet ledger.',
    );
  });

  it('saves, loads and clears the current snapshot in IndexedDB', async () => {
    const repository = new IndexedDbGameStateRepository(new IDBFactory());
    const snapshot = createGameStateSnapshot(createInitialGameState(), '2026-09-26T12:05:00.000Z');

    expect(await repository.load()).toBeNull();
    await repository.save(snapshot);
    expect(await repository.load()).toEqual(snapshot);
    await repository.clear();
    expect(await repository.load()).toBeNull();
  });
});
