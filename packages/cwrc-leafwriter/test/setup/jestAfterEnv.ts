if (typeof window !== 'undefined' && typeof window.scrollTo !== 'function') {
  window.scrollTo = () => undefined;
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (!options) return key;
      return key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name] ?? ''));
    },
    i18n: {
      language: 'en',
      changeLanguage: async () => undefined,
    },
  }),
  Trans: ({ children }: { children?: unknown }) => children,
  I18nextProvider: ({ children }: { children?: unknown }) => children,
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));
