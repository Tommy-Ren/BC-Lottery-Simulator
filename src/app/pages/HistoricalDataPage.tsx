import { useMemo, useState } from 'react';
import {
  analyzeNumberCombinations,
  drawsForGame,
  historicalDrawSnapshot,
  historicalGameConfig,
  type HistoricalGameId,
} from '../../data/history/historicalDraws';
import { useI18n } from '../../i18n/I18nContext';

const gameIds = Object.keys(historicalGameConfig) as HistoricalGameId[];
const pageSize = 30;

interface HistoricalDataPageProps {
  readonly gameId: HistoricalGameId;
  readonly from: string;
  readonly to: string;
  readonly combinationSize: number;
  readonly onBack: () => void;
}

function parseSearchNumbers(input: string): number[] {
  return [...new Set((input.match(/\d+/g) ?? []).map(Number).filter(Number.isInteger))];
}

function rankCombinations<T extends { readonly count: number }>(
  combinations: readonly T[],
): readonly (T & { readonly rank: number })[] {
  const rankByCount = new Map<number, number>();
  combinations.forEach((entry, index) => {
    if (!rankByCount.has(entry.count)) rankByCount.set(entry.count, index + 1);
  });
  return combinations.map((entry) => ({ ...entry, rank: rankByCount.get(entry.count) ?? 0 }));
}

export function HistoricalDataPage({
  gameId: initialGameId,
  from: initialFrom,
  to: initialTo,
  combinationSize: initialCombinationSize,
  onBack,
}: HistoricalDataPageProps) {
  const { language, locale } = useI18n();
  const fr = language === 'fr';
  const [gameId, setGameId] = useState(initialGameId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [combinationSize, setCombinationSize] = useState(initialCombinationSize);
  const [query, setQuery] = useState('');
  const [drawPage, setDrawPage] = useState(0);
  const [combinationPage, setCombinationPage] = useState(0);

  const validRange = Boolean(from && to && from <= to);
  const draws = useMemo(
    () => (validRange ? drawsForGame(gameId, from, to) : []),
    [from, gameId, to, validRange],
  );
  const maximumCombinationSize = draws[0]?.mainNumbers.length ?? 2;
  const selectedCombinationSize = Math.min(combinationSize, maximumCombinationSize);
  const queryNumbers = useMemo(() => parseSearchNumbers(query), [query]);
  const matchingDraws = useMemo(
    () =>
      queryNumbers.length === 0
        ? draws
        : draws.filter((draw) => queryNumbers.every((number) => draw.mainNumbers.includes(number))),
    [draws, queryNumbers],
  );
  const combinations = useMemo(
    () =>
      analyzeNumberCombinations(
        draws,
        selectedCombinationSize,
        historicalGameConfig[gameId].maxNumber,
        Number.POSITIVE_INFINITY,
      ).top,
    [draws, gameId, selectedCombinationSize],
  );
  const rankedCombinations = useMemo(() => rankCombinations(combinations), [combinations]);
  const numberRange = Array.from(
    { length: historicalGameConfig[gameId].maxNumber },
    (_, index) => index + 1,
  );
  const drawPageCount = Math.max(1, Math.ceil(matchingDraws.length / pageSize));
  const combinationPageCount = Math.max(1, Math.ceil(rankedCombinations.length / pageSize));
  const visibleDraws = matchingDraws.slice(drawPage * pageSize, (drawPage + 1) * pageSize);
  const visibleCombinations = rankedCombinations.slice(
    combinationPage * pageSize,
    (combinationPage + 1) * pageSize,
  );
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
  const formatNumber = (value: number) => new Intl.NumberFormat(locale).format(value);

  function resetPagination(): void {
    setDrawPage(0);
    setCombinationPage(0);
  }

  return (
    <main className="official-page historical-data-page">
      <header className="page-banner">
        <div>
          <button className="banner-back" onClick={onBack} type="button">
            ← {fr ? 'Retour aux statistiques' : 'Back to statistics'}
          </button>
          <span className="page-banner__eyebrow">PLAYNOW DATA SNAPSHOT</span>
          <h1>{fr ? 'Toutes les données historiques' : 'All Historical Data'}</h1>
          <p>
            {fr
              ? 'Consultez tous les résultats et toutes les combinaisons conjointes pour le jeu et la période sélectionnés.'
              : 'Browse every draw and co-occurrence combination for the selected game and date range.'}
          </p>
        </div>
      </header>

      <section
        className="stats-shell"
        aria-label={fr ? 'Filtres des données historiques' : 'Historical data filters'}
      >
        <div className="historical-data-filters">
          <label>
            {fr ? 'Jeu' : 'Game'}
            <select
              onChange={(event) => {
                setGameId(event.target.value as HistoricalGameId);
                setCombinationSize(2);
                resetPagination();
              }}
              value={gameId}
            >
              {gameIds.map((id) => (
                <option key={id} value={id}>
                  {historicalGameConfig[id].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {fr ? 'Du' : 'From'}
            <input
              max={historicalDrawSnapshot.range.to}
              min={historicalDrawSnapshot.range.from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPagination();
              }}
              type="date"
              value={from}
            />
          </label>
          <label>
            {fr ? 'Au' : 'To'}
            <input
              max={historicalDrawSnapshot.range.to}
              min={historicalDrawSnapshot.range.from}
              onChange={(event) => {
                setTo(event.target.value);
                resetPagination();
              }}
              type="date"
              value={to}
            />
          </label>
          <label>
            {fr ? 'Numéros par combinaison' : 'Numbers per combination'}
            <select
              onChange={(event) => {
                setCombinationSize(Number(event.target.value));
                setCombinationPage(0);
              }}
              value={selectedCombinationSize}
            >
              {Array.from(
                { length: Math.max(1, maximumCombinationSize - 1) },
                (_, index) => index + 2,
              )
                .filter((size) => size <= maximumCombinationSize)
                .map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {!validRange && (
          <p className="historical-data-error" role="alert">
            {fr
              ? 'La date de début doit précéder la date de fin.'
              : 'The start date must be before the end date.'}
          </p>
        )}

        <section className="stats-card historical-search" aria-labelledby="historical-search-title">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">NUMBER LOOKUP</p>
              <h2 id="historical-search-title">
                {fr ? 'Vérifier si des numéros sont sortis' : 'Check if numbers were drawn'}
              </h2>
            </div>
          </div>
          <label className="historical-search__field">
            <span>{fr ? 'Saisissez un ou plusieurs numéros' : 'Enter one or more numbers'}</span>
            <input
              inputMode="numeric"
              onChange={(event) => {
                setQuery(event.target.value);
                setDrawPage(0);
              }}
              placeholder={fr ? 'p. ex. 01 ou 01 02 03' : 'e.g. 01 or 01 02 03'}
              type="search"
              value={query}
            />
          </label>
          <p className="analysis-method-note">
            {queryNumbers.length > 0
              ? fr
                ? `${matchingDraws.length.toLocaleString(locale)} tirages sur ${draws.length.toLocaleString(locale)} contiennent tous les numéros recherchés (${queryNumbers.map((number) => number.toString().padStart(2, '0')).join(', ')}).`
                : `${matchingDraws.length.toLocaleString(locale)} of ${draws.length.toLocaleString(locale)} draws contain all searched numbers (${queryNumbers.map((number) => number.toString().padStart(2, '0')).join(', ')}).`
              : fr
                ? 'Séparez les numéros par des espaces ou des virgules. Plusieurs numéros recherchent les tirages où ils figurent tous parmi les numéros principaux.'
                : 'Enter numbers separated by spaces or commas. Multiple numbers find draws containing all of them in the main numbers.'}
          </p>
          {queryNumbers.some((number) => !numberRange.includes(number)) && (
            <p className="historical-data-error" role="status">
              {fr
                ? `À noter : les numéros de ${historicalGameConfig[gameId].label} vont de 01 à ${historicalGameConfig[gameId].maxNumber.toString().padStart(2, '0')}.`
                : `Note: ${historicalGameConfig[gameId].label} numbers range from 01 to ${historicalGameConfig[gameId].maxNumber.toString().padStart(2, '0')}.`}
            </p>
          )}
        </section>

        <section className="stats-card" aria-labelledby="all-draws-title">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">
                DRAW HISTORY · {matchingDraws.length.toLocaleString(locale)}
              </p>
              <h2 id="all-draws-title">{fr ? 'Résultats des tirages' : 'Draw Results'}</h2>
            </div>
          </div>
          {visibleDraws.length > 0 ? (
            <div className="draw-history-grid">
              {visibleDraws.map((draw) => (
                <article className="draw-history-card" key={`${draw.gameId}-${draw.drawNumber}`}>
                  <span>
                    {formatDate(draw.drawDate)} · #{draw.drawNumber}
                  </span>
                  <div className="history-balls">
                    {draw.mainNumbers.map((number) => (
                      <strong key={number}>{number.toString().padStart(2, '0')}</strong>
                    ))}
                    {draw.bonusNumber !== undefined && (
                      <strong className="history-ball--bonus" title={fr ? 'Bonus' : 'Bonus'}>
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
          ) : (
            <p className="analysis-empty">
              {fr
                ? 'Aucun tirage ne correspond à cette recherche et à cette période.'
                : 'No draws match this search and date range.'}
            </p>
          )}
          <div className="history-pagination">
            <button
              disabled={drawPage === 0}
              onClick={() => setDrawPage((page) => Math.max(0, page - 1))}
              type="button"
            >
              {fr ? 'Précédent' : 'Previous'}
            </button>
            <span>
              {fr
                ? `Page ${drawPage + 1} sur ${drawPageCount}`
                : `Page ${drawPage + 1} of ${drawPageCount}`}
            </span>
            <button
              disabled={drawPage + 1 >= drawPageCount}
              onClick={() => setDrawPage((page) => Math.min(drawPageCount - 1, page + 1))}
              type="button"
            >
              {fr ? 'Suivant' : 'Next'}
            </button>
          </div>
        </section>

        <section className="stats-card" aria-labelledby="all-combinations-title">
          <div className="stats-card__heading">
            <div>
              <p className="eyebrow">
                CO-OCCURRENCE · {combinations.length.toLocaleString(locale)}
              </p>
              <h2 id="all-combinations-title">
                {fr
                  ? `Toutes les combinaisons de ${selectedCombinationSize} numéros`
                  : `All ${selectedCombinationSize}-number combinations`}
              </h2>
            </div>
          </div>
          <p className="analysis-method-note">
            {fr
              ? 'Les combinaisons sont classées par fréquence conjointe; les ex æquo partagent le même rang. La recherche filtre les résultats ci-dessus, pas cette liste complète.'
              : 'Combinations are ordered by co-occurrence count; equal counts are ties. The number lookup filters draw results above, not this complete list.'}
          </p>
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
                {visibleCombinations.map((entry) => (
                  <tr key={entry.numbers.join('-')}>
                    <td>{entry.rank}</td>
                    <td>
                      <span className="combination-balls">
                        {entry.numbers.map((number) => (
                          <strong key={number}>{number.toString().padStart(2, '0')}</strong>
                        ))}
                      </span>
                    </td>
                    <td>{formatNumber(entry.count)}</td>
                    <td>
                      {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                        entry.percentOfDraws,
                      )}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {combinations.length === 0 && (
            <p className="analysis-empty">
              {fr ? 'Aucune combinaison à afficher.' : 'No combinations are available.'}
            </p>
          )}
          <div className="history-pagination">
            <button
              disabled={combinationPage === 0}
              onClick={() => setCombinationPage((page) => Math.max(0, page - 1))}
              type="button"
            >
              {fr ? 'Précédent' : 'Previous'}
            </button>
            <span>
              {fr
                ? `Page ${combinationPage + 1} sur ${combinationPageCount}`
                : `Page ${combinationPage + 1} of ${combinationPageCount}`}
            </span>
            <button
              disabled={combinationPage + 1 >= combinationPageCount}
              onClick={() =>
                setCombinationPage((page) => Math.min(combinationPageCount - 1, page + 1))
              }
              type="button"
            >
              {fr ? 'Suivant' : 'Next'}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
