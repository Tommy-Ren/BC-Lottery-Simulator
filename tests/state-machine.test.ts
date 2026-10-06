import { describe, expect, it } from 'vitest';
import { transitionDraw, transitionTicket } from '../src/domain/lottery/stateMachine';

describe('lottery state machines', () => {
  it('follows the draw lifecycle', () => {
    expect(transitionDraw('scheduled', 'result-generated')).toBe('result-generated');
    expect(transitionDraw('result-generated', 'revealed')).toBe('revealed');
    expect(transitionDraw('revealed', 'settled')).toBe('settled');
  });

  it('does not permit skipping draw states', () => {
    expect(() => transitionDraw('scheduled', 'settled')).toThrow('Invalid state transition');
  });

  it('keeps repeated ticket transitions idempotent', () => {
    expect(transitionTicket('purchased', 'purchased')).toBe('purchased');
  });
});
