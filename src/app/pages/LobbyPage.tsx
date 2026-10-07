import { useEffect, useState } from 'react';
import { lotteryDefinitions } from '../../data/definitions/lotteries';
import { drawsForGame, type HistoricalGameId } from '../../data/history/historicalDraws';
import { refreshLatestHistoricalDraws } from '../../data/history/refreshLatestDraws';
import type { PlayableLotteryId } from '../../domain/lottery/tickets';
import { localizeGame, useI18n } from '../../i18n/I18nContext';
import { formatMoney } from '../formatters';

interface LobbyPageProps {
  readonly onPlay: (lotteryId: PlayableLotteryId) => void;
  readonly onRules: (lotteryId: PlayableLotteryId) => void;
}

const historicalIds = new Set<HistoricalGameId>(['lotto-max', 'lotto-649', 'bc-49', 'daily-grand']);

export function LobbyPage({ onPlay, onRules }: LobbyPageProps) {
  const { language } = useI18n();
  const fr = language === 'fr';
  const featured = lotteryDefinitions.filter(
    (definition) => definition.id === 'lotto-max' || definition.id === 'lotto-649',
  );
  const [, setHistoryRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void refreshLatestHistoricalDraws()
      .then(() => {
        if (active) setHistoryRevision((revision) => revision + 1);
      })
      .catch(() => {
        // Keep the bundled and previously cached results visible if the official feed is offline.
      });
    return () => {
      active = false;
    };
  }, []);

  const formatDrawDate = (date: string) =>
    new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));

  return (
    <main className="lottery-home">
      <section
        className="jackpot-hero"
        aria-label={fr ? 'Gros lots simulés' : 'Simulated jackpots'}
      >
        {featured.map((definition) =>
          definition.id === 'lotto-max' ? (
            <article className="jackpot-panel jackpot-panel--lotto-max" key={definition.id}>
              <img
                className="jackpot-panel__logo jackpot-panel__logo--max"
                src="/icon/lmax-2.0-logo-small.png"
                alt="Lotto Max"
              />
              <div className="jackpot-panel__headline">
                <small>$</small>
                <strong>65 Million</strong>
                <em>EST.</em>
              </div>
              <div className="jackpot-panel__offer">
                <img src="/icon/circle-plus-white.svg" alt="" />
                <strong>8 × MAXMILLIONS</strong>
                <em>EST.</em>
              </div>
              <div className="jackpot-panel__offer jackpot-panel__offer--new">
                <span aria-hidden="true">＋</span>
                <strong>65 × $100,000</strong>
                <img
                  className="jackpot-panel__new"
                  src="/icon/new-bubble-left.svg"
                  alt={fr ? 'Nouveau' : 'New'}
                />
              </div>
              <span className="visually-hidden">
                {fr
                  ? 'Gros lot simulé; tous les montants sont virtuels'
                  : 'Simulated jackpot; all amounts are virtual funds'}
              </span>
            </article>
          ) : (
            <article className="jackpot-panel jackpot-panel--lotto-649" key={definition.id}>
              <img
                className="jackpot-panel__logo jackpot-panel__logo--649"
                src="/icon/logo-lotto-649.svg"
                alt="Lotto 6/49"
              />
              <img
                className="jackpot-panel__goldball"
                src="/icon/649-goldball-logo.svg"
                alt="Gold Ball"
              />
              <div className="jackpot-panel__headline jackpot-panel__headline--649">
                <small>$</small>
                <strong>14 Million</strong>
              </div>
              <div className="jackpot-panel__qualifier">
                {fr ? 'OU 1 MILLION $ GARANTI' : 'OR GUARANTEED $1 MILLION'}
              </div>
              <div className="jackpot-panel__offer jackpot-panel__offer--classic">
                <img src="/icon/circle-plus-white.svg" alt="" />
                <strong>CLASSIC $5 MILLION</strong>
              </div>
              <span className="visually-hidden">
                {fr
                  ? 'Gros lot simulé; tous les montants sont virtuels'
                  : 'Simulated jackpot; all amounts are virtual funds'}
              </span>
            </article>
          ),
        )}
      </section>

      <section className="home-games" aria-labelledby="games-title">
        <div className="home-section-heading">
          <h1 id="games-title">{fr ? 'Jouer à la loterie' : 'Play Lottery'}</h1>
          <p>
            {fr
              ? 'Choisissez un jeu, vos numéros et les options, puis simulez le tirage.'
              : 'Choose a game, numbers and add-ons, then simulate the draw instantly.'}
          </p>
        </div>
        <div className="home-game-grid">
          {lotteryDefinitions.map((definition) => (
            <article
              className={`home-game-card home-game-card--${definition.id}`}
              key={definition.id}
            >
              <div className={`lottery-logo lottery-logo--${definition.id}`} aria-hidden="true" />
              <h2>{localizeGame(definition.id, language).name}</h2>
              <p>{localizeGame(definition.id, language).description}</p>
              <strong>
                {formatMoney(definition.play.basePriceCents)} {fr ? 'par jeu' : 'per Play'}
              </strong>
              <div>
                <button className="rule-link" onClick={() => onRules(definition.id)} type="button">
                  {fr ? 'Règles' : 'Rules'}
                </button>
                <button className="buy-link" onClick={() => onPlay(definition.id)} type="button">
                  {definition.id === 'keno'
                    ? fr
                      ? 'Jouer'
                      : 'Play Game'
                    : fr
                      ? 'Acheter des billets'
                      : 'Buy Tickets'}{' '}
                  →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="subscription-banner">
        <div>
          <img
            className="subscription-banner__logo"
            src="/icon/subscriptions-logo.png"
            alt={fr ? 'Ne manquez aucun tirage' : 'Never miss a draw'}
          />
          <p>
            {fr
              ? 'Votre historique de billets et votre solde sont automatiquement sauvegardés dans ce navigateur.'
              : 'Your local ticket history and balance are automatically saved in this browser.'}
          </p>
        </div>
      </section>

      <section className="latest-winners" aria-labelledby="latest-title">
        <div className="home-section-heading home-section-heading--row">
          <h2 id="latest-title">{fr ? 'Numéros gagnants' : 'Winning Numbers'}</h2>
          <a
            href="https://www.playnow.com/lottery/winning-numbers/"
            rel="noreferrer"
            target="_blank"
          >
            {fr
              ? 'Voir les numéros gagnants officiels en direct'
              : 'See live official winning numbers'}{' '}
            →
          </a>
        </div>
        <div className="latest-winner-grid">
          {lotteryDefinitions
            .filter((definition) => historicalIds.has(definition.id as HistoricalGameId))
            .map((definition) => {
              const draw = drawsForGame(definition.id as HistoricalGameId)[0];
              if (!draw) return null;
              return (
                <article
                  className={`latest-card latest-card--${definition.id}`}
                  key={definition.id}
                >
                  <div className="latest-card__brand">
                    <span
                      className={`latest-card__logo lottery-logo--${definition.id}`}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="latest-card__date">
                    {definition.id === 'lotto-max'
                      ? `${fr ? 'Résultats Lotto Max' : 'Lotto Max Results'}: ${formatDrawDate(draw.drawDate)}`
                      : definition.id === 'lotto-649'
                        ? `${fr ? 'Résultats Lotto 6/49' : 'Lotto 6/49 Results'}: ${formatDrawDate(draw.drawDate)}`
                        : definition.id === 'daily-grand'
                          ? `${fr ? 'Date du tirage' : 'Draw Date'}: ${formatDrawDate(draw.drawDate)}`
                          : `${fr ? 'Résultats du tirage' : 'Draw Results'}: ${formatDrawDate(draw.drawDate)}`}
                    {' · '}#{draw.drawNumber}
                  </span>
                  {definition.id === 'lotto-649' && (
                    <strong className="latest-card__classic">CLASSIC</strong>
                  )}
                  <div className="latest-card__numbers">
                    {draw.mainNumbers.map((number) => (
                      <strong key={number}>{number.toString().padStart(2, '0')}</strong>
                    ))}
                  </div>
                  {draw.bonusNumber !== undefined && (
                    <p className="latest-card__bonus">
                      {definition.id === 'daily-grand'
                        ? fr
                          ? 'NUMÉRO GRAND'
                          : 'GRAND NUMBER'
                        : 'BONUS'}{' '}
                      {draw.bonusNumber.toString().padStart(2, '0')}
                    </p>
                  )}
                  {draw.goldBall && (
                    <div className="latest-card__gold-ball">
                      <img src="/icon/649-goldball-logo-blue.svg" alt="Gold Ball" />
                      <span>
                        <img src="/icon/whiteball.svg" alt="" />
                        <strong>
                          ${draw.goldBall.whiteBallPrizeDollars.toLocaleString(language)}
                        </strong>
                        <i aria-hidden="true" />
                        <b>{draw.goldBall.number}</b>
                      </span>
                    </div>
                  )}
                  {draw.extraNumbers.length > 0 && (
                    <div
                      className="latest-card__extra"
                      aria-label={fr ? 'Numéros Extra' : 'Extra numbers'}
                    >
                      <span className="extra-logo" aria-label="Extra" />
                      <div>
                        {draw.extraNumbers.map((number) => (
                          <span key={number}>{number.toString().padStart(2, '0')}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {definition.id === 'lotto-max' &&
                    (draw.maxmillionsDraws?.length || draw.maxplusDraws?.length) && (
                      <div className="latest-card__supplementary">
                        {draw.maxmillionsDraws && draw.maxmillionsDraws.length > 0 && (
                          <details>
                            <summary>
                              <span>✚</span> MAXMILLIONS
                              <u>
                                {draw.maxmillionsDraws.length} {fr ? 'tirages' : 'Results'}
                              </u>
                            </summary>
                            <div className="latest-card__supplementary-list">
                              {draw.maxmillionsDraws.map((numbers, index) => (
                                <p key={`maxmillions-${index}`}>
                                  <small>{index + 1}</small>
                                  {numbers.map((number) => (
                                    <b key={number}>{number.toString().padStart(2, '0')}</b>
                                  ))}
                                </p>
                              ))}
                            </div>
                          </details>
                        )}
                        {draw.maxplusDraws && draw.maxplusDraws.length > 0 && (
                          <details>
                            <summary>
                              <span>✚</span> $100,000 MAXPLUS
                              <u>
                                {draw.maxplusDraws.length} {fr ? 'tirages' : 'Results'}
                              </u>
                            </summary>
                            <div className="latest-card__supplementary-list">
                              {draw.maxplusDraws.map((numbers, index) => (
                                <p key={`maxplus-${index}`}>
                                  <small>{index + 1}</small>
                                  {numbers.map((number) => (
                                    <b key={number}>{number.toString().padStart(2, '0')}</b>
                                  ))}
                                </p>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  <button onClick={() => onPlay(definition.id)} type="button">
                    {fr ? 'Acheter des billets' : 'Buy Tickets'}
                  </button>
                </article>
              );
            })}
          <article className="latest-card latest-card--keno latest-card--keno-promo">
            <div className="latest-card__brand">
              <span className="latest-card__logo lottery-logo--keno" aria-hidden="true" />
            </div>
            <span className="latest-card__date">
              {fr ? 'Keno · Tirages toutes les 3 min 30 s' : 'Keno · Draws every 3 min 30 sec'}
            </span>
            <div className="latest-card__keno-copy">
              <strong>{fr ? '20 numéros tirés' : '20 numbers drawn'}</strong>
              <span>{fr ? 'Parmi les numéros 1 à 80' : 'From numbers 1 to 80'}</span>
            </div>
            <button onClick={() => onPlay('keno')} type="button">
              {fr ? 'Jouer à Keno' : 'Play Keno'}
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
