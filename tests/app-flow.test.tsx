// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

afterEach(cleanup);

async function finishQuickPick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Quick Pick' }));
  await user.click(screen.getByRole('button', { name: '继续' }));
  await user.click(screen.getByRole('button', { name: '确认购买' }));
}

describe('BC/49 purchase flow', () => {
  it('quick-picks, purchases and shows an auditable ticket', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameHeading = screen.getByRole('heading', { name: 'BC/49' });
    const gameCard = gameHeading.closest('article');
    expect(gameCard).not.toBeNull();
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /购买彩票/ }));

    await finishQuickPick(user);

    expect(screen.getByRole('button', { name: /我的票据 1/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/账户.*999\.00/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));
    expect(screen.getByRole('heading', { name: '我的票据' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'BC/49' })).toBeInTheDocument();
    expect(screen.getByText('bc-49-sim-001')).toBeInTheDocument();
    expect(screen.getByText('待开奖')).toBeInTheDocument();
  });
});

describe('Sprint 3 purchase flows', () => {
  it('issues a computer-generated GRAND NUMBER for Daily Grand', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Daily Grand' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /购买彩票/ }));
    await finishQuickPick(user);
    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));

    expect(screen.getByRole('heading', { name: 'Daily Grand' })).toBeInTheDocument();
    expect(screen.getByTitle('GRAND NUMBER')).toHaveTextContent(/^G[1-7]$/);
    expect(screen.getByText('daily-grand-sim-001')).toBeInTheDocument();
  });

  it('purchases the four selections included in one Lotto Max play for $6', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Lotto Max' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /购买彩票/ }));

    await user.click(screen.getByRole('button', { name: '选择号码' }));
    expect(screen.getAllByRole('button', { name: /Play 1 · Selection [A-D]/ })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /全部自动选号/ }));
    await user.click(screen.getByRole('button', { name: '继续' }));
    await user.click(screen.getByRole('button', { name: '继续' }));
    await user.click(screen.getByRole('button', { name: '确认购买' }));

    expect(screen.getByLabelText(/账户.*994\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));
    expect(screen.getAllByText(/Play 1 · Selection [A-D]/)).toHaveLength(4);
  });

  it('runs the Lotto 6/49 Classic and Gold Ball draws together', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Lotto 6/49' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /购买彩票/ }));
    await finishQuickPick(user);
    await user.click(screen.getByRole('button', { name: '模拟开奖' }));

    expect(screen.getByRole('heading', { name: '奖球开奖完成' })).toBeInTheDocument();
    expect(screen.getByText(/抽中(?: Gold Ball|白球)/)).toBeInTheDocument();
  });
});

describe('Sprint 4 Keno flow', () => {
  it('buys and settles three consecutive Keno draws with reveal controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Keno' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /开始游戏/ }));

    const settings = screen.getByRole('region', { name: 'Keno 玩法设置' });
    await user.click(within(settings).getByRole('button', { name: '10' }));
    await user.click(within(settings).getByRole('button', { name: '$2.00' }));
    await user.click(within(settings).getByRole('spinbutton', { name: /连续期数/ }));
    await user.keyboard('{Control>}a{/Control}3');
    await finishQuickPick(user);

    expect(screen.getByLabelText(/账户.*994\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '模拟开奖' }));
    expect(screen.getByRole('button', { name: '跳过动画' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '跳过动画' }));
    expect(within(screen.getByLabelText('开奖号码')).getAllByText(/^\d+$/)).toHaveLength(20);

    await user.click(screen.getByRole('button', { name: '开始下一期' }));
    await user.click(screen.getByRole('button', { name: '模拟开奖' }));
    await user.click(screen.getByRole('button', { name: '跳过动画' }));
    await user.click(screen.getByRole('button', { name: '开始下一期' }));
    await user.click(screen.getByRole('button', { name: '模拟开奖' }));
    await user.click(screen.getByRole('button', { name: '跳过动画' }));
    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));
    expect(screen.getByText('已结算')).toBeInTheDocument();
    expect(screen.getByText(/已结算 3 \/ 3 期/)).toBeInTheDocument();
  });
});

describe('Sprint 5 add-on flows', () => {
  it('adds EXTRA to a BC/49 ticket and exposes the supplementary draw audit', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'BC/49' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /购买彩票/ }));
    await user.click(screen.getByRole('button', { name: 'Quick Pick' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'EXTRA 数量' }), '1');
    await user.click(screen.getByRole('button', { name: '继续' }));
    await user.click(screen.getByRole('button', { name: '确认购买' }));

    expect(screen.getByLabelText(/账户.*998\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '模拟开奖' }));
    expect(screen.getByRole('heading', { name: '附加开奖审计' })).toBeInTheDocument();
    expect(screen.getByText(/EXTRA 开奖：/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));
    expect(screen.getByText('EXTRA × 1')).toBeInTheDocument();
    expect(screen.getByText('EXTRA 号码')).toBeInTheDocument();
  });

  it('expands BC/49 Combo 7 into seven paid selections', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'BC/49' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /购买彩票/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Combo Play' }), '7');
    await finishQuickPick(user);

    expect(screen.getByLabelText(/账户.*993\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));
    expect(screen.getByText('Combo 7')).toBeInTheDocument();
    expect(screen.getAllByText(/^Play [1-7]$/)).toHaveLength(7);
  });

  it('doubles the Keno ticket cost and reveals the Keno Bonus multiplier', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Keno' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /开始游戏/ }));
    await user.click(screen.getByRole('button', { name: 'Quick Pick' }));
    await user.click(screen.getByRole('checkbox', { name: /Keno Bonus/ }));
    await user.click(screen.getByRole('button', { name: '继续' }));
    await user.click(screen.getByRole('button', { name: '确认购买' }));

    expect(screen.getByLabelText(/账户.*998\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '模拟开奖' }));
    expect(screen.getByText(/Keno Bonus：×/)).toBeInTheDocument();
  });

  it('purchases Keno Pattern Play as a fixed $2 twenty-number selection', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Keno' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /开始游戏/ }));
    const settings = screen.getByRole('region', { name: 'Keno 玩法设置' });
    await user.click(within(settings).getByRole('checkbox', { name: /Pattern Play/ }));
    await finishQuickPick(user);

    expect(screen.getByLabelText(/账户.*998\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /我的票据 1/ }));
    expect(screen.getByText('Pattern Play')).toBeInTheDocument();
  });
});
