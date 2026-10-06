import { useEffect, useMemo, useState } from 'react';
import type { WalletState } from '../../domain/economy/wallet';
import { quickPickPlay } from '../../domain/lottery/engine';
import { expandComboSelection, type TicketAddOns } from '../../domain/lottery/features';
import type { GoldBallCycleState, GoldBallDrawResult } from '../../domain/lottery/goldBall';
import { createSeededRandom, drawUniqueNumbers } from '../../domain/lottery/random';
import type { Ticket } from '../../domain/lottery/tickets';
import type {
  LotteryDefinition,
  LotteryDrawResult,
  LotterySelection,
} from '../../domain/lottery/types';
import {
  drawsForGame,
  getHistoricalDrawRange,
  historicalGameConfig,
  type HistoricalGameId,
} from '../../data/history/historicalDraws';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateTime, formatMoney } from '../formatters';

export interface PurchaseOptions {
  readonly wagerCents?: number;
  readonly drawCount?: number;
  readonly addOns?: Partial<TicketAddOns>;
}

interface PlayPageProps {
  readonly definition: LotteryDefinition;
  readonly drawId: string;
  readonly wallet: WalletState;
  readonly tickets: readonly Ticket[];
  readonly draw?: LotteryDrawResult;
  readonly goldBallCycle?: GoldBallCycleState;
  readonly goldBallDraw?: GoldBallDrawResult;
  readonly scheduledAt: string;
  readonly onPurchase: (
    selections: readonly LotterySelection[],
    options?: PurchaseOptions,
  ) => string | null;
  readonly onDraw: () => void;
  readonly onNextDraw: () => void;
  readonly onBack: () => void;
  readonly onTickets: () => void;
}

type PurchaseStep = 'setup' | 'numbers' | 'extras' | 'review' | 'complete';

interface RandomRangeGroup {
  readonly count: number;
  readonly min: number;
  readonly max: number;
}

interface SelectionHistory {
  readonly selection: LotterySelection;
  readonly numberCounts: readonly { number: number; count: number }[];
  readonly drawsAnalyzed: number;
  readonly coOccurrenceCount: number;
  readonly expandedLineCount?: number;
  readonly previouslyDrawnLineCount?: number;
  readonly bestLineFrequency?: number;
}

function makeConstrainedRandomPick(
  groups: readonly RandomRangeGroup[],
  seed: string,
): readonly number[] | null {
  const random = createSeededRandom(seed);
  const shuffled = (values: number[]) => {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random.next() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex]!, values[index]!];
    }
    return values;
  };
  const candidates = groups.flatMap((group) =>
    Array.from({ length: group.count }, () =>
      shuffled(Array.from({ length: group.max - group.min + 1 }, (_, index) => group.min + index)),
    ),
  );
  const numberOwners = new Map<number, number>();
  const chosen: number[] = Array.from({ length: candidates.length }, () => 0);

  function assign(slot: number, visited: Set<number>): boolean {
    for (const number of candidates[slot] ?? []) {
      if (visited.has(number)) continue;
      visited.add(number);
      const owner = numberOwners.get(number);
      if (owner === undefined || assign(owner, visited)) {
        numberOwners.set(number, slot);
        chosen[slot] = number;
        return true;
      }
    }
    return false;
  }

  const slotOrder = candidates
    .map((values, index) => ({ index, candidateCount: values.length }))
    .sort((left, right) => left.candidateCount - right.candidateCount)
    .map(({ index }) => index);
  for (const slot of slotOrder) {
    if (!assign(slot, new Set())) return null;
  }
  return chosen.sort((left, right) => left - right);
}

function emptySelections(count: number): readonly LotterySelection[] {
  return Array.from({ length: count }, () => ({ mainNumbers: [] }));
}

function selectionLabel(index: number, selectionsPerPlay: number): string {
  const playNumber = Math.floor(index / selectionsPerPlay) + 1;
  if (selectionsPerPlay === 1) return `Play ${playNumber}`;
  return `Play ${playNumber} · Selection ${String.fromCharCode(65 + (index % selectionsPerPlay))}`;
}

function comboOptionsFor(definition: LotteryDefinition): readonly number[] {
  if (definition.id === 'daily-grand') return [5];
  if (definition.id === 'lotto-max') return [8, 9];
  if (definition.id === 'bc-49' || definition.id === 'lotto-649') return [5, 7, 8, 9];
  return [];
}

function comboSelectionCount(definition: LotteryDefinition, pickCount: number): number {
  if (definition.id === 'daily-grand') return 7;
  if (definition.id === 'lotto-max') return pickCount === 8 ? 32 : 144;
  if (pickCount === 5) return 44;
  if (pickCount === 7) return 7;
  if (pickCount === 8) return 28;
  return 84;
}

export function PlayPage(props: PlayPageProps) {
  const {
    definition,
    drawId,
    wallet,
    tickets,
    draw,
    goldBallCycle,
    goldBallDraw,
    scheduledAt,
    onPurchase,
    onDraw,
    onNextDraw,
    onBack,
    onTickets,
  } = props;
  const { language, locale } = useI18n();
  const fr = language === 'fr';
  const [step, setStep] = useState<PurchaseStep>('setup');
  const [numberOfPlays, setNumberOfPlays] = useState(1);
  const [pickCount, setPickCount] = useState(definition.play.allowedPickCounts[0] ?? 6);
  const [comboPickCount, setComboPickCount] = useState<number>();
  const [extraPlayCount, setExtraPlayCount] = useState(0);
  const [kenoBonus, setKenoBonus] = useState(false);
  const [kenoPatternPlay, setKenoPatternPlay] = useState(false);
  const [wagerCents, setWagerCents] = useState(definition.play.basePriceCents);
  const [drawCount, setDrawCount] = useState(1);
  const selectionsPerPlay = definition.play.selectionsPerPlay;
  const requiredNumbers = kenoPatternPlay ? 20 : (comboPickCount ?? pickCount);
  const selectionSlots = comboPickCount === undefined ? numberOfPlays * selectionsPerPlay : 1;
  const randomConfigKey = `${definition.id}:${requiredNumbers}:${selectionSlots}`;
  const defaultAdvancedGroups: readonly RandomRangeGroup[] = [
    {
      count: requiredNumbers,
      min: definition.draw.mainNumbers.min,
      max: definition.draw.mainNumbers.max,
    },
  ];
  const [advancedGroupsState, setAdvancedGroupsState] = useState({
    key: randomConfigKey,
    groups: defaultAdvancedGroups,
  });
  const advancedGroups =
    advancedGroupsState.key === randomConfigKey
      ? advancedGroupsState.groups
      : defaultAdvancedGroups;
  function setAdvancedGroups(
    update:
      | readonly RandomRangeGroup[]
      | ((current: readonly RandomRangeGroup[]) => readonly RandomRangeGroup[]),
  ) {
    setAdvancedGroupsState((current) => {
      const currentGroups =
        current.key === randomConfigKey ? current.groups : defaultAdvancedGroups;
      return {
        key: randomConfigKey,
        groups: typeof update === 'function' ? update(currentGroups) : update,
      };
    });
  }
  const [advancedPanelOpen, setAdvancedPanelOpen] = useState(false);
  const [advancedReportState, setAdvancedReportState] = useState<{
    readonly key: string;
    readonly selections: readonly LotterySelection[];
  } | null>(null);
  const advancedReport =
    advancedReportState?.key === randomConfigKey ? advancedReportState.selections : null;
  function setAdvancedReport(selections: readonly LotterySelection[] | null) {
    setAdvancedReportState(selections ? { key: randomConfigKey, selections } : null);
  }
  const [advancedErrorState, setAdvancedErrorState] = useState<{
    readonly key: string;
    readonly error: string;
  } | null>(null);
  const advancedError =
    advancedErrorState?.key === randomConfigKey ? advancedErrorState.error : null;
  function setAdvancedError(error: string | null) {
    setAdvancedErrorState(error ? { key: randomConfigKey, error } : null);
  }
  const [selections, setSelections] = useState<readonly LotterySelection[]>(() =>
    emptySelections(selectionsPerPlay),
  );
  const [activeSelectionIndex, setActiveSelectionIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const historicalGameId: HistoricalGameId | undefined =
    definition.id === 'keno' ? undefined : definition.id;
  const historicalRange = getHistoricalDrawRange();
  const historyDraws = useMemo(
    () =>
      historicalGameId
        ? drawsForGame(historicalGameId, historicalRange.from, historicalRange.to)
        : [],
    [historicalGameId, historicalRange.from, historicalRange.to],
  );
  const selectionHistory = useMemo<readonly SelectionHistory[]>(() => {
    if (!advancedReport) return [];
    const counts = new Map<number, number>();
    historyDraws.forEach((historicalDraw) => {
      historicalDraw.mainNumbers.forEach((number) =>
        counts.set(number, (counts.get(number) ?? 0) + 1),
      );
    });
    return advancedReport.map((selection) => {
      const coOccurrenceCount = historyDraws.filter((historicalDraw) =>
        selection.mainNumbers.every((number) => historicalDraw.mainNumbers.includes(number)),
      ).length;
      if (comboPickCount === undefined) {
        return {
          selection,
          numberCounts: selection.mainNumbers.map((number) => ({
            number,
            count: counts.get(number) ?? 0,
          })),
          drawsAnalyzed: historyDraws.length,
          coOccurrenceCount,
        };
      }
      const expandedLines = expandComboSelection(definition, selection.mainNumbers);
      const lineFrequencies = expandedLines.map(
        (line) =>
          historyDraws.filter((historicalDraw) =>
            line.mainNumbers.every((number) => historicalDraw.mainNumbers.includes(number)),
          ).length,
      );
      return {
        selection,
        numberCounts: selection.mainNumbers.map((number) => ({
          number,
          count: counts.get(number) ?? 0,
        })),
        drawsAnalyzed: historyDraws.length,
        coOccurrenceCount,
        expandedLineCount: expandedLines.length,
        previouslyDrawnLineCount: lineFrequencies.filter((count) => count > 0).length,
        bestLineFrequency: Math.max(0, ...lineFrequencies),
      };
    });
  }, [advancedReport, comboPickCount, definition, historyDraws]);
  const activeSelection = selections[activeSelectionIndex] ?? { mainNumbers: [] };
  const complete = selections.every(
    (selection) => selection.mainNumbers.length === requiredNumbers,
  );
  const comboSelections =
    comboPickCount !== undefined && activeSelection.mainNumbers.length === comboPickCount
      ? expandComboSelection(definition, activeSelection.mainNumbers)
      : [];
  const pricedSelectionCount =
    comboPickCount === undefined
      ? selections.length
      : comboSelectionCount(definition, comboPickCount);
  const pricedPlayCount = pricedSelectionCount / selectionsPerPlay;
  const baseCostCents = kenoPatternPlay
    ? 200 * drawCount
    : pricedPlayCount * wagerCents * drawCount;
  const totalCostCents =
    baseCostCents + (kenoBonus ? baseCostCents : 0) + extraPlayCount * 100 * drawCount;
  const comboOptions = comboOptionsFor(definition);
  const maximumPlays = definition.id === 'keno' ? 1 : 10;
  const currentTickets = useMemo(
    () => tickets.filter((ticket) => ticket.drawIds.includes(drawId)),
    [drawId, tickets],
  );
  const ticketNumbers = useMemo(
    () =>
      new Set(
        currentTickets.flatMap((ticket) =>
          ticket.selections.flatMap((selection) => selection.mainNumbers),
        ),
      ),
    [currentTickets],
  );
  const settlement = currentTickets
    .flatMap((ticket) => ticket.settlements)
    .find((item) => item.drawId === drawId);
  const numberOptions = useMemo(
    () =>
      Array.from(
        { length: definition.draw.mainNumbers.max - definition.draw.mainNumbers.min + 1 },
        (_, index) => definition.draw.mainNumbers.min + index,
      ),
    [definition],
  );
  const configuredRandomNumbers = advancedGroups.reduce((total, group) => total + group.count, 0);
  const advancedRangesValid =
    configuredRandomNumbers === requiredNumbers &&
    advancedGroups.every(
      (group) =>
        Number.isInteger(group.count) &&
        group.count > 0 &&
        Number.isInteger(group.min) &&
        Number.isInteger(group.max) &&
        group.min >= definition.draw.mainNumbers.min &&
        group.max <= definition.draw.mainNumbers.max &&
        group.min <= group.max &&
        group.max - group.min + 1 >= group.count,
    );

  useEffect(() => {
    if (!draw) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const frame = window.requestAnimationFrame(() => setRevealedCount(draw.mainNumbers.length));
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setInterval(
      () =>
        setRevealedCount((current) => {
          if (current >= draw.mainNumbers.length) window.clearInterval(timer);
          return Math.min(draw.mainNumbers.length, current + 1);
        }),
      140,
    );
    return () => window.clearInterval(timer);
  }, [draw]);

  function updateActive(next: LotterySelection) {
    setSelections((current) =>
      current.map((selection, index) =>
        index === activeSelectionIndex
          ? { ...next, mainNumbers: [...next.mainNumbers].sort((a, b) => a - b) }
          : selection,
      ),
    );
    setAdvancedReport(null);
  }

  function toggleNumber(number: number) {
    if (activeSelection.mainNumbers.includes(number)) {
      updateActive({
        ...activeSelection,
        mainNumbers: activeSelection.mainNumbers.filter((item) => item !== number),
      });
    } else if (activeSelection.mainNumbers.length < requiredNumbers) {
      updateActive({ ...activeSelection, mainNumbers: [...activeSelection.mainNumbers, number] });
    } else {
      setMessage(
        fr
          ? `Choisissez exactement ${requiredNumbers} numéros par sélection.`
          : `Choose only ${requiredNumbers} numbers per selection.`,
      );
    }
  }

  function quickPickSelection(index: number): LotterySelection {
    if (comboPickCount !== undefined || kenoPatternPlay) {
      return {
        mainNumbers: drawUniqueNumbers(
          {
            min: definition.draw.mainNumbers.min,
            max: definition.draw.mainNumbers.max,
            count: requiredNumbers,
          },
          createSeededRandom(`${definition.id}:${index}:${crypto.randomUUID()}`),
        ),
      };
    }
    const generated = quickPickPlay(
      definition,
      createSeededRandom(`${definition.id}:${index}:${crypto.randomUUID()}`),
      requiredNumbers,
    );
    return generated[index % selectionsPerPlay] ?? generated[0] ?? { mainNumbers: [] };
  }

  function quickPickAll(advance = false) {
    setSelections(Array.from({ length: selectionSlots }, (_, index) => quickPickSelection(index)));
    setAdvancedReport(null);
    setAdvancedError(null);
    setMessage(
      fr
        ? 'Tous les numéros ont été sélectionnés par Quick Pick. Vous pouvez encore les modifier.'
        : 'All numbers were Quick Picked. You can still edit them.',
    );
    if (advance) setStep('extras');
  }

  function updateAdvancedGroupCount(index: number, nextCount: number) {
    setAdvancedGroups((current) => {
      const group = current[index];
      if (!group || nextCount < 1) return current;
      const nextGroups = current.map((item) => ({ ...item }));
      let difference = nextCount - group.count;
      nextGroups[index] = { ...group, count: nextCount };
      if (difference > 0) {
        for (let donor = current.length - 1; donor >= 0 && difference > 0; donor -= 1) {
          if (donor === index) continue;
          const available = nextGroups[donor]!.count - 1;
          const moved = Math.min(available, difference);
          nextGroups[donor] = { ...nextGroups[donor]!, count: nextGroups[donor]!.count - moved };
          difference -= moved;
        }
        if (difference > 0) return current;
      } else if (difference < 0) {
        const receiver = index + 1 < current.length ? index + 1 : index - 1;
        if (receiver < 0) return current;
        nextGroups[receiver] = {
          ...nextGroups[receiver]!,
          count: nextGroups[receiver]!.count - difference,
        };
      }
      return nextGroups;
    });
    setAdvancedError(null);
  }

  function addAdvancedGroup() {
    setAdvancedGroups((current) => {
      const splitIndex = current.map((group) => group.count > 1).lastIndexOf(true);
      if (splitIndex < 0) return current;
      const split = current[splitIndex]!;
      return [
        ...current.slice(0, splitIndex),
        { ...split, count: split.count - 1 },
        ...current.slice(splitIndex + 1),
        { count: 1, min: definition.draw.mainNumbers.min, max: definition.draw.mainNumbers.max },
      ];
    });
    setAdvancedError(null);
  }

  function removeAdvancedGroup(index: number) {
    setAdvancedGroups((current) => {
      if (current.length <= 1) return current;
      const recipientIndex = index === 0 ? 1 : index - 1;
      const nextGroups = current.filter((_, groupIndex) => groupIndex !== index);
      nextGroups[recipientIndex > index ? recipientIndex - 1 : recipientIndex] = {
        ...nextGroups[recipientIndex > index ? recipientIndex - 1 : recipientIndex]!,
        count:
          nextGroups[recipientIndex > index ? recipientIndex - 1 : recipientIndex]!.count +
          current[index]!.count,
      };
      return nextGroups;
    });
    setAdvancedError(null);
  }

  function generateAdvancedPicks() {
    if (!advancedRangesValid) {
      setAdvancedError(
        fr
          ? `Le total des groupes doit être de ${requiredNumbers}; chaque plage doit être valide et contenir assez de numéros distincts.`
          : `Set group counts to ${requiredNumbers} in total and use valid ranges with enough unique numbers.`,
      );
      return;
    }
    const generated = Array.from({ length: selectionSlots }, (_, index) =>
      makeConstrainedRandomPick(
        advancedGroups,
        `${definition.id}:advanced:${index}:${crypto.randomUUID()}`,
      ),
    );
    if (generated.some((numbers) => numbers === null)) {
      setAdvancedError(
        fr
          ? 'Les plages choisies ne contiennent pas assez de numéros distincts. Élargissez-les ou modifiez-les.'
          : 'The selected ranges cannot provide enough unique numbers. Widen or adjust the ranges.',
      );
      return;
    }
    const nextSelections = generated.map((numbers) => ({ mainNumbers: numbers ?? [] }));
    setSelections(nextSelections);
    setAdvancedReport(nextSelections);
    setAdvancedError(null);
    setMessage(
      fr
        ? 'Les numéros aléatoires avancés sont générés. Vous pouvez encore les modifier.'
        : 'Advanced random picks generated. You can still edit them.',
    );
  }

  function selectionsWithSpecialNumbers(): readonly LotterySelection[] {
    const special = definition.draw.specialNumber;
    if (!special || definition.play.specialNumberMode !== 'computer-generated') return selections;
    const random = createSeededRandom(`${definition.id}:special:${crypto.randomUUID()}`);
    return selections.map((selection) => ({
      ...selection,
      specialNumber: special.min + Math.floor(random.next() * (special.max - special.min + 1)),
    }));
  }

  function purchase() {
    const purchaseSelections =
      comboPickCount === undefined ? selectionsWithSpecialNumbers() : comboSelections;
    const error = onPurchase(purchaseSelections, {
      wagerCents,
      drawCount,
      addOns: { extraPlayCount, kenoBonus, kenoPatternPlay, comboPickCount },
    });
    if (error) {
      setMessage(error);
      return;
    }
    setStep('complete');
    setMessage(
      fr
        ? 'Achat terminé. Votre billet est sauvegardé dans ce navigateur.'
        : 'Purchase complete. Your ticket is saved in this browser.',
    );
  }

  const steps: Array<{ id: PurchaseStep; label: string }> = [
    { id: 'setup', label: fr ? 'Nombre de jeux' : 'Number of Plays' },
    { id: 'numbers', label: fr ? 'Choisir les numéros' : 'Choose Numbers' },
    { id: 'extras', label: 'EXTRA' },
    { id: 'review', label: fr ? 'Vérification' : 'Review' },
  ];

  return (
    <main className="official-page purchase-page">
      <header className="page-banner">
        <div>
          <button className="banner-back" type="button" onClick={onBack}>
            ← {fr ? 'Retour à la loterie' : 'Back to Lottery'}
          </button>
          <h1>{fr ? 'Acheter des billets de loterie' : 'Buy Lottery Tickets'}</h1>
          <p>
            {definition.displayName} · {formatDateTime(scheduledAt)}
          </p>
        </div>
      </header>
      <ol className="purchase-steps" aria-label={fr ? 'Étapes d’achat' : 'Purchase steps'}>
        {steps.map((item, index) => (
          <li className={item.id === step ? 'is-active' : ''} key={item.id}>
            <span>{index + 1}</span>
            {item.label}
          </li>
        ))}
      </ol>

      <div className="purchase-shell">
        <section className="purchase-workspace">
          {step === 'setup' && (
            <section aria-labelledby="setup-title">
              <h2 id="setup-title">{fr ? 'Nombre de jeux' : 'Set Number of Plays'}</h2>
              <div className="setup-card">
                <div className={`game-lockup game-lockup--${definition.id}`}>
                  <strong>{definition.displayName}</strong>
                  <small>
                    {formatMoney(definition.play.basePriceCents)} {fr ? 'par jeu' : 'per Play'}
                  </small>
                </div>
                <div className="quantity-control">
                  <button
                    aria-label={fr ? 'Réduire le nombre de jeux' : 'Decrease plays'}
                    disabled={numberOfPlays <= 1 || definition.id === 'keno'}
                    onClick={() => {
                      const next = Math.max(1, numberOfPlays - 1);
                      setNumberOfPlays(next);
                      setSelections(emptySelections(next * selectionsPerPlay));
                      setActiveSelectionIndex(0);
                    }}
                    type="button"
                  >
                    −
                  </button>
                  <output aria-label={fr ? 'Nombre de jeux' : 'Number of Plays'}>
                    {numberOfPlays}
                  </output>
                  <button
                    aria-label={fr ? 'Augmenter le nombre de jeux' : 'Increase plays'}
                    disabled={numberOfPlays >= maximumPlays || definition.id === 'keno'}
                    onClick={() => {
                      const next = Math.min(maximumPlays, numberOfPlays + 1);
                      setNumberOfPlays(next);
                      setSelections(emptySelections(next * selectionsPerPlay));
                      setActiveSelectionIndex(0);
                    }}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <strong className="setup-price">
                  {formatMoney(numberOfPlays * definition.play.basePriceCents)}
                </strong>
              </div>

              {comboOptions.length > 0 && (
                <div className="feature-row">
                  <label>
                    Combo Play
                    <select
                      aria-label="Combo Play"
                      value={comboPickCount ?? ''}
                      onChange={(event) => {
                        const next = event.target.value ? Number(event.target.value) : undefined;
                        setComboPickCount(next);
                        setSelections(
                          emptySelections(
                            next === undefined ? numberOfPlays * selectionsPerPlay : 1,
                          ),
                        );
                        setActiveSelectionIndex(0);
                      }}
                    >
                      <option value="">{fr ? 'Jeu ordinaire' : 'Regular Play'}</option>
                      {comboOptions.map((count) => (
                        <option key={count} value={count}>
                          Combo {count}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {fr
                      ? 'Combo génère toutes les combinaisons possibles et le prix dépend de leur nombre.'
                      : 'Combo expands and prices every valid combination.'}
                  </p>
                </div>
              )}

              {definition.id === 'keno' && (
                <section
                  className="keno-settings"
                  aria-label={fr ? 'Options de jeu Keno' : 'Keno play settings'}
                >
                  <div>
                    <span>{fr ? 'Nombre de numéros choisis' : 'Pick count'}</span>
                    <div className="option-buttons">
                      {definition.play.allowedPickCounts.map((count) => (
                        <button
                          aria-pressed={pickCount === count}
                          className="option-button"
                          key={count}
                          onClick={() => {
                            setPickCount(count);
                            setSelections(emptySelections(1));
                            setActiveSelectionIndex(0);
                          }}
                          type="button"
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span>{fr ? 'Mise par tirage' : 'Wager per draw'}</span>
                    <div className="option-buttons">
                      {definition.play.wagerOptionsCents?.map((amount) => (
                        <button
                          aria-pressed={wagerCents === amount}
                          className="option-button"
                          key={amount}
                          onClick={() => setWagerCents(amount)}
                          type="button"
                        >
                          {formatMoney(amount)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    {fr ? 'Nombre de tirages' : 'Number of draws'}
                    <input
                      aria-label={fr ? 'Nombre de tirages' : 'Number of draws'}
                      max={definition.play.maxAdvanceDraws}
                      min="1"
                      onChange={(event) =>
                        setDrawCount(
                          Math.min(
                            definition.play.maxAdvanceDraws ?? 99,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        )
                      }
                      type="number"
                      value={drawCount}
                    />
                  </label>
                  <label>
                    <input
                      checked={kenoPatternPlay}
                      onChange={(event) => {
                        setKenoPatternPlay(event.target.checked);
                        setKenoBonus(false);
                        setWagerCents(event.target.checked ? 200 : definition.play.basePriceCents);
                        setSelections(emptySelections(1));
                        setActiveSelectionIndex(0);
                      }}
                      type="checkbox"
                    />{' '}
                    Pattern Play ({fr ? '2 $ par tirage' : '$2 per draw'})
                  </label>
                </section>
              )}

              <div className="transaction-total">
                <span>Total</span>
                <strong>{formatMoney(baseCostCents)}</strong>
              </div>
              <div className="workflow-actions">
                <button className="text-button" onClick={onBack} type="button">
                  {fr ? 'Annuler la transaction' : 'Cancel Transaction'}
                </button>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setStep('numbers')}
                    type="button"
                  >
                    {fr ? 'Choisir les numéros' : 'Choose Numbers'}
                  </button>
                  <span>{fr ? 'ou' : 'or'}</span>
                  <button
                    className="primary-button"
                    onClick={() => quickPickAll(true)}
                    type="button"
                  >
                    Quick Pick
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 'numbers' && (
            <section aria-labelledby="numbers-title">
              <div className="workspace-heading">
                <h2 id="numbers-title">{fr ? 'Choisir les numéros' : 'Choose Numbers'}</h2>
                <button className="secondary-button" onClick={() => quickPickAll()} type="button">
                  ↝ {fr ? 'Sélectionner tous les numéros automatiquement' : 'Auto Pick All Numbers'}
                </button>
              </div>
              <div className="advanced-random-toolbar">
                <button
                  aria-expanded={advancedPanelOpen}
                  className="secondary-button"
                  onClick={() => setAdvancedPanelOpen((open) => !open)}
                  type="button"
                >
                  {fr ? 'Sélection aléatoire avancée' : 'Advanced Random'}
                </button>
                <span>
                  {fr
                    ? 'Définissez le nombre de numéros et la plage pour chaque groupe.'
                    : 'Set a number count and range for each random group.'}
                </span>
              </div>
              {advancedPanelOpen && (
                <section
                  className="advanced-random-panel"
                  aria-label={
                    fr ? 'Paramètres de sélection aléatoire avancée' : 'Advanced random settings'
                  }
                >
                  <div className="advanced-random-panel__heading">
                    <div>
                      <h3>{fr ? 'Groupes aléatoires personnalisés' : 'Custom random groups'}</h3>
                      <p>
                        {fr
                          ? `Chaque groupe choisit des numéros distincts dans sa plage. Cette sélection nécessite ${requiredNumbers} numéros au total.`
                          : `Each group picks unique numbers from its range. This selection needs ${requiredNumbers} numbers in total.`}
                      </p>
                    </div>
                    <strong>
                      {configuredRandomNumbers}/{requiredNumbers}
                    </strong>
                  </div>
                  <div className="advanced-random-groups">
                    {advancedGroups.map((group, index) => (
                      <div className="advanced-random-group" key={index}>
                        <strong>{fr ? `Groupe ${index + 1}` : `Group ${index + 1}`}</strong>
                        <label>
                          {fr ? 'Nombre de numéros' : 'Number count'}
                          <input
                            max={requiredNumbers - advancedGroups.length + 1}
                            min="1"
                            onChange={(event) =>
                              updateAdvancedGroupCount(index, Number(event.target.value) || 1)
                            }
                            type="number"
                            value={group.count}
                          />
                        </label>
                        <label>
                          {fr ? 'De' : 'From'}
                          <input
                            max={definition.draw.mainNumbers.max}
                            min={definition.draw.mainNumbers.min}
                            onChange={(event) => {
                              const min = Number(event.target.value);
                              setAdvancedGroups((current) =>
                                current.map((item, groupIndex) =>
                                  groupIndex === index ? { ...item, min } : item,
                                ),
                              );
                              setAdvancedReport(null);
                              setAdvancedError(null);
                            }}
                            type="number"
                            value={group.min}
                          />
                        </label>
                        <label>
                          {fr ? 'À' : 'To'}
                          <input
                            max={definition.draw.mainNumbers.max}
                            min={definition.draw.mainNumbers.min}
                            onChange={(event) => {
                              const max = Number(event.target.value);
                              setAdvancedGroups((current) =>
                                current.map((item, groupIndex) =>
                                  groupIndex === index ? { ...item, max } : item,
                                ),
                              );
                              setAdvancedReport(null);
                              setAdvancedError(null);
                            }}
                            type="number"
                            value={group.max}
                          />
                        </label>
                        {advancedGroups.length > 1 && (
                          <button
                            aria-label={
                              fr ? `Supprimer le groupe ${index + 1}` : `Remove group ${index + 1}`
                            }
                            className="advanced-random-group__remove"
                            onClick={() => removeAdvancedGroup(index)}
                            type="button"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="advanced-random-actions">
                    <button
                      className="text-button"
                      disabled={advancedGroups.every((group) => group.count < 2)}
                      onClick={addAdvancedGroup}
                      type="button"
                    >
                      + {fr ? 'Ajouter un groupe' : 'Add group'}
                    </button>
                    <button
                      className="primary-button"
                      disabled={!advancedRangesValid}
                      onClick={generateAdvancedPicks}
                      type="button"
                    >
                      {fr ? 'Générer les numéros' : 'Generate advanced picks'}
                    </button>
                  </div>
                  {!advancedRangesValid && (
                    <p className="advanced-random-validation" role="status">
                      {configuredRandomNumbers !== requiredNumbers
                        ? fr
                          ? `Le total des groupes doit être de ${requiredNumbers} numéros.`
                          : `Group counts must add up to ${requiredNumbers}.`
                        : fr
                          ? 'Vérifiez que chaque plage respecte les limites du jeu et contient assez de numéros distincts.'
                          : 'Check that every range is within this game’s number pool and can fit its group’s unique picks.'}
                    </p>
                  )}
                  {advancedError && (
                    <p className="error-banner" role="alert">
                      {advancedError}
                    </p>
                  )}
                </section>
              )}
              <div className="number-picker-layout">
                <div className="selection-card">
                  <div className="selection-card__chosen">
                    {Array.from({ length: requiredNumbers }, (_, index) => (
                      <span
                        className={
                          activeSelection.mainNumbers[index] === undefined ? '' : 'is-filled'
                        }
                        key={index}
                      >
                        {activeSelection.mainNumbers[index]?.toString().padStart(2, '0') ?? ''}
                      </span>
                    ))}
                  </div>
                  <div className="selection-card__tools">
                    <button
                      type="button"
                      onClick={() => updateActive(quickPickSelection(activeSelectionIndex))}
                    >
                      ↝ Auto Pick
                    </button>
                    <strong>{definition.displayName}</strong>
                    <button type="button" onClick={() => updateActive({ mainNumbers: [] })}>
                      {fr ? 'Effacer' : 'Clear'}
                    </button>
                  </div>
                  <div
                    className="number-grid"
                    aria-label={`${definition.displayName} ${fr ? 'sélecteur de numéros' : 'number picker'}`}
                  >
                    {numberOptions.map((number) => (
                      <button
                        aria-pressed={activeSelection.mainNumbers.includes(number)}
                        key={number}
                        onClick={() => toggleNumber(number)}
                        type="button"
                      >
                        {number.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="selection-summary">
                  <div className="game-mini">{definition.displayName}</div>
                  <span>
                    {formatMoney(wagerCents)} {fr ? 'par jeu' : 'per Play'}
                  </span>
                  <strong>{formatMoney(baseCostCents)}</strong>
                  {definition.id === 'lotto-649' && (
                    <p>
                      {fr
                        ? 'Les numéros Classic participent aussi au tirage Gold Ball.'
                        : 'Classic numbers are also entered in the Gold Ball Draw.'}
                    </p>
                  )}
                  {definition.id === 'daily-grand' && (
                    <p>
                      {fr
                        ? 'Le GRAND NUMBER est généré par le système lors de l’émission du billet.'
                        : 'A GRAND NUMBER is generated when the ticket is issued.'}
                    </p>
                  )}
                </div>
              </div>
              {advancedReport && (
                <section className="advanced-history" aria-live="polite">
                  <div className="advanced-history__heading">
                    <div>
                      <p className="eyebrow">HISTORICAL PERFORMANCE</p>
                      <h3>
                        {fr
                          ? 'Historique de vos sélections avancées'
                          : 'Historical record of your advanced picks'}
                      </h3>
                    </div>
                    {historyDraws.length > 0 && historicalGameId && (
                      <span>
                        {fr
                          ? `${historicalGameConfig[historicalGameId].label} · ${historyDraws.length} tirages · du ${historicalRange.from} au ${historicalRange.to}`
                          : `${historicalGameConfig[historicalGameId].label} · ${historyDraws.length} draws · ${historicalRange.from} to ${historicalRange.to}`}
                      </span>
                    )}
                  </div>
                  {historyDraws.length === 0 ? (
                    <p className="analysis-empty">
                      {fr
                        ? 'Aucun instantané historique officiel n’est disponible pour ce jeu; les fréquences ne peuvent pas être calculées.'
                        : 'No historical number snapshot is available for this game, so past frequencies cannot be calculated.'}
                    </p>
                  ) : (
                    <div className="advanced-history__selections">
                      {selectionHistory.map((record, index) => (
                        <article className="advanced-history-card" key={index}>
                          {selectionHistory.length > 1 && (
                            <h4>{selectionLabel(index, selectionsPerPlay)}</h4>
                          )}
                          <div className="advanced-history-card__balls">
                            {record.numberCounts.map(({ number, count }) => (
                              <span key={number}>
                                <strong>{number.toString().padStart(2, '0')}</strong>
                                <small>
                                  {count}/{record.drawsAnalyzed}
                                  {record.drawsAnalyzed > 0
                                    ? ` · ${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format((count / record.drawsAnalyzed) * 100)}%`
                                    : ''}
                                </small>
                              </span>
                            ))}
                          </div>
                          {record.expandedLineCount !== undefined ? (
                            <p>
                              {fr
                                ? `Parmi les ${record.expandedLineCount} combinaisons Combo générées, ${record.previouslyDrawnLineCount} sont déjà sorties intégralement; la plus fréquente est sortie ${record.bestLineFrequency} fois.`
                                : `Of ${record.expandedLineCount} expanded Combo lines, ${record.previouslyDrawnLineCount} appeared in full among historical main numbers; the most frequent line appeared ${record.bestLineFrequency} time(s).`}
                            </p>
                          ) : (
                            <p>
                              {fr
                                ? `Tous les numéros de la sélection sont sortis ensemble dans ${record.coOccurrenceCount} des ${record.drawsAnalyzed} tirages historiques.`
                                : `The full set appeared together in ${record.coOccurrenceCount} of ${record.drawsAnalyzed} historical draws.`}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                  <p className="analysis-method-note">
                    {fr
                      ? 'Les fréquences décrivent uniquement les résultats officiels conservés localement; elles ne prédisent pas les probabilités futures et ne garantissent aucun gain.'
                      : 'Historical frequencies describe the official draws stored locally; they do not predict future odds or guarantee a prize.'}
                  </p>
                </section>
              )}
              <div
                className="play-tabs"
                aria-label={fr ? 'Éditeur de sélections' : 'Selection editor'}
              >
                {selections.map((selection, index) => (
                  <button
                    aria-current={index === activeSelectionIndex ? 'true' : undefined}
                    className="play-tab"
                    key={index}
                    onClick={() => setActiveSelectionIndex(index)}
                    type="button"
                  >
                    {selectionLabel(index, selectionsPerPlay)}
                    <span
                      className={
                        selection.mainNumbers.length === requiredNumbers ? 'is-complete' : ''
                      }
                    >
                      {selection.mainNumbers.length}/{requiredNumbers}
                    </span>
                  </button>
                ))}
              </div>
              {message && (
                <p className="inline-message" role="status">
                  {message}
                </p>
              )}
              <div className="transaction-total">
                <span>Total</span>
                <strong>{formatMoney(baseCostCents)}</strong>
              </div>
              <div className="workflow-actions">
                <button className="text-button" onClick={onBack} type="button">
                  {fr ? 'Annuler la transaction' : 'Cancel Transaction'}
                </button>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setStep('setup')}
                    type="button"
                  >
                    {fr ? 'Retour' : 'Back'}
                  </button>
                  <button
                    className="primary-button"
                    disabled={!complete}
                    onClick={() => setStep('extras')}
                    type="button"
                  >
                    {fr ? 'Continuer' : 'Continue'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 'extras' && (
            <section aria-labelledby="extra-title">
              <h2 id="extra-title">{fr ? 'Ajouter des options' : 'Add EXTRA'}</h2>
              {definition.id !== 'keno' ? (
                <div className="extra-card">
                  <div>
                    <strong>EXTRA</strong>
                    <p>
                      {fr
                        ? '1 $ par jeu. Un numéro EXTRA à quatre chiffres est généré pour vous.'
                        : '$1 each. A four-digit EXTRA number is generated for you.'}
                    </p>
                  </div>
                  <label>
                    {fr ? 'Quantité' : 'Quantity'}
                    <select
                      aria-label={fr ? 'Quantité EXTRA' : 'EXTRA quantity'}
                      onChange={(event) => setExtraPlayCount(Number(event.target.value))}
                      value={extraPlayCount}
                    >
                      {Array.from({ length: 11 }, (_, count) => (
                        <option key={count} value={count}>
                          {count === 0 ? (fr ? 'Aucun EXTRA' : 'No EXTRA') : `${count} × $1`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="extra-card">
                  <div>
                    <strong>Keno Bonus</strong>
                    <p>
                      {fr
                        ? 'Doublez la mise pour participer au tirage avec multiplicateur.'
                        : 'Double the wager to enter the multiplier draw.'}
                    </p>
                  </div>
                  <label className="switch-label">
                    <input
                      aria-label="Keno Bonus"
                      checked={kenoBonus}
                      disabled={kenoPatternPlay}
                      onChange={(event) => setKenoBonus(event.target.checked)}
                      type="checkbox"
                    />
                    {kenoBonus ? (fr ? 'Ajouté' : 'Added') : fr ? 'Non merci' : 'No thanks'}
                  </label>
                </div>
              )}
              <div className="transaction-total">
                <span>Total</span>
                <strong>{formatMoney(totalCostCents)}</strong>
              </div>
              <div className="workflow-actions">
                <button className="text-button" onClick={onBack} type="button">
                  {fr ? 'Annuler la transaction' : 'Cancel Transaction'}
                </button>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setStep('numbers')}
                    type="button"
                  >
                    {fr ? 'Retour' : 'Back'}
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setStep('review')}
                    type="button"
                  >
                    {fr ? 'Continuer' : 'Continue'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 'review' && (
            <section aria-labelledby="review-title">
              <h2 id="review-title">{fr ? 'Vérifier et confirmer' : 'Review and Confirm'}</h2>
              <div className="review-card">
                <div className={`game-lockup game-lockup--${definition.id}`}>
                  <strong>{definition.displayName}</strong>
                  <small>{drawId}</small>
                </div>
                <dl>
                  <div>
                    <dt>{fr ? 'Nombre de jeux' : 'Number of Plays'}</dt>
                    <dd>{numberOfPlays}</dd>
                  </div>
                  <div>
                    <dt>Selections</dt>
                    <dd>{pricedSelectionCount}</dd>
                  </div>
                  <div>
                    <dt>EXTRA</dt>
                    <dd>{extraPlayCount}</dd>
                  </div>
                  <div>
                    <dt>{fr ? 'Tirages' : 'Draws'}</dt>
                    <dd>{drawCount}</dd>
                  </div>
                </dl>
                <div className="review-numbers">
                  {selections.map((selection, index) => (
                    <p key={index}>
                      <span>{selectionLabel(index, selectionsPerPlay)}</span>
                      {selection.mainNumbers.map((number) => (
                        <strong key={number}>{number.toString().padStart(2, '0')}</strong>
                      ))}
                    </p>
                  ))}
                </div>
              </div>
              <div className="transaction-total">
                <span>Total</span>
                <strong>{formatMoney(totalCostCents)}</strong>
                <small>
                  {fr ? 'Solde virtuel' : 'Virtual balance'} {formatMoney(wallet.balanceCents)}
                </small>
              </div>
              <div className="workflow-actions">
                <button className="text-button" onClick={onBack} type="button">
                  {fr ? 'Annuler la transaction' : 'Cancel Transaction'}
                </button>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setStep('extras')}
                    type="button"
                  >
                    {fr ? 'Retour' : 'Back'}
                  </button>
                  <button
                    className="primary-button"
                    disabled={wallet.balanceCents < totalCostCents}
                    onClick={purchase}
                    type="button"
                  >
                    {fr ? 'Confirmer l’achat' : 'Confirm Purchase'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 'complete' && (
            <section className="purchase-complete">
              <span aria-hidden="true">✓</span>
              <h2>{fr ? 'Achat terminé' : 'Purchase Complete'}</h2>
              <p>{message}</p>
              <div>
                <button className="secondary-button" onClick={onTickets} type="button">
                  {fr ? 'Voir mes billets' : 'View My Tickets'}
                </button>
                <button className="primary-button" disabled={!!draw} onClick={onDraw} type="button">
                  {fr ? 'Simuler le tirage' : 'Simulate Draw'}
                </button>
              </div>
            </section>
          )}
        </section>

        <aside className="purchase-sidebar">
          <section>
            <span>{fr ? 'Billets pour ce tirage' : 'Tickets for this draw'}</span>
            <strong>{currentTickets.length}</strong>
            <small>{drawId}</small>
            {currentTickets.length > 0 && !draw && step !== 'complete' && (
              <button className="primary-button" onClick={onDraw} type="button">
                {fr ? 'Simuler le tirage' : 'Simulate Draw'}
              </button>
            )}
          </section>
          <section>
            <span>{fr ? 'Heure locale actuelle' : 'Current local time'}</span>
            <strong>{formatDateTime(scheduledAt)}</strong>
          </section>
          {draw && (
            <section className="draw-result">
              <h2>{fr ? 'Tirage terminé' : 'Draw complete'}</h2>
              <div
                className="result-balls"
                aria-label={fr ? 'Numéros gagnants' : 'Winning numbers'}
              >
                {draw.mainNumbers.slice(0, revealedCount).map((number) => (
                  <span
                    className={ticketNumbers.has(number) ? 'result-ball--hit' : ''}
                    key={number}
                  >
                    {number}
                  </span>
                ))}
                {revealedCount >= draw.mainNumbers.length && draw.bonusNumber !== undefined && (
                  <span className="result-ball--bonus">{draw.bonusNumber}</span>
                )}
                {revealedCount >= draw.mainNumbers.length && draw.specialNumber !== undefined && (
                  <span className="result-ball--special">{draw.specialNumber}</span>
                )}
              </div>
              {revealedCount < draw.mainNumbers.length && (
                <button
                  className="text-button"
                  onClick={() => setRevealedCount(draw.mainNumbers.length)}
                  type="button"
                >
                  {fr ? 'Passer l’animation' : 'Skip animation'}
                </button>
              )}
              <button className="primary-button" onClick={onNextDraw} type="button">
                {fr ? 'Commencer le prochain tirage' : 'Start next draw'}
              </button>
            </section>
          )}
          {settlement?.supplementaryDraw && (
            <section>
              <h2>{fr ? 'Détails du tirage supplémentaire' : 'Add-on draw audit'}</h2>
              {settlement.supplementaryDraw.extraNumbers && (
                <p>
                  {fr ? 'Tirage EXTRA : ' : 'EXTRA draw: '}
                  {settlement.supplementaryDraw.extraNumbers.join(' · ')}
                </p>
              )}
              {settlement.supplementaryDraw.kenoBonusMultiplier !== undefined && (
                <p>
                  {fr ? 'Bonus Keno : ×' : 'Keno Bonus: ×'}
                  {settlement.supplementaryDraw.kenoBonusMultiplier}
                </p>
              )}
            </section>
          )}
          {definition.id === 'lotto-649' && goldBallCycle && goldBallDraw && (
            <section className="gold-result">
              <h2>{fr ? 'Tirage Gold Ball terminé' : 'Gold Ball draw complete'}</h2>
              <strong>{goldBallDraw.winningDrawNumber}</strong>
              <p>
                {fr ? 'Résultat : ' : 'Drawn: '}
                {goldBallDraw.prizeBall === 'gold'
                  ? ' Gold Ball'
                  : fr
                    ? 'Boule blanche'
                    : 'White Ball'}{' '}
                · {formatMoney(goldBallDraw.prizeCents)}
              </p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
