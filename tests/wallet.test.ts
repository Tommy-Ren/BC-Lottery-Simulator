import { describe, expect, it } from 'vitest';
import { applyWalletCommand, createWallet } from '../src/domain/economy/wallet';

const timestamp = '2026-09-26T00:00:00.000Z';

describe('wallet ledger', () => {
  it('records an auditable debit', () => {
    const wallet = createWallet(10_000, timestamp);
    const updated = applyWalletCommand(wallet, {
      id: 'purchase-1',
      type: 'ticket-purchase',
      amountCents: -600,
      occurredAt: timestamp,
      referenceId: 'ticket-1',
    });

    expect(updated.balanceCents).toBe(9_400);
    expect(updated.transactions.at(-1)).toMatchObject({
      balanceBeforeCents: 10_000,
      balanceAfterCents: 9_400,
    });
  });

  it('is idempotent for a repeated command id', () => {
    const wallet = createWallet(10_000, timestamp);
    const command = {
      id: 'purchase-1',
      type: 'ticket-purchase' as const,
      amountCents: -600,
      occurredAt: timestamp,
    };
    const once = applyWalletCommand(wallet, command);
    expect(applyWalletCommand(once, command)).toBe(once);
  });

  it('rejects an overdraft', () => {
    const wallet = createWallet(100, timestamp);
    expect(() =>
      applyWalletCommand(wallet, {
        id: 'purchase-1',
        type: 'ticket-purchase',
        amountCents: -300,
        occurredAt: timestamp,
      }),
    ).toThrow('Insufficient');
  });
});
