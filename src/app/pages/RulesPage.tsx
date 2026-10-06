import type { LotteryDefinition, PrizeAward } from '../../domain/lottery/types';
import { localizeGame, useI18n } from '../../i18n/I18nContext';
import { formatMoney } from '../formatters';

interface RulesPageProps {
  readonly definition: LotteryDefinition;
  readonly onBack: () => void;
  readonly onPlay: () => void;
}

function awardLabel(award: PrizeAward, fr: boolean): string {
  if (award.type === 'fixed-cash') return formatMoney(award.amountCents);
  if (award.type === 'free-play') {
    return fr
      ? `Jeu gratuit (${formatMoney(award.valueCents)})`
      : `Free Play (${formatMoney(award.valueCents)})`;
  }
  if (award.type === 'annuity-or-cash') {
    return `${award.annuityLabel} / ${formatMoney(award.lumpSumCents)}`;
  }
  return fr ? 'Partage de la cagnotte' : 'Pool share';
}

function featureSummary(id: string, fr: boolean): string {
  if (fr) {
    const copy: Record<string, string> = {
      extra:
        'Ajoutez 1 $ par jeu. Le système génère quatre numéros distincts de 1 à 99; les gains dépendent des correspondances.',
      maxplus:
        'Les cagnottes admissibles de Lotto Max comprennent des tirages MAXPLUS supplémentaires.',
      maxmillions:
        'Lorsque les conditions sont réunies, chaque tirage MAXMILLIONS offre 1 000 000 $ par jeu.',
      'keno-bonus': 'Doublez la mise pour obtenir un multiplicateur de gain aléatoire au tirage.',
      'keno-pattern-play':
        'Choisissez 20 numéros pour une mise fixe de 2 $ et consultez la grille Keno Pattern Play.',
      'combo-play':
        'Choisissez plus de numéros pour créer plusieurs combinaisons; le prix total est calculé automatiquement.',
    };
    return copy[id] ?? 'Cette option est réglée selon les règles du jeu.';
  }
  const copy: Record<string, string> = {
    extra:
      'Add $1 per play. The system generates four unique numbers from 1–99 and awards by matches.',
    maxplus: 'Eligible Lotto Max jackpots include additional MAXPLUS draws.',
    maxmillions: 'When eligible, each MAXMILLIONS draw awards $1,000,000 per play.',
    'keno-bonus': 'Double the wager for a randomly selected prize multiplier on the draw.',
    'keno-pattern-play':
      'Pick 20 numbers for a fixed $2 wager and use the Keno Pattern Play prize table.',
    'combo-play':
      'Pick additional numbers to expand into combinations and calculate the full price.',
  };
  return copy[id] ?? 'This feature is settled according to its game rules.';
}

export function RulesPage({ definition, onBack, onPlay }: RulesPageProps) {
  const { language } = useI18n();
  const fr = language === 'fr';
  const game = localizeGame(definition.id, language);
  return (
    <main className="official-page rules-page">
      <header className={`rules-hero rules-hero--${definition.id}`}>
        <button className="banner-back" onClick={onBack} type="button">
          ← {fr ? 'Retour à la loterie' : 'Back to Lottery'}
        </button>
        <div className={`lottery-logo lottery-logo--${definition.id}`} aria-hidden="true" />
        <h1>{game.name}</h1>
        <p>{game.description}</p>
        <button className="primary-button" onClick={onPlay} type="button">
          {fr ? 'Acheter des billets virtuels' : 'Buy Virtual Tickets'}
        </button>
      </header>
      <div className="rules-content">
        <section className="rules-overview">
          <article>
            <span>{fr ? 'Sélection' : 'Choose'}</span>
            <strong>
              {definition.play.allowedPickCounts.join(' / ')} / {definition.draw.mainNumbers.max}
            </strong>
          </article>
          <article>
            <span>{fr ? 'Par jeu' : 'Per Play'}</span>
            <strong>{formatMoney(definition.play.basePriceCents)}</strong>
          </article>
          <article>
            <span>{fr ? 'Sélections incluses' : 'Selections included'}</span>
            <strong>{definition.play.selectionsPerPlay}</strong>
          </article>
          <article>
            <span>{fr ? 'Version des règles' : 'Rules version'}</span>
            <strong>{definition.rulesVersion}</strong>
          </article>
        </section>
        <section className="rules-card">
          <h2>{fr ? 'Comment jouer' : 'How to Play'}</h2>
          <ol>
            <li>
              {fr
                ? 'Choisissez le nombre de jeux et les options souhaitées.'
                : 'Set the number of Plays and game options.'}
            </li>
            <li>
              {fr
                ? 'Choisissez vos numéros ou utilisez la sélection Quick Pick.'
                : 'Choose numbers or use Quick Pick.'}
            </li>
            <li>
              {fr
                ? 'Ajoutez EXTRA ou toute autre option offerte, vérifiez le total et confirmez.'
                : 'Choose available add-ons, review the total and confirm.'}
            </li>
            <li>
              {fr
                ? 'Après l’achat, cliquez sur Simuler le tirage pour générer et régler les résultats.'
                : 'After purchase, click Simulate Draw to generate and settle the result.'}
            </li>
          </ol>
        </section>
        <section className="rules-card">
          <h2>{fr ? 'Niveaux de prix' : 'Prize Tiers'}</h2>
          <div className="rules-table" role="table">
            <div className="rules-table__head" role="row">
              <span role="columnheader">{fr ? 'Niveau' : 'Tier'}</span>
              <span role="columnheader">{fr ? 'Prix' : 'Prize'}</span>
              <span role="columnheader">{fr ? 'Probabilités' : 'Odds'}</span>
            </div>
            {definition.prizeTiers.map((tier) => (
              <div key={tier.id} role="row">
                <strong role="cell">{tier.label}</strong>
                <span role="cell">{awardLabel(tier.award, fr)}</span>
                <span role="cell">1 : {tier.oddsOneIn.toLocaleString('en-CA')}</span>
              </div>
            ))}
          </div>
        </section>
        {definition.features.length > 0 && (
          <section className="rules-card">
            <h2>{fr ? 'Options et fonctionnalités' : 'Add-ons & Features'}</h2>
            <div className="feature-list">
              {definition.features.map((feature) => (
                <article key={feature.id}>
                  <strong>{feature.displayName}</strong>
                  <p>{featureSummary(feature.id, fr)}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <p className="rules-disclaimer">
          {fr
            ? 'Cette page présente les règles d’une simulation locale avec des fonds virtuels; aucun billet réel ne peut être acheté ou encaissé.'
            : 'This is a local virtual-funds rules page. It does not sell or redeem real tickets.'}
        </p>
      </div>
    </main>
  );
}
