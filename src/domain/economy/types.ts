export type WalletTransactionType = 'initial-balance' | 'ticket-purchase' | 'prize' | 'grant';

export interface WalletTransaction {
  readonly id: string;
  readonly type: WalletTransactionType;
  readonly amountCents: number;
  readonly balanceBeforeCents: number;
  readonly balanceAfterCents: number;
  readonly occurredAt: string;
  readonly referenceId?: string;
}

export interface WalletState {
  readonly balanceCents: number;
  readonly transactions: readonly WalletTransaction[];
}

export interface WalletCommand {
  readonly id: string;
  readonly type: WalletTransactionType;
  readonly amountCents: number;
  readonly occurredAt: string;
  readonly referenceId?: string;
}
