import type { WalletCommand, WalletState, WalletTransaction } from './types';

export type { WalletState } from './types';

export function createWallet(initialBalanceCents: number, occurredAt: string): WalletState {
  if (!Number.isInteger(initialBalanceCents) || initialBalanceCents < 0) {
    throw new Error('Initial balance must be a non-negative integer number of cents.');
  }

  const initialTransaction: WalletTransaction = {
    id: 'initial-balance',
    type: 'initial-balance',
    amountCents: initialBalanceCents,
    balanceBeforeCents: 0,
    balanceAfterCents: initialBalanceCents,
    occurredAt,
  };

  return { balanceCents: initialBalanceCents, transactions: [initialTransaction] };
}

export function applyWalletCommand(state: WalletState, command: WalletCommand): WalletState {
  if (state.transactions.some((transaction) => transaction.id === command.id)) {
    return state;
  }

  if (!Number.isInteger(command.amountCents) || command.amountCents === 0) {
    throw new Error('Wallet amount must be a non-zero integer number of cents.');
  }

  if (command.type === 'ticket-purchase' && command.amountCents > 0) {
    throw new Error('A ticket purchase must debit the wallet.');
  }

  const nextBalanceCents = state.balanceCents + command.amountCents;
  if (nextBalanceCents < 0) {
    throw new Error('Insufficient wallet balance.');
  }

  const transaction: WalletTransaction = {
    ...command,
    balanceBeforeCents: state.balanceCents,
    balanceAfterCents: nextBalanceCents,
  };

  return {
    balanceCents: nextBalanceCents,
    transactions: [...state.transactions, transaction],
  };
}
