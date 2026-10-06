export interface GameStateRepository<TGameState> {
  load(): Promise<TGameState | null>;
  save(state: TGameState): Promise<void>;
  clear(): Promise<void>;
}
