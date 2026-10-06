import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface DataManagementPanelProps {
  readonly status: string;
  readonly onClose: () => void;
  readonly onExport: () => void;
  readonly onImport: (file: File) => Promise<string | null>;
  readonly onReset: () => Promise<void>;
}

export function DataManagementPanel({
  status,
  onClose,
  onExport,
  onImport,
  onReset,
}: DataManagementPanelProps) {
  const { language } = useI18n();
  const fr = language === 'fr';
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    const error = await onImport(file);
    setMessage(
      error ??
        (fr
          ? 'Importation terminée. Les billets, résultats, le solde et l’heure de simulation ont été restaurés.'
          : 'Import complete. Tickets, results, balance and simulation time were restored.'),
    );
    event.target.value = '';
  }

  function keepFocusInside(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-describedby="data-management-description"
        aria-labelledby="data-management-title"
        aria-modal="true"
        className="data-panel"
        onKeyDown={keepFocusInside}
        role="dialog"
      >
        <header className="data-panel__header">
          <div>
            <p className="eyebrow">LOCAL DATA</p>
            <h2 id="data-management-title">{fr ? 'Sauvegarde et données' : 'Save & Data'}</h2>
          </div>
          <button
            aria-label={fr ? 'Fermer la gestion des données' : 'Close data management'}
            className="text-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            {fr ? 'Fermer' : 'Close'}
          </button>
        </header>
        <p id="data-management-description">
          {fr
            ? 'La sauvegarde reste dans ce navigateur. Les données importées sont validées avant leur restauration.'
            : 'Your save remains in this browser. Imports are validated before tickets, wallet history or game state are accepted.'}
        </p>
        <p aria-live="polite" className="save-status">
          {status}
        </p>
        <div className="data-panel__actions">
          <button className="secondary-button" onClick={onExport} type="button">
            {fr ? 'Exporter JSON' : 'Export JSON'}
          </button>
          <button
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {fr ? 'Importer JSON' : 'Import JSON'}
          </button>
          <input
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => void handleImport(event)}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
        </div>
        <div className="danger-zone">
          <strong>{fr ? 'Réinitialiser la simulation locale' : 'Reset local simulation'}</strong>
          <p>
            {fr
              ? 'Effacer les billets, les résultats et le portefeuille, puis rétablir le solde virtuel de 1 000 $. Cette action est irréversible.'
              : 'Clear tickets, results and wallet history, then restore the $1,000 virtual balance. This cannot be undone.'}
          </p>
          {confirmReset ? (
            <div className="data-panel__actions">
              <button
                className="primary-button danger-button"
                onClick={() => void onReset().then(onClose)}
                type="button"
              >
                {fr ? 'Confirmer la réinitialisation' : 'Permanently Reset'}
              </button>
              <button className="text-button" onClick={() => setConfirmReset(false)} type="button">
                {fr ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          ) : (
            <button
              className="text-button text-button--danger"
              onClick={() => setConfirmReset(true)}
              type="button"
            >
              {fr ? 'Réinitialiser toutes les données' : 'Reset All Data'}
            </button>
          )}
        </div>
        {message && (
          <p aria-live="assertive" className="inline-message">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
