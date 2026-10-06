// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createInitialGameState } from '../src/app/initialGameState';
import { createWallet } from '../src/domain/economy/wallet';
import { createTicketStore } from '../src/domain/lottery/tickets';
import type { GameStateRepository } from '../src/storage/gameStateRepository';
import {
  createGameStateSnapshot,
  initialTimestamp,
  type GameStateSnapshot,
} from '../src/storage/gameStateSnapshot';

afterEach(cleanup);

describe('data management UI', () => {
  it('hydrates a saved balance and performs a confirmed reset', async () => {
    const savedState = createInitialGameState();
    const snapshot = createGameStateSnapshot({
      ...savedState,
      ticketStore: createTicketStore(createWallet(12_345, initialTimestamp)),
    });
    const clear = vi.fn(() => Promise.resolve());
    const repository: GameStateRepository<GameStateSnapshot> = {
      load: vi.fn(() => Promise.resolve(snapshot)),
      save: vi.fn(() => Promise.resolve()),
      clear,
    };
    const user = userEvent.setup();
    render(<App repository={repository} />);

    expect(await screen.findByLabelText(/账户.*123\.45/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /账户.*123\.45/ }));
    await user.click(screen.getByRole('button', { name: /我的账户/ }));
    expect(screen.getByRole('dialog', { name: '存档与数据' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重置所有数据' }));
    await user.click(screen.getByRole('button', { name: '确认永久重置' }));

    expect(clear).toHaveBeenCalledOnce();
    expect(await screen.findByLabelText(/账户.*1,000\.00/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
