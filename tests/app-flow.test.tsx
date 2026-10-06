// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

afterEach(cleanup);

async function finishQuickPick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Quick Pick' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Confirm Purchase' }));
}

describe('BC/49 purchase flow', () => {
  it('quick-picks, purchases and shows an auditable ticket', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameHeading = screen.getByRole('heading', { name: 'BC/49' });
    const gameCard = gameHeading.closest('article');
    expect(gameCard).not.toBeNull();
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Buy Tickets/ }));

    await finishQuickPick(user);

    expect(screen.getByRole('button', { name: /My Tickets 1/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Account.*999\.00/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));
    expect(screen.getByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'BC/49' })).toBeInTheDocument();
    expect(screen.getByText('bc-49-sim-001')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('Sprint 3 purchase flows', () => {
  it('issues a computer-generated GRAND NUMBER for Daily Grand', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Daily Grand' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Buy Tickets/ }));
    await finishQuickPick(user);
    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));

    expect(screen.getByRole('heading', { name: 'Daily Grand' })).toBeInTheDocument();
    expect(screen.getByTitle('GRAND NUMBER')).toHaveTextContent(/^G[1-7]$/);
    expect(screen.getByText('daily-grand-sim-001')).toBeInTheDocument();
  });

  it('purchases the four selections included in one Lotto Max play for $6', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Lotto Max' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Buy Tickets/ }));

    await user.click(screen.getByRole('button', { name: 'Choose Numbers' }));
    expect(screen.getAllByRole('button', { name: /Play 1 · Selection [A-D]/ })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /Auto Pick All Numbers/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Purchase' }));

    expect(screen.getByLabelText(/Account.*994\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));
    expect(screen.getAllByText(/Play 1 · Selection [A-D]/)).toHaveLength(4);
  });

  it('runs the Lotto 6/49 Classic and Gold Ball draws together', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Lotto 6/49' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Buy Tickets/ }));
    await finishQuickPick(user);
    await user.click(screen.getByRole('button', { name: 'Simulate Draw' }));

    expect(screen.getByRole('heading', { name: 'Gold Ball draw complete' })).toBeInTheDocument();
    expect(screen.getByText(/Drawn:.*(?:Gold Ball|White Ball)/)).toBeInTheDocument();
  });
});

describe('Sprint 4 Keno flow', () => {
  it('buys and settles three consecutive Keno draws with reveal controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Keno' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Play Game/ }));

    const settings = screen.getByRole('region', { name: 'Keno play settings' });
    await user.click(within(settings).getByRole('button', { name: '10' }));
    await user.click(within(settings).getByRole('button', { name: '$2.00' }));
    await user.click(within(settings).getByRole('spinbutton', { name: /Number of draws/ }));
    await user.keyboard('{Control>}a{/Control}3');
    await finishQuickPick(user);

    expect(screen.getByLabelText(/Account.*994\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simulate Draw' }));
    expect(screen.getByRole('button', { name: 'Skip animation' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip animation' }));
    expect(within(screen.getByLabelText('Winning numbers')).getAllByText(/^\d+$/)).toHaveLength(20);

    await user.click(screen.getByRole('button', { name: 'Start next draw' }));
    await user.click(screen.getByRole('button', { name: 'Simulate Draw' }));
    await user.click(screen.getByRole('button', { name: 'Skip animation' }));
    await user.click(screen.getByRole('button', { name: 'Start next draw' }));
    await user.click(screen.getByRole('button', { name: 'Simulate Draw' }));
    await user.click(screen.getByRole('button', { name: 'Skip animation' }));
    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));
    expect(screen.getByText('Settled')).toBeInTheDocument();
    expect(screen.getByText(/Settled 3 \/ 3 draws/)).toBeInTheDocument();
  });
});

describe('Sprint 5 add-on flows', () => {
  it('adds EXTRA to a BC/49 ticket and exposes the supplementary draw audit', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'BC/49' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Buy Tickets/ }));
    await user.click(screen.getByRole('button', { name: 'Quick Pick' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'EXTRA quantity' }), '1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Purchase' }));

    expect(screen.getByLabelText(/Account.*998\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simulate Draw' }));
    expect(screen.getByRole('heading', { name: 'Add-on draw audit' })).toBeInTheDocument();
    expect(screen.getByText(/EXTRA draw:/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));
    expect(screen.getByText('EXTRA × 1')).toBeInTheDocument();
    expect(screen.getByText('EXTRA numbers')).toBeInTheDocument();
  });

  it('expands BC/49 Combo 7 into seven paid selections', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'BC/49' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Buy Tickets/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Combo Play' }), '7');
    await finishQuickPick(user);

    expect(screen.getByLabelText(/Account.*993\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));
    expect(screen.getByText('Combo 7')).toBeInTheDocument();
    expect(screen.getAllByText(/^Play [1-7]$/)).toHaveLength(7);
  });

  it('doubles the Keno ticket cost and reveals the Keno Bonus multiplier', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Keno' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Play Game/ }));
    await user.click(screen.getByRole('button', { name: 'Quick Pick' }));
    await user.click(screen.getByRole('checkbox', { name: /Keno Bonus/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Purchase' }));

    expect(screen.getByLabelText(/Account.*998\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simulate Draw' }));
    expect(screen.getByText(/Keno Bonus: ×/)).toBeInTheDocument();
  });

  it('purchases Keno Pattern Play as a fixed $2 twenty-number selection', async () => {
    const user = userEvent.setup();
    render(<App />);

    const gameCard = screen.getByRole('heading', { name: 'Keno' }).closest('article');
    await user.click(within(gameCard as HTMLElement).getByRole('button', { name: /Play Game/ }));
    const settings = screen.getByRole('region', { name: 'Keno play settings' });
    await user.click(within(settings).getByRole('checkbox', { name: /Pattern Play/ }));
    await finishQuickPick(user);

    expect(screen.getByLabelText(/Account.*998\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /My Tickets 1/ }));
    expect(screen.getByText('Pattern Play')).toBeInTheDocument();
  });
});
