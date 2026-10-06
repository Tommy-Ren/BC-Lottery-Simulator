import { getLotteryDefinition } from '../../data/definitions/lotteries';
import type { Ticket } from '../../domain/lottery/tickets';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateTime, formatMoney } from '../formatters';

interface TicketsPageProps {
  readonly tickets: readonly Ticket[];
  readonly onBack: () => void;
}

export function TicketsPage({ tickets, onBack }: TicketsPageProps) {
  const { language } = useI18n();
  const fr = language === 'fr';
  return (
    <main className="page-shell tickets-page">
      <button className="text-button" type="button" onClick={onBack}>
        ← {fr ? 'Retour à la loterie' : 'Back to Lottery'}
      </button>
      <header className="page-heading">
        <p className="eyebrow">AUDITABLE TICKETS</p>
        <h1 className="play-title">{fr ? 'Mes billets' : 'My Tickets'}</h1>
        <p>
          {fr
            ? 'Les achats, numéros de tirage et résultats sont conservés dans un relevé local immuable.'
            : 'Purchases, draw IDs and results are kept together in an immutable local ticket record.'}
        </p>
      </header>

      {tickets.length === 0 ? (
        <section className="empty-state">
          <strong>{fr ? 'Aucun billet pour le moment' : 'No tickets yet'}</strong>
          <p>
            {fr
              ? 'Choisissez une loterie et effectuez un achat virtuel pour commencer.'
              : 'Choose a lottery and complete a virtual purchase to get started.'}
          </p>
          <button className="primary-button" type="button" onClick={onBack}>
            {fr ? 'Choisir une loterie' : 'Choose a Lottery'}
          </button>
        </section>
      ) : (
        <div className="ticket-list">
          {[...tickets].reverse().map((ticket) => {
            const definition = getLotteryDefinition(ticket.lotteryId);
            const totalCashPrizeCents = ticket.settlements.reduce(
              (total, settlement) => total + settlement.cashPrizeCents,
              0,
            );
            const totalGoldBallPrizeCents = ticket.settlements.reduce(
              (total, settlement) => total + settlement.goldBallPrizeCents,
              0,
            );
            const totalFreePlays = ticket.settlements.reduce(
              (total, settlement) => total + settlement.freePlayCount,
              0,
            );
            const totalUnresolved = ticket.settlements.reduce(
              (total, settlement) => total + settlement.unresolvedPoolShareTierIds.length,
              0,
            );
            return (
              <article className="ticket-card" key={ticket.id}>
                <header className="ticket-card__header">
                  <div>
                    <span className={`ticket-status ticket-status--${ticket.status}`}>
                      {ticket.status === 'settled'
                        ? fr
                          ? 'Réglé'
                          : 'Settled'
                        : ticket.status === 'partially-settled'
                          ? fr
                            ? 'Partiellement réglé'
                            : 'Partially settled'
                          : fr
                            ? 'En attente du tirage'
                            : 'Pending'}
                    </span>
                    <h2>{definition.displayName}</h2>
                    <p>{ticket.drawId}</p>
                    {ticket.drawCount > 1 && (
                      <p>
                        {fr ? 'Réglé' : 'Settled'} {ticket.settlements.length} / {ticket.drawCount}{' '}
                        {fr ? 'tirages' : 'draws'}
                      </p>
                    )}
                  </div>
                  <div className="ticket-cost">
                    <span>{fr ? 'Coût du billet' : 'Ticket cost'}</span>
                    <strong>{formatMoney(ticket.costCents)}</strong>
                  </div>
                </header>

                <div className="ticket-selections">
                  {ticket.selections.map((selection, index) => {
                    const evaluation = ticket.settlement?.evaluations[index];
                    const playNumber = Math.floor(index / definition.play.selectionsPerPlay) + 1;
                    const selectionLetter = String.fromCharCode(
                      65 + (index % definition.play.selectionsPerPlay),
                    );
                    return (
                      <div className="ticket-selection" key={`${ticket.id}-${index}`}>
                        <span>
                          Play {playNumber}
                          {definition.play.selectionsPerPlay > 1
                            ? ` · Selection ${selectionLetter}`
                            : ''}
                        </span>
                        <div className="ticket-numbers">
                          {selection.mainNumbers.map((number) => (
                            <strong
                              className={
                                ticket.settlement?.draw.mainNumbers.includes(number)
                                  ? 'ticket-number--hit'
                                  : ''
                              }
                              key={number}
                            >
                              {number}
                            </strong>
                          ))}
                          {selection.specialNumber !== undefined && (
                            <strong className="ticket-number--special" title="GRAND NUMBER">
                              G{selection.specialNumber}
                            </strong>
                          )}
                        </div>
                        {evaluation && (
                          <p>
                            {fr ? 'Dernier tirage : ' : 'Latest draw matched'}{' '}
                            {evaluation.mainMatches} {fr ? 'numéros principaux' : 'main numbers'}
                            {evaluation.bonusMatched ? ' + Bonus' : ''} ·{' '}
                            {evaluation.tier?.label ?? (fr ? 'Aucun prix' : 'No prize')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {ticket.goldBallDrawNumbers.length > 0 && (
                  <div className="gold-ball-number">
                    <span>Gold Ball Draw Number</span>
                    <strong>{ticket.goldBallDrawNumbers.join(', ')}</strong>
                  </div>
                )}

                {(ticket.addOns.extraPlayCount > 0 ||
                  ticket.addOns.kenoBonus ||
                  ticket.addOns.kenoPatternPlay ||
                  ticket.addOns.comboPickCount !== undefined) && (
                  <div className="ticket-features">
                    {ticket.addOns.extraPlayCount > 0 && (
                      <span>EXTRA × {ticket.addOns.extraPlayCount}</span>
                    )}
                    {ticket.addOns.comboPickCount !== undefined && (
                      <span>Combo {ticket.addOns.comboPickCount}</span>
                    )}
                    {ticket.addOns.kenoBonus && <span>Keno Bonus</span>}
                    {ticket.addOns.kenoPatternPlay && <span>Pattern Play</span>}
                  </div>
                )}

                {ticket.addOns.extraPlayCount > 0 && (
                  <div className="extra-numbers">
                    <span>{fr ? 'Numéros EXTRA' : 'EXTRA numbers'}</span>
                    {(
                      ticket.extraSelectionsByDraw[ticket.settlement?.drawId ?? ticket.drawId] ?? []
                    )
                      .map((numbers) => numbers.join('-'))
                      .join(' · ')}
                  </div>
                )}

                {ticket.settlement?.goldBall && (
                  <div className="gold-ball-settlement">
                    <span>
                      Gold Ball draw number {ticket.settlement.goldBall.result.winningDrawNumber}
                    </span>
                    <strong>
                      {ticket.settlement.goldBall.matchedDrawNumber
                        ? `${fr ? 'Correspondance' : 'Matched'} · ${formatMoney(ticket.settlement.goldBall.prizeCents)}`
                        : fr
                          ? 'Aucune correspondance'
                          : 'No match'}
                    </strong>
                    <small>
                      {ticket.settlement.goldBall.result.prizeBall === 'gold'
                        ? 'Gold Ball Jackpot'
                        : fr
                          ? 'Boule blanche de 1 M$'
                          : '$1M white ball'}
                    </small>
                  </div>
                )}

                {ticket.settlement && (
                  <div className="ticket-result">
                    <div>
                      <span>{fr ? 'Total des gains en argent' : 'Total cash prize'}</span>
                      <strong>{formatMoney(totalCashPrizeCents)}</strong>
                    </div>
                    <div>
                      <span>Free Play</span>
                      <strong>{totalFreePlays}</strong>
                    </div>
                    <div>
                      <span>{fr ? 'Prix Gold Ball' : 'Gold Ball prize'}</span>
                      <strong>{formatMoney(totalGoldBallPrizeCents)}</strong>
                    </div>
                    <div>
                      <span>{fr ? 'Niveaux de cagnotte à régler' : 'Pool tiers unresolved'}</span>
                      <strong>{totalUnresolved}</strong>
                    </div>
                  </div>
                )}

                {ticket.settlement?.supplementaryDraw && (
                  <div className="settlement-audit">
                    <span>
                      {fr ? 'Ventes nationales simulées' : 'Simulated national sales'}{' '}
                      {formatMoney(
                        ticket.settlement.supplementaryDraw.nationalPool
                          .simulatedNationalSalesCents,
                      )}
                    </span>
                    <span>
                      {fr ? 'Part de cagnotte' : 'Pool allocation'}{' '}
                      {formatMoney(ticket.settlement.poolPrizeCents)}
                    </span>
                    <span>EXTRA {formatMoney(ticket.settlement.extraPrizeCents)}</span>
                    <span>
                      MAX {fr ? 'série' : 'series'}{' '}
                      {formatMoney(ticket.settlement.maxSeriesPrizeCents)}
                    </span>
                    <span>Pattern {formatMoney(ticket.settlement.patternPrizeCents)}</span>
                    {ticket.settlement.kenoBonusMultiplier !== undefined && (
                      <span>Keno Bonus ×{ticket.settlement.kenoBonusMultiplier}</span>
                    )}
                  </div>
                )}

                {ticket.settlements.length > 0 && (
                  <details className="draw-history">
                    <summary>
                      {fr ? 'Historique des tirages' : 'Draw-by-draw history'} (
                      {ticket.settlements.length})
                    </summary>
                    <div className="draw-history__list">
                      {ticket.settlements.map((settlement) => (
                        <article key={settlement.drawId}>
                          <div>
                            <strong>{settlement.drawId}</strong>
                            <span>{formatDateTime(settlement.settledAt)}</span>
                          </div>
                          <div
                            className="ticket-numbers"
                            aria-label={`${settlement.drawId} ${fr ? 'numéros gagnants' : 'winning numbers'}`}
                          >
                            {settlement.draw.mainNumbers.map((number) => (
                              <strong key={number}>{number}</strong>
                            ))}
                          </div>
                          <p>
                            {fr ? 'Argent' : 'Cash'} {formatMoney(settlement.cashPrizeCents)} · Gold
                            Ball {formatMoney(settlement.goldBallPrizeCents)} · Free Play{' '}
                            {settlement.freePlayCount}
                          </p>
                        </article>
                      ))}
                    </div>
                  </details>
                )}

                <footer className="ticket-card__footer">
                  <span>{formatDateTime(ticket.purchasedAt)}</span>
                  <span>
                    {fr ? 'Règles' : 'Rules'} {ticket.rulesVersion}
                  </span>
                  <span>
                    {formatMoney(ticket.wagerCents)} × {ticket.drawCount} {fr ? 'tirages' : 'draws'}
                  </span>
                  <span>
                    {fr ? 'Transaction' : 'Transaction'} {ticket.walletTransactionId}
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
