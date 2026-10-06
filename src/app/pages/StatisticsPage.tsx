import { useMemo, useState, type CSSProperties } from 'react';
import {
  drawsForGame,
  analyzeNumberCombinations,
  historicalDrawSnapshot,
  historicalGameConfig,
  numberDistributionStatistics,
  numberFrequencies,
  rankNumberFrequencies,
  type HistoricalGameId,
} from '../../data/history/historicalDraws';
import { useI18n } from '../../i18n/I18nContext';

const gameIds = Object.keys(historicalGameConfig) as HistoricalGameId[];

interface StatisticsPageProps {
  readonly onViewAll: (options: {
    gameId: HistoricalGameId;
    from: string;
    to: string;
    combinationSize: number;
  }) => void;
}

export function StatisticsPage({ onViewAll }: StatisticsPageProps) {
  const { language, locale, t } = useI18n();
  const [gameId, setGameId] = useState<HistoricalGameId>('lotto-max');
  const [kind, setKind] = useState<'main' | 'bonus'>('main');
  const [from, setFrom] = useState(historicalDrawSnapshot.range.from);
  const [to, setTo] = useState(historicalDrawSnapshot.range.to);
  const [combinationSize, setCombinationSize] = useState(2);
  const validRange = Boolean(from && to && from <= to);
  const draws = useMemo(
    () => (validRange ? drawsForGame(gameId, from, to) : []),
    [gameId, from, to, validRange],
  );
  const maximumCombinationSize = draws[0]?.mainNumbers.length ?? 2;
  const selectedCombinationSize = Math.min(combinationSize, maximumCombinationSize);
  const frequencies = useMemo(
    () => numberFrequencies(gameId, kind, from, to),
    [gameId, kind, from, to],
  );
  const numberStats = useMemo(() => numberDistributionStatistics(draws, kind), [draws, kind]);
  const ranking = useMemo(
    () => rankNumberFrequencies(gameId, kind, from, to),
    [gameId, kind, from, to],
  );
  const combinationAnalysis = useMemo(
    () =>
      analyzeNumberCombinations(
        draws,
        selectedCombinationSize,
        historicalGameConfig[gameId].maxNumber,
        10,
      ),
    [draws, selectedCombinationSize, gameId],
  );
  const maximum = Math.max(...frequencies.map((entry) => entry.count), 1);
  const ranked = [...frequencies].sort(
    (left, right) => right.count - left.count || left.number - right.number,
  );
  const formatDate = (value: string) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
      new Date(`${value}T12:00:00`),
    );
  };
  const formatNumber = (value: number | null | undefined, digits = 2) =>
    value === null || value === undefined
      ? '—'
      : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const fr = language === 'fr';

  return (
    <main className="official-page stats-page">
      <header className="page-banner">
        <div>
          <span className="page-banner__eyebrow">PLAYNOW DATA SNAPSHOT</span>
          <h1>{t('statisticsTitle')}</h1>
          <p>{t('statisticsSummary')}</p>
        </div>
      </header>

      <section className="stats-shell" aria-labelledby="stats-game-title">
        <form className="date-range-filter" onSubmit={(event) => event.preventDefault()}>
          <div>
            <strong>{fr ? 'Période personnalisée' : 'Custom date range'}</strong>
            <span>
              {fr
                ? `Les données locales couvrent la période du ${historicalDrawSnapshot.range.from} au ${historicalDrawSnapshot.range.to}`
                : `Local data covers ${historicalDrawSnapshot.range.from} to ${historicalDrawSnapshot.range.to}`}
            </span>
          </div>
          <label>
            {fr ? 'Du' : 'From'}
            <input
              max={historicalDrawSnapshot.range.to}
              min={historicalDrawSnapshot.range.from}
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label>
            {fr ? 'Au' : 'To'}
            <input
              max={historicalDrawSnapshot.range.to}
              min={historicalDrawSnapshot.range.from}
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </label>
          <button
            onClick={() => {
              setFrom(historicalDrawSnapshot.range.from);
              setTo(historicalDrawSnapshot.range.to);
            }}
            type="button"
          >
            {fr ? 'Toute la période' : 'All dates'}
          </button>
          {!validRange && (
            <small role="alert">
              {fr
                ? 'La date de début doit précéder la date de fin.'
                : 'The start date must be before the end date.'}
            </small>
          )}
        </form>
        <div className="game-filter" role="tablist" aria-label={t('statisticsTitle')}>
          {gameIds.map((id) => (
            <button
              aria-selected={gameId === id}
              className={`game-filter__button game-filter__button--${id}`}
              key={id}
              onClick={() => setGameId(id)}
              role="tab"
              style={{ '--game-accent': historicalGameConfig[id].accent } as CSSProperties}
              type="button"
            >
              {historicalGameConfig[id].label}
            </button>
          ))}
        </div>

        <div className="stats-summary-grid">
          <article>
            <span>{t('drawsCount')}</span>
            <strong>{draws.length}</strong>
          </article>
          <article>
            <span>{t('range')}</span>
            <strong>
              {formatDate(from)} – {formatDate(to)}
            </strong>
          </article>
          <article>
            <span>{t('hot')}</span>
            <strong>
              {ranked
                .slice(0, 5)
                .map((item) => item.number.toString().padStart(2, '0'))
                .join(' · ')}
            </strong>
          </article>
          <article>
            <span>{t('cold')}</span>
            <strong>
              {ranked
                .slice(-5)
                .reverse()
                .map((item) => item.number.toString().padStart(2, '0'))
                .join(' · ')}
            </strong>
          </article>
        </div>

        <section className="stats-card analysis-summary" aria-labelledby="analysis-title">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">SUMMARY</p>
              <h2 id="analysis-title">{fr ? 'Résumé statistique' : 'Statistical Summary'}</h2>
            </div>
            <span className="analysis-summary__sample">
              {fr
                ? `${draws.length} tirages · ${kind === 'main' ? 'numéros principaux' : 'numéros bonus'}`
                : `${draws.length} draws · ${kind === 'main' ? 'Main numbers' : 'Bonus numbers'}`}
            </span>
          </div>
          <div className="analysis-metrics">
            <article>
              <span>{fr ? 'Moyenne' : 'Mean'}</span>
              <strong>{formatNumber(numberStats?.mean)}</strong>
            </article>
            <article>
              <span>{fr ? 'Médiane' : 'Median'}</span>
              <strong>{formatNumber(numberStats?.median)}</strong>
            </article>
            <article>
              <span>{fr ? 'Écart-type' : 'Std. deviation'}</span>
              <strong>{formatNumber(numberStats?.standardDeviation)}</strong>
            </article>
            <article>
              <span>{fr ? 'Variance' : 'Variance'}</span>
              <strong>{formatNumber(numberStats?.variance)}</strong>
            </article>
            <article>
              <span>{fr ? 'Somme moyenne par tirage' : 'Average sum per draw'}</span>
              <strong>{formatNumber(numberStats?.averageSumPerDraw)}</strong>
            </article>
            <article>
              <span>{fr ? 'Étendue moyenne (max − min)' : 'Average span (max − min)'}</span>
              <strong>{formatNumber(numberStats?.averageSpanPerDraw)}</strong>
            </article>
            <article>
              <span>
                {fr ? 'Écart moyen entre numéros consécutifs' : 'Mean adjacent number gap'}
              </span>
              <strong>
                {kind === 'main' ? formatNumber(numberStats?.averageAdjacentGap) : '—'}
              </strong>
            </article>
            <article>
              <span>{fr ? 'Occurrences paires / impaires' : 'Even / odd appearances'}</span>
              <strong>
                {numberStats ? `${numberStats.evenCount} / ${numberStats.oddCount}` : '—'}
              </strong>
            </article>
            <article>
              <span>{fr ? 'Numéro minimum / maximum' : 'Minimum / maximum'}</span>
              <strong>
                {numberStats
                  ? `${numberStats.minimum.toString().padStart(2, '0')} / ${numberStats.maximum.toString().padStart(2, '0')}`
                  : '—'}
              </strong>
            </article>
          </div>
          <p className="analysis-method-note">
            {fr
              ? 'Les écarts correspondent aux différences entre numéros voisins après tri dans chaque tirage. Ces statistiques décrivent la période sélectionnée et ne prédisent pas l’avenir.'
              : 'Adjacent gaps are differences between sorted neighboring numbers within each draw. Historical statistics describe this range and do not predict future draws.'}
          </p>
        </section>

        <section className="stats-card combination-analysis" aria-labelledby="combination-title">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">CO-OCCURRENCE</p>
              <h2 id="combination-title">
                {fr ? 'Combinaisons tirées ensemble' : 'Combinations Drawn Together'}
              </h2>
            </div>
            <label className="combination-size">
              <span>{fr ? 'Numéros par combinaison' : 'Numbers per combination'}</span>
              <select
                aria-label={fr ? 'Numéros par combinaison' : 'Numbers per combination'}
                disabled={kind === 'bonus' || draws.length === 0}
                onChange={(event) => setCombinationSize(Number(event.target.value))}
                value={selectedCombinationSize}
              >
                {Array.from(
                  { length: Math.max(0, maximumCombinationSize - 1) },
                  (_, index) => index + 2,
                ).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="analysis-method-note combination-explainer">
            {fr
              ? 'Chaque ligne indique le nombre de tirages où tous les numéros de la combinaison figurent parmi les numéros principaux; les fréquences individuelles ne sont pas additionnées.'
              : 'Each row counts draws where every number in that exact set appeared among the main numbers. It does not add the individual frequencies of the numbers.'}
          </p>
          {kind === 'main' && draws.length > 0 && (
            <div
              className="combination-summary"
              aria-label={fr ? 'Résumé des combinaisons' : 'Combination totals'}
            >
              <article>
                <span>
                  {fr ? 'Occurrences totales des combinaisons' : 'Total combination occurrences'}
                </span>
                <strong>{combinationAnalysis.totalOccurrences.toLocaleString(locale)}</strong>
              </article>
              <article>
                <span>{fr ? 'Combinaisons distinctes' : 'Distinct combinations'}</span>
                <strong>{combinationAnalysis.uniqueCombinations.toLocaleString(locale)}</strong>
              </article>
              <article>
                <span>{fr ? 'Combinaisons répétées' : 'Combinations repeated'}</span>
                <strong>{combinationAnalysis.repeatedCombinations.toLocaleString(locale)}</strong>
              </article>
              <article>
                <span>
                  {fr
                    ? 'Occurrences répétées (après la première)'
                    : 'Repeat occurrences after first'}
                </span>
                <strong>{combinationAnalysis.repeatedOccurrences.toLocaleString(locale)}</strong>
              </article>
              <article>
                <span>{fr ? 'Fréquence maximale conjointe' : 'Highest co-occurrence count'}</span>
                <strong>{combinationAnalysis.maximumFrequency.toLocaleString(locale)}</strong>
              </article>
              <article>
                <span>{fr ? 'Combinaisons possibles' : 'Possible combinations'}</span>
                <strong>{combinationAnalysis.possibleCombinations.toLocaleString(locale)}</strong>
              </article>
            </div>
          )}
          {kind === 'bonus' ? (
            <p className="analysis-empty">
              {fr
                ? 'Un tirage ne comporte qu’un seul numéro bonus; les combinaisons par tirage ne s’appliquent donc pas.'
                : 'Bonus draws contain one number, so within-draw combinations are not available.'}
            </p>
          ) : combinationAnalysis.top.length > 0 ? (
            <>
              {combinationAnalysis.repeatedCombinations === 0 && (
                <p className="combination-no-repeat" role="status">
                  {fr
                    ? `Aucune combinaison de ${selectedCombinationSize} numéros ne se répète pendant cette période. Chaque ligne apparaît une fois parmi ${combinationAnalysis.totalOccurrences.toLocaleString(locale)} occurrences enregistrées.`
                    : `No ${selectedCombinationSize}-number combination repeated in this range. Each listed set appears once among ${combinationAnalysis.totalOccurrences.toLocaleString(locale)} recorded combinations.`}
                </p>
              )}
              <div className="combination-table-wrap">
                <table className="analysis-table">
                  <thead>
                    <tr>
                      <th>{fr ? 'Rang (ex æquo)' : 'Rank (ties)'}</th>
                      <th>{fr ? 'Combinaison' : 'Combination'}</th>
                      <th>{fr ? 'Tirages communs' : 'Draws together'}</th>
                      <th>{fr ? '% des tirages sélectionnés' : '% of selected draws'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinationAnalysis.top.map((entry) => (
                      <tr key={entry.numbers.join('-')}>
                        <td>
                          {combinationAnalysis.top.findIndex(
                            (candidate) => candidate.count === entry.count,
                          ) + 1}
                        </td>
                        <td>
                          <span className="combination-balls">
                            {entry.numbers.map((number) => (
                              <strong key={number}>{number.toString().padStart(2, '0')}</strong>
                            ))}
                          </span>
                        </td>
                        <td>{entry.count}</td>
                        <td>{formatNumber(entry.percentOfDraws)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="all-data-action">
                <button
                  className="button button--outline"
                  onClick={() =>
                    onViewAll({
                      gameId,
                      from,
                      to,
                      combinationSize: selectedCombinationSize,
                    })
                  }
                  type="button"
                >
                  {fr
                    ? 'Voir toutes les combinaisons et tous les tirages'
                    : 'View all combinations and draw data'}
                </button>
              </div>
            </>
          ) : (
            <p className="analysis-empty">
              {fr
                ? 'Aucun tirage à analyser pendant cette période.'
                : 'No draws are available in this date range.'}
            </p>
          )}
        </section>

        <div className="stats-card">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">{historicalGameConfig[gameId].label}</p>
              <h2 id="stats-game-title">{t('frequency')}</h2>
            </div>
            <div className="segmented-control">
              <button aria-pressed={kind === 'main'} onClick={() => setKind('main')} type="button">
                {t('mainNumbers')}
              </button>
              <button
                aria-pressed={kind === 'bonus'}
                onClick={() => setKind('bonus')}
                type="button"
              >
                {t('bonusNumbers')}
              </button>
            </div>
          </div>
          <div
            className="frequency-grid"
            style={{ '--game-accent': historicalGameConfig[gameId].accent } as CSSProperties}
          >
            {frequencies.map((entry) => (
              <div
                className="frequency-item"
                key={entry.number}
                title={`${entry.number}: ${entry.count}`}
              >
                <span className="frequency-item__number">
                  {entry.number.toString().padStart(2, '0')}
                </span>
                <div className="frequency-item__track">
                  <span style={{ height: `${Math.max(4, (entry.count / maximum) * 100)}%` }} />
                </div>
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
          <p className="probability-note">{t('probabilityNote')}</p>
        </div>

        <section className="stats-card number-ranking" aria-labelledby="ranking-title">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">FREQUENCY RANKING</p>
              <h2 id="ranking-title">
                {fr ? 'Classement des fréquences des numéros' : 'Number Frequency Ranking'}
              </h2>
            </div>
            <span className="analysis-summary__sample">
              {fr ? 'Du plus fréquent au moins fréquent' : 'Sorted by appearances, highest first'}
            </span>
          </div>
          <div className="combination-table-wrap ranking-table-wrap">
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>{fr ? 'Rang' : 'Rank'}</th>
                  <th>{fr ? 'Numéro' : 'Number'}</th>
                  <th>{fr ? 'Occurrences' : 'Appearances'}</th>
                  <th>{fr ? 'Taux par tirage' : 'Draw appearance rate'}</th>
                  <th>{fr ? 'Intervalle moyen (tirages)' : 'Average hit gap (draws)'}</th>
                  <th>{fr ? 'Absence actuelle (tirages)' : 'Current drought (draws)'}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry) => (
                  <tr key={entry.number}>
                    <td>{entry.rank}</td>
                    <td>
                      <strong className="ranking-number">
                        {entry.number.toString().padStart(2, '0')}
                      </strong>
                    </td>
                    <td>{entry.count}</td>
                    <td>{formatNumber(entry.percent)}%</td>
                    <td>{formatNumber(entry.averageDrawGap)}</td>
                    <td>{entry.currentDrought}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stats-card">
          <div className="stats-card__heading">
            <h2>{t('drawHistory')}</h2>
            <a href={historicalDrawSnapshot.source} rel="noreferrer" target="_blank">
              {t('officialData')} ↗
            </a>
          </div>
          <div className="draw-history-grid">
            {draws.slice(0, 8).map((draw) => (
              <article className="draw-history-card" key={`${draw.gameId}-${draw.drawNumber}`}>
                <span>
                  {formatDate(draw.drawDate)} · #{draw.drawNumber}
                </span>
                <div className="history-balls">
                  {draw.mainNumbers.map((number) => (
                    <strong key={number}>{number.toString().padStart(2, '0')}</strong>
                  ))}
                  {draw.bonusNumber !== undefined && (
                    <strong className="history-ball--bonus" title={t('bonus')}>
                      {draw.bonusNumber.toString().padStart(2, '0')}
                    </strong>
                  )}
                </div>
                {draw.extraNumbers.length > 0 && (
                  <small>
                    EXTRA ·{' '}
                    {draw.extraNumbers
                      .map((number) => number.toString().padStart(2, '0'))
                      .join(' ')}
                  </small>
                )}
              </article>
            ))}
          </div>
          <div className="all-data-action">
            <button
              className="button button--outline"
              onClick={() =>
                onViewAll({
                  gameId,
                  from,
                  to,
                  combinationSize: selectedCombinationSize,
                })
              }
              type="button"
            >
              {fr ? 'Voir tous les résultats des tirages' : 'View all draw data'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
