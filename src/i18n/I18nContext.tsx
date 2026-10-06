import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PlayableLotteryId } from '../domain/lottery/tickets';

export type Language = 'en' | 'fr';

const messages = {
  en: {
    skip: 'Skip to main content',
    brand: 'Lottery Simulator',
    virtualOnly: 'Virtual play only',
    lottery: 'Lottery',
    winners: 'Number Stats',
    tickets: 'My Tickets',
    data: 'Data',
    account: 'Account',
    guest: 'Guest',
    cash: 'Virtual Cash',
    localMode: 'Local mode · autosave enabled',
    accountHint: 'Data stays in this browser. No real account or money is involved.',
    myTickets: 'My Lottery Tickets',
    manageData: 'Save & Backup',
    language: 'Français',
    simulationTime: 'Local time',
    nextEvent: 'Next event',
    advance: 'Advance to next draw',
    chooseDraw: 'Choose a lottery to try',
    lobbySummary:
      'All five core lottery games are playable. Purchases, prizes and balances are entirely virtual.',
    availableGames: 'Available lottery games',
    playable: 'Ready to play',
    pick: 'Pick',
    perPlay: 'Per Play',
    draws: 'Draws',
    ruleVersion: 'Rules version',
    start: 'Start Playing',
    officialRules: 'Rules',
    statisticsTitle: 'Winning Number Statistics',
    statisticsSummary:
      'Choose a date range and explore number frequencies in historical official results.',
    mainNumbers: 'Main numbers',
    bonusNumbers: 'Bonus / Grand Number',
    drawHistory: 'Recent draws',
    frequency: 'Appearances',
    drawsCount: 'Draws analyzed',
    range: 'Date range',
    hot: 'Most frequent',
    cold: 'Least frequent',
    officialData: 'View official winning numbers',
    probabilityNote:
      'Past frequency does not change the odds of an independent draw or predict future results.',
    bonus: 'Bonus',
  },
  fr: {
    skip: 'Passer au contenu principal',
    brand: 'Simulateur de loterie',
    virtualOnly: 'Jeu virtuel seulement',
    lottery: 'Loterie',
    winners: 'Statistiques des numéros',
    tickets: 'Mes billets',
    data: 'Données',
    account: 'Compte',
    guest: 'Invité',
    cash: 'Argent virtuel',
    localMode: 'Mode local · sauvegarde automatique activée',
    accountHint: 'Les données restent dans ce navigateur. Aucun compte ni argent réel.',
    myTickets: 'Mes billets de loterie',
    manageData: 'Sauvegarder et exporter',
    language: 'English',
    simulationTime: 'Heure locale',
    nextEvent: 'Prochain tirage',
    advance: 'Passer au prochain tirage',
    chooseDraw: 'Choisissez une loterie',
    lobbySummary:
      'Les cinq jeux principaux sont disponibles. Les achats, les gains et les soldes sont entièrement virtuels.',
    availableGames: 'Jeux de loterie disponibles',
    playable: 'Prêt à jouer',
    pick: 'Choisir',
    perPlay: 'Par jeu',
    draws: 'Tirages',
    ruleVersion: 'Version des règles',
    start: 'Commencer',
    officialRules: 'Règles',
    statisticsTitle: 'Statistiques des numéros gagnants',
    statisticsSummary:
      'Choisissez une période pour consulter la fréquence des numéros dans les résultats officiels.',
    mainNumbers: 'Numéros principaux',
    bonusNumbers: 'Numéro bonus / Grand Number',
    drawHistory: 'Tirages récents',
    frequency: 'Occurrences',
    drawsCount: 'Tirages analysés',
    range: 'Période',
    hot: 'Les plus fréquents',
    cold: 'Les moins fréquents',
    officialData: 'Voir les numéros gagnants officiels',
    probabilityNote:
      'La fréquence passée ne change pas les probabilités d’un tirage indépendant et ne prédit pas les résultats futurs.',
    bonus: 'Bonus',
  },
} as const;

export type MessageKey = keyof (typeof messages)['en'];

const gameCopy: Record<
  Language,
  Record<PlayableLotteryId, { name: string; description: string }>
> = {
  en: {
    'lotto-max': {
      name: 'Lotto Max',
      description:
        'Each $6 Play includes four selections of 7 numbers from 1–52. Jackpot up to $90M.',
    },
    'lotto-649': {
      name: 'Lotto 6/49',
      description:
        'Each $3 Play includes one Classic Selection and a unique Gold Ball Draw Number.',
    },
    'bc-49': {
      name: 'BC/49',
      description: '$1 per 6/49 selection. Fixed $2M jackpot; draws Wednesday and Saturday.',
    },
    'daily-grand': {
      name: 'Daily Grand',
      description: '$3 per 5/49 selection, with a system-generated GRAND NUMBER from 1–7.',
    },
    keno: {
      name: 'Keno',
      description:
        'Pick 1–10 numbers from 1–80. Twenty numbers are drawn every 3 minutes 30 seconds.',
    },
  },
  fr: {
    'lotto-max': {
      name: 'Lotto Max',
      description:
        'Chaque jeu de 6 $ comprend quatre sélections de 7 numéros parmi 1 à 52. Gros lot pouvant atteindre 90 M$.',
    },
    'lotto-649': {
      name: 'Lotto 6/49',
      description:
        'Chaque jeu de 3 $ comprend une sélection Classic et un numéro de tirage Gold Ball unique.',
    },
    'bc-49': {
      name: 'BC/49',
      description:
        '1 $ par sélection de 6 numéros parmi 49. Gros lot fixe de 2 M$; tirages le mercredi et le samedi.',
    },
    'daily-grand': {
      name: 'Daily Grand',
      description:
        '3 $ par sélection de 5 numéros parmi 49, avec un GRAND NUMBER généré par le système de 1 à 7.',
    },
    keno: {
      name: 'Keno',
      description:
        'Choisissez de 1 à 10 numéros parmi 1 à 80. Vingt numéros sont tirés toutes les 3 min 30 s.',
    },
  },
};

// eslint-disable-next-line react-refresh/only-export-components
export function localizeGame(id: PlayableLotteryId, language: Language) {
  return gameCopy[language][id];
}

interface I18nValue {
  readonly language: Language;
  readonly locale: string;
  readonly setLanguage: (language: Language) => void;
  readonly toggleLanguage: () => void;
  readonly t: (key: MessageKey) => string;
}

const fallbackValue: I18nValue = {
  language: 'en',
  locale: 'en-CA',
  setLanguage: () => undefined,
  toggleLanguage: () => undefined,
  t: (key) => messages.en[key],
};

const I18nContext = createContext<I18nValue>(fallbackValue);

function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem('bc-lottery-language') === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language === 'fr' ? 'fr-CA' : 'en-CA';
  }, [language]);
  const value = useMemo<I18nValue>(() => {
    const setLanguage = (next: Language) => {
      try {
        window.localStorage.setItem('bc-lottery-language', next);
      } catch {
        // Language switching still works if browser storage is unavailable.
      }
      document.documentElement.lang = next === 'fr' ? 'fr-CA' : 'en-CA';
      setLanguageState(next);
    };
    return {
      language,
      locale: language === 'fr' ? 'fr-CA' : 'en-CA',
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'fr' ? 'en' : 'fr'),
      t: (key) => messages[language][key],
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
