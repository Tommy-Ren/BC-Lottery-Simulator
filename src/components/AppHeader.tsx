import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatMoney } from '../app/formatters';
import { useI18n } from '../i18n/I18nContext';

interface AppHeaderProps {
  readonly balanceCents: number;
  readonly ticketCount: number;
  readonly tokenCents: number;
  readonly heldCents: number;
  readonly spentCents: number;
  readonly onHome: () => void;
  readonly onStatistics: () => void;
  readonly onTickets: () => void;
  readonly onData: () => void;
  readonly onDeposit: (amountCents: number) => string | null;
}

export function AppHeader({
  balanceCents,
  ticketCount,
  tokenCents,
  heldCents,
  spentCents,
  onHome,
  onStatistics,
  onTickets,
  onData,
  onDeposit,
}: AppHeaderProps) {
  const { language, t, toggleLanguage } = useI18n();
  const fr = language === 'fr';
  const [accountOpen, setAccountOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100');
  const [depositMessage, setDepositMessage] = useState('');
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen]);

  function submitDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dollars = Number(depositAmount);
    if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 1_000_000) {
      setDepositMessage(
        fr
          ? 'Saisissez un montant de 0,01 $ à 1 000 000 $.'
          : 'Enter an amount from $0.01 to $1,000,000.',
      );
      return;
    }
    const error = onDeposit(Math.round(dollars * 100));
    setDepositMessage(
      error ??
        (fr
          ? `${formatMoney(Math.round(dollars * 100))} a été ajouté à votre solde virtuel.`
          : `${formatMoney(Math.round(dollars * 100))} was added to virtual Cash.`),
    );
  }

  return (
    <>
      <div className="utility-bar">
        <span>{t('virtualOnly')}</span>
        <button type="button" onClick={toggleLanguage}>
          {t('language')}
        </button>
      </div>
      <header className="app-header">
        <button className="brand-button" type="button" onClick={onHome}>
          <span className="brand-button__diamond" aria-hidden="true" />
          <span>
            <strong>PLAYNOW</strong>
            <small>{fr ? 'Simulateur de loterie' : 'Lottery Simulator'}</small>
          </span>
        </button>
        <nav
          className="app-header__nav"
          aria-label={fr ? 'Navigation principale' : 'Primary navigation'}
        >
          <button type="button" onClick={onHome}>
            {t('lottery')}
          </button>
          <button type="button" onClick={onStatistics}>
            {t('winners')}
          </button>
          <button type="button" onClick={onTickets}>
            {t('tickets')} <span>{ticketCount}</span>
          </button>
        </nav>
        <div className="account-menu" ref={accountRef}>
          <button
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            aria-label={`${t('account')} ${formatMoney(balanceCents)}`}
            className="account-pill"
            onClick={() => setAccountOpen((current) => !current)}
            type="button"
          >
            <span aria-hidden="true">●</span> {formatMoney(balanceCents)}{' '}
            <span aria-hidden="true">▾</span>
          </button>
          {accountOpen && (
            <section
              aria-label={fr ? 'Compte local' : 'Local account'}
              className="account-popover"
              role="dialog"
            >
              <div className="account-popover__header">
                <div>
                  <h2>{fr ? 'Bonjour, invité' : 'Hi, Guest'}</h2>
                  <span>{t('localMode')}</span>
                </div>
                <button
                  aria-label={fr ? 'Fermer le compte' : 'Close account'}
                  className="account-close"
                  onClick={() => setAccountOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <div className="account-metrics">
                <div>
                  <span>{fr ? 'Argent' : 'Cash'}</span>
                  <strong>{formatMoney(balanceCents)}</strong>
                </div>
                <div>
                  <span>{fr ? 'Jetons' : 'Token'}</span>
                  <strong>{formatMoney(tokenCents)}</strong>
                </div>
                <div>
                  <span>{fr ? 'Retenu' : 'Held'}</span>
                  <strong>{formatMoney(heldCents)}</strong>
                </div>
                <div>
                  <span>{fr ? 'Dépensé (argent + retenu)' : 'Spent (Cash + Held)'}</span>
                  <strong>{formatMoney(spentCents)}</strong>
                </div>
              </div>
              <form className="quick-deposit" onSubmit={submitDeposit}>
                <label htmlFor="quick-deposit-amount">
                  {fr ? 'Ajouter des fonds virtuels' : 'Add virtual Cash'}
                </label>
                <div>
                  <span>$</span>
                  <input
                    id="quick-deposit-amount"
                    inputMode="decimal"
                    min="0.01"
                    max="1000000"
                    onChange={(event) => setDepositAmount(event.target.value)}
                    step="0.01"
                    type="number"
                    value={depositAmount}
                  />
                  <button type="submit">{fr ? 'Dépôt rapide' : 'Quick Deposit'}</button>
                </div>
                {depositMessage && <small role="status">{depositMessage}</small>}
              </form>
              <div className="account-actions account-actions--official">
                <button type="button" onClick={onData}>
                  <span>⚙</span>
                  {fr ? 'Mon compte' : 'My Account'}
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('quick-deposit-amount')?.focus()}
                >
                  <span>▣</span>
                  {fr ? 'Dépôt' : 'Deposit'}
                </button>
                <button type="button" disabled>
                  <span>▤</span>
                  {fr ? 'Retrait' : 'Withdraw'}
                </button>
                <button type="button" disabled>
                  <span>↗</span>
                  {fr ? 'Mes budgets' : 'My Budgets'}
                </button>
                <button type="button" disabled>
                  <span>◆</span>
                  {fr ? 'Promotions' : 'Promotions'}
                </button>
                <button type="button" onClick={onData}>
                  <span>↶</span>
                  {fr ? 'Historique du compte' : 'Account History'}
                </button>
              </div>
              <p className="account-local-note">{t('accountHint')}</p>
            </section>
          )}
        </div>
      </header>
    </>
  );
}
