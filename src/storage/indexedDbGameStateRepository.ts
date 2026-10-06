import type { GameStateRepository } from './gameStateRepository';
import { migrateGameState, type GameStateSnapshot } from './gameStateSnapshot';

const databaseName = 'bc-lottery-simulator';
const databaseVersion = 1;
const objectStoreName = 'game-state';
const currentStateKey = 'current';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed.')),
    );
  });
}

export class IndexedDbGameStateRepository implements GameStateRepository<GameStateSnapshot> {
  constructor(private readonly indexedDb: IDBFactory | undefined = globalThis.indexedDB) {}

  private async open(): Promise<IDBDatabase | null> {
    if (!this.indexedDb) return null;
    const request = this.indexedDb.open(databaseName, databaseVersion);
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) {
        request.result.createObjectStore(objectStoreName);
      }
    });
    return requestResult(request);
  }

  async load(): Promise<GameStateSnapshot | null> {
    const database = await this.open();
    if (!database) return null;
    try {
      const transaction = database.transaction(objectStoreName, 'readonly');
      const value: unknown = await requestResult<unknown>(
        transaction.objectStore(objectStoreName).get(currentStateKey),
      );
      return value === undefined ? null : migrateGameState(value);
    } finally {
      database.close();
    }
  }

  async save(state: GameStateSnapshot): Promise<void> {
    const database = await this.open();
    if (!database) return;
    try {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      await requestResult(transaction.objectStore(objectStoreName).put(state, currentStateKey));
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await this.open();
    if (!database) return;
    try {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      await requestResult(transaction.objectStore(objectStoreName).delete(currentStateKey));
    } finally {
      database.close();
    }
  }
}

export const gameStateRepository = new IndexedDbGameStateRepository();
