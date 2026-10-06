// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import {
  drawsForGame,
  historicalDrawSnapshot,
  numberFrequencies,
} from '../src/data/history/historicalDraws';
import { I18nProvider } from '../src/i18n/I18nContext';
import type { GameStateRepository } from '../src/storage/gameStateRepository';
import type { GameStateSnapshot } from '../src/storage/gameStateSnapshot';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const emptyRepository: GameStateRepository<GameStateSnapshot> = {
  load: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve()),
  clear: vi.fn(() => Promise.resolve()),
};

describe('official winning-number snapshot', () => {
  it('contains two weekly draws for each game across the five-year local range', () => {
    expect(historicalDrawSnapshot.drawCount).toBe(2088);
    expect(historicalDrawSnapshot.range).toEqual({ from: '2021-09-27', to: '2026-09-27' });
    expect(drawsForGame('lotto-max')).toHaveLength(522);
    expect(drawsForGame('lotto-649')).toHaveLength(522);
    expect(drawsForGame('bc-49')).toHaveLength(522);
    expect(drawsForGame('daily-grand')).toHaveLength(522);
  });

  it('accounts for every Lotto Max main number in the frequency model', () => {
    const frequencies = numberFrequencies('lotto-max');
    expect(frequencies).toHaveLength(52);
    expect(frequencies.reduce((total, item) => total + item.count, 0)).toBe(522 * 7);
  });
});

describe('Sprint 7 interface', () => {
  it('opens the visual statistics project and switches datasets', async () => {
    const user = userEvent.setup();
    render(<App repository={emptyRepository} />);

    await user.click(screen.getByRole('button', { name: '历史统计' }));
    expect(screen.getByRole('heading', { name: '历史中奖号码统计' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Lotto Max' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'BC/49' }));
    expect(screen.getByRole('tab', { name: 'BC/49' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/历史频率不改变/)).toBeInTheDocument();
  });

  it('switches the primary experience to English and remembers the choice', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <App repository={emptyRepository} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { name: 'Play Lottery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Number Stats' })).toBeInTheDocument();
    expect(window.localStorage.getItem('bc-lottery-language')).toBe('en');
  });

  it('opens on click, accepts Quick Deposit and closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(<App repository={emptyRepository} />);

    await user.click(screen.getByRole('button', { name: /账户.*1,000\.00/ }));
    expect(screen.getByRole('dialog', { name: '本地账户' })).toBeInTheDocument();
    const amount = screen.getByRole('spinbutton', { name: '存入虚拟 Cash' });
    await user.clear(amount);
    await user.type(amount, '250.50');
    await user.click(screen.getByRole('button', { name: 'Quick Deposit' }));
    expect(screen.getByLabelText(/账户.*1,250\.50/)).toBeInTheDocument();
    expect(screen.getAllByText('$0.00', { selector: 'strong' })).toHaveLength(2);

    await user.click(screen.getByRole('heading', { name: '选择彩票' }));
    expect(screen.queryByRole('dialog', { name: '本地账户' })).not.toBeInTheDocument();
  });

  it('filters statistics with a user-defined date range', async () => {
    const user = userEvent.setup();
    render(<App repository={emptyRepository} />);

    await user.click(screen.getByRole('button', { name: '历史统计' }));
    const from = screen.getByLabelText('开始日期');
    const to = screen.getByLabelText('结束日期');
    await user.clear(from);
    await user.type(from, '2026-09-01');
    await user.clear(to);
    await user.type(to, '2026-09-27');
    expect(from).toHaveValue('2026-09-01');
    expect(to).toHaveValue('2026-09-27');
    expect(screen.getByText('8', { selector: 'strong' })).toBeInTheDocument();
  });
});
