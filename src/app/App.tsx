import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { DataManagementPanel } from '../components/DataManagementPanel';
import { getLotteryDefinition } from '../data/definitions/lotteries';
import { applyWalletCommand } from '../domain/economy/wallet';
import { generateDraw } from '../domain/lottery/engine';
import { defaultNationalPoolInput, generateSupplementaryDraw } from '../domain/lottery/features';
import { conductGoldBallDraw } from '../domain/lottery/goldBall';
import {
  purchaseTicket,
  settleTicketsForDraw,
  type PlayableLotteryId,
} from '../domain/lottery/tickets';
import type { LotterySelection } from '../domain/lottery/types';
import type { GameStateRepository } from '../storage/gameStateRepository';
import {
  createGameStateSnapshot,
  parseGameStateJson,
  serializeGameState,
  type AppGameState,
  type GameStateSnapshot,
} from '../storage/gameStateSnapshot';
import { gameStateRepository } from '../storage/indexedDbGameStateRepository';
import { useI18n } from '../i18n/I18nContext';
import { createInitialGameState } from './initialGameState';
import { LobbyPage } from './pages/LobbyPage';
import { PlayPage, type PurchaseOptions } from './pages/PlayPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { HistoricalDataPage } from './pages/HistoricalDataPage';
import type { HistoricalGameId } from '../data/history/historicalDraws';
import { RulesPage } from './pages/RulesPage';
import { TicketsPage } from './pages/TicketsPage';

type View =
  | { readonly name: 'lobby' }
  | { readonly name: 'tickets' }
  | { readonly name: 'statistics' }
  | {
      readonly name: 'historical-data';
      readonly gameId: HistoricalGameId;
      readonly from: string;
      readonly to: string;
      readonly combinationSize: number;
    }
  | { readonly name: 'rules'; readonly lotteryId: PlayableLotteryId }
  | { readonly name: 'play'; readonly lotteryId: PlayableLotteryId; readonly drawId: string };

interface AppProps {
  readonly repository?: GameStateRepository<GameStateSnapshot>;
}

const simulatedGoldBallJackpotCents = 1_000_000_000;

function formatDrawId(lotteryId: PlayableLotteryId, cycle: number): string {
  return `${lotteryId}-sim-${cycle.toString().padStart(3, '0')}`;
}

export function App({ repository = gameStateRepository }: AppProps) {
  const { t, language } = useI18n();
  const fr = language === 'fr';
  const [view, setView] = useState<View>({ name: 'lobby' });
  const [gameState, setGameState] = useState<AppGameState>(createInitialGameState);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(
    fr ? 'Lecture de la sauvegarde locale…' : 'Loading local save…',
  );
  const [accountMessage, setAccountMessage] = useState('');
  const hydrationStarted = useRef(false);
  const hydrationComplete = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const focusBeforeDialog = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (hydrationStarted.current) return;
    hydrationStarted.current = true;
    void repository
      .load()
      .then((snapshot) => {
        if (snapshot) {
          setGameState(snapshot.state);
          setSaveStatus(fr ? 'Sauvegarde locale restaurée' : 'Local save restored');
        } else {
          setSaveStatus(fr ? 'Sauvegarde locale prête' : 'Local save ready');
        }
      })
      .catch((error: unknown) => {
        setSaveStatus(
          error instanceof Error
            ? `${fr ? 'Échec du chargement' : 'Load failed'}: ${error.message}`
            : fr
              ? 'Échec du chargement de la sauvegarde'
              : 'Could not load local save',
        );
      })
      .finally(() => {
        hydrationComplete.current = true;
      });
  }, [fr, repository]);

  useEffect(() => {
    if (!hydrationComplete.current) return;
    setSaveStatus(fr ? 'Enregistrement…' : 'Saving…');
    const timer = window.setTimeout(() => {
      void repository
        .save(createGameStateSnapshot(gameState))
        .then(() => {
          setSaveStatus(
            fr
              ? 'Sauvegardé automatiquement dans ce navigateur'
              : 'Automatically saved in this browser',
          );
        })
        .catch((error: unknown) => {
          setSaveStatus(
            error instanceof Error
              ? `${fr ? 'Échec de la sauvegarde automatique' : 'Autosave failed'}: ${error.message}`
              : fr
                ? 'Échec de la sauvegarde automatique'
                : 'Autosave failed',
          );
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [fr, gameState, repository]);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [view]);

  const { ticketStore, drawCycles, drawResults, goldBallCycle, goldBallResults } = gameState;
  const currentDrawIds = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(drawCycles) as PlayableLotteryId[]).map((lotteryId) => [
          lotteryId,
          formatDrawId(lotteryId, drawCycles[lotteryId]),
        ]),
      ) as Record<PlayableLotteryId, string>,
    [drawCycles],
  );
  function openPlay(lotteryId: PlayableLotteryId): void {
    setView({ name: 'play', lotteryId, drawId: currentDrawIds[lotteryId] });
  }

  function openDataPanel(): void {
    focusBeforeDialog.current = document.activeElement as HTMLElement | null;
    setDataPanelOpen(true);
  }

  function closeDataPanel(): void {
    setDataPanelOpen(false);
    window.requestAnimationFrame(() => focusBeforeDialog.current?.focus());
  }

  function handleDeposit(amountCents: number): string | null {
    try {
      setGameState((current) => ({
        ...current,
        ticketStore: {
          ...current.ticketStore,
          wallet: applyWalletCommand(current.ticketStore.wallet, {
            id: `quick-deposit-${crypto.randomUUID()}`,
            type: 'grant',
            amountCents,
            occurredAt: new Date().toISOString(),
            referenceId: 'local-quick-deposit',
          }),
        },
      }));
      setAccountMessage(`Quick Deposit ${amountCents} cents completed.`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Deposit failed.';
    }
  }

  function handlePurchase(
    lotteryId: PlayableLotteryId,
    drawId: string,
    selections: readonly LotterySelection[],
    options: PurchaseOptions = {},
  ): string | null {
    try {
      const id = crypto.randomUUID();
      const drawCount = options.drawCount ?? 1;
      const firstCycle = drawCycles[lotteryId];
      const drawIds = Array.from({ length: drawCount }, (_, index) =>
        formatDrawId(lotteryId, firstCycle + index),
      );
      if (drawIds[0] !== drawId) throw new Error('This draw is no longer open for purchase.');
      const nextStore = purchaseTicket(ticketStore, getLotteryDefinition(lotteryId), {
        commandId: id,
        ticketId: `ticket-${id}`,
        lotteryId,
        drawId,
        drawIds,
        wagerCents: options.wagerCents,
        addOns: options.addOns,
        purchasedAt: new Date().toISOString(),
        selections,
      });
      setGameState((current) => ({ ...current, ticketStore: nextStore }));
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : fr
          ? 'Échec de l’achat. Réessayez.'
          : 'Purchase failed. Please try again.';
    }
  }

  function settleCurrentDraw(lotteryId: PlayableLotteryId, drawId: string): void {
    setGameState((current) => {
      const settledAt = new Date().toISOString();
      const definition = getLotteryDefinition(lotteryId);
      const draw = generateDraw(definition, `simulated:${drawId}:${settledAt}`);
      const supplementaryDraw = generateSupplementaryDraw(
        definition,
        drawId,
        `features:${drawId}:${settledAt}`,
        defaultNationalPoolInput(lotteryId),
      );
      let nextGoldBallCycle = current.goldBallCycle;
      let goldBallDraw;
      const nextGoldBallResults = { ...current.goldBallResults };
      if (lotteryId === 'lotto-649') {
        const issuedDrawNumbers = current.ticketStore.tickets
          .filter((ticket) => ticket.drawIds.includes(drawId))
          .flatMap((ticket) => ticket.goldBallDrawNumbers);
        const output = conductGoldBallDraw(nextGoldBallCycle, {
          drawId,
          seed: `gold-ball:${drawId}:${settledAt}`,
          issuedDrawNumbers,
          advertisedJackpotCents: simulatedGoldBallJackpotCents,
        });
        nextGoldBallCycle = output.state;
        goldBallDraw = output.result;
        nextGoldBallResults[drawId] = output.result;
      }
      const nextStore = settleTicketsForDraw(
        current.ticketStore,
        definition,
        drawId,
        draw,
        settledAt,
        goldBallDraw,
        supplementaryDraw,
      );
      return {
        ...current,
        ticketStore: nextStore,
        drawCycles: {
          ...current.drawCycles,
          [lotteryId]: current.drawCycles[lotteryId] + 1,
        },
        drawResults: { ...current.drawResults, [drawId]: draw },
        goldBallCycle: nextGoldBallCycle,
        goldBallResults: nextGoldBallResults,
        clock: { ...current.clock, now: settledAt },
      };
    });
  }

  function exportJson(): void {
    const blob = new Blob([serializeGameState(gameState)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bc-lottery-simulator-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File): Promise<string | null> {
    try {
      const snapshot = parseGameStateJson(await file.text());
      await repository.save(snapshot);
      setGameState(snapshot.state);
      setView({ name: 'lobby' });
      setSaveStatus(fr ? 'Importation terminée et sauvegardée' : 'Import complete and saved');
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : fr
          ? 'Échec de l’importation.'
          : 'Import failed.';
    }
  }

  async function resetGame(): Promise<void> {
    await repository.clear();
    setGameState(createInitialGameState());
    setView({ name: 'lobby' });
    setSaveStatus(fr ? 'Données locales réinitialisées' : 'Local data reset');
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('skip')}
      </a>
      <AppHeader
        balanceCents={ticketStore.wallet.balanceCents}
        heldCents={0}
        spentCents={ticketStore.wallet.transactions
          .filter((transaction) => transaction.type === 'ticket-purchase')
          .reduce((total, transaction) => total + Math.abs(transaction.amountCents), 0)}
        ticketCount={ticketStore.tickets.length}
        tokenCents={1_000}
        onData={openDataPanel}
        onDeposit={handleDeposit}
        onHome={() => setView({ name: 'lobby' })}
        onStatistics={() => setView({ name: 'statistics' })}
        onTickets={() => setView({ name: 'tickets' })}
      />
      <div id="main-content" ref={mainRef} tabIndex={-1}>
        {view.name === 'lobby' && (
          <LobbyPage
            onPlay={openPlay}
            onRules={(lotteryId) => setView({ name: 'rules', lotteryId })}
          />
        )}
        {view.name === 'statistics' && (
          <StatisticsPage
            onViewAll={(options) => setView({ name: 'historical-data', ...options })}
          />
        )}
        {view.name === 'historical-data' && (
          <HistoricalDataPage
            combinationSize={view.combinationSize}
            from={view.from}
            gameId={view.gameId}
            onBack={() => setView({ name: 'statistics' })}
            to={view.to}
          />
        )}
        {view.name === 'rules' && (
          <RulesPage
            definition={getLotteryDefinition(view.lotteryId)}
            onBack={() => setView({ name: 'lobby' })}
            onPlay={() => openPlay(view.lotteryId)}
          />
        )}
        {view.name === 'tickets' && (
          <TicketsPage tickets={ticketStore.tickets} onBack={() => setView({ name: 'lobby' })} />
        )}
        {view.name === 'play' && (
          <PlayPage
            key={`${view.lotteryId}:${view.drawId}`}
            definition={getLotteryDefinition(view.lotteryId)}
            drawId={view.drawId}
            wallet={ticketStore.wallet}
            tickets={ticketStore.tickets}
            draw={drawResults[view.drawId]}
            goldBallCycle={view.lotteryId === 'lotto-649' ? goldBallCycle : undefined}
            goldBallDraw={goldBallResults[view.drawId]}
            scheduledAt={new Date().toISOString()}
            onPurchase={(selections, options) =>
              handlePurchase(view.lotteryId, view.drawId, selections, options)
            }
            onDraw={() => settleCurrentDraw(view.lotteryId, view.drawId)}
            onNextDraw={() =>
              setView({
                name: 'play',
                lotteryId: view.lotteryId,
                drawId: currentDrawIds[view.lotteryId],
              })
            }
            onBack={() => setView({ name: 'lobby' })}
            onTickets={() => setView({ name: 'tickets' })}
          />
        )}
      </div>
      <span aria-live="polite" className="visually-hidden">
        {saveStatus} {accountMessage}
      </span>
      {dataPanelOpen && (
        <DataManagementPanel
          status={saveStatus}
          onClose={closeDataPanel}
          onExport={exportJson}
          onImport={importJson}
          onReset={resetGame}
        />
      )}
    </>
  );
}
