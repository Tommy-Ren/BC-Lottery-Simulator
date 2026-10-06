export type DrawStatus = 'scheduled' | 'result-generated' | 'revealed' | 'settled';
export type TicketStatus = 'draft' | 'purchased' | 'settled';

const drawTransitions: Readonly<Record<DrawStatus, readonly DrawStatus[]>> = {
  scheduled: ['result-generated'],
  'result-generated': ['revealed'],
  revealed: ['settled'],
  settled: [],
};

const ticketTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  draft: ['purchased'],
  purchased: ['settled'],
  settled: [],
};

function transition<TStatus extends string>(
  current: TStatus,
  next: TStatus,
  transitions: Readonly<Record<TStatus, readonly TStatus[]>>,
): TStatus {
  if (current === next) return current;
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid state transition: ${current} -> ${next}.`);
  }
  return next;
}

export function transitionDraw(current: DrawStatus, next: DrawStatus): DrawStatus {
  return transition(current, next, drawTransitions);
}

export function transitionTicket(current: TicketStatus, next: TicketStatus): TicketStatus {
  return transition(current, next, ticketTransitions);
}
