import { useCallback, useEffect, useState } from 'react';
import { AutoTaggingSession } from './integration';
import {
  autoTaggingDocumentKey,
  inferEastAsianLanguageFromDocument,
  isEastAsianDatesMethodAvailable,
  resolveAutoTaggingSourceLanguage,
} from './dateWorkflow';

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

const sanmiaoAvailable = () =>
  !!window.electronAPI?.sanmiaoTagDatesBatch ||
  !!window.electronAPI?.sanmiaoProposeDatesBatch ||
  !!window.electronAPI?.sanmiaoProposeDates;

export interface CalendarWorkflowState {
  calendarOffered: boolean;
  docKey: string;
  language: string | null;
  ready: boolean;
}

const defaultState: CalendarWorkflowState = {
  calendarOffered: false,
  docKey: 'unknown',
  language: null,
  ready: false,
};

/** Language + sanmiao availability for toolbar buttons. */
export const useCalendarWorkflow = (): CalendarWorkflowState & { refresh: () => void } => {
  const [state, setState] = useState<CalendarWorkflowState>(defaultState);

  const refresh = useCallback(() => {
    if (!window.writer) {
      setState(defaultState);
      return;
    }

    void (async () => {
      try {
        const session = new AutoTaggingSession(window.writer);
        const doc = await session.getDocument();
        const lang = await resolveAutoTaggingSourceLanguage(doc, () =>
          window.__leafWriterProject?.getProjectSourceLanguage?.() ?? Promise.resolve(null),
        ).catch(() => inferEastAsianLanguageFromDocument(doc));
        const docKey = autoTaggingDocumentKey(window.writer);
        const offered =
          isDesktopApp() && sanmiaoAvailable() && isEastAsianDatesMethodAvailable(lang);

        setState({
          calendarOffered: offered,
          docKey,
          language: lang,
          ready: true,
        });
      } catch {
        setState({ ...defaultState, ready: true });
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    const writer = window.writer;
    if (!writer) return;

    const onDocumentLoaded = () => refresh();
    const onContentChanged = () => refresh();
    writer.event('documentLoaded').subscribe(onDocumentLoaded);
    writer.event('contentChanged').subscribe(onContentChanged);
    window.addEventListener('desktop:auto-tagging-review-close', refresh);
    window.addEventListener('desktop:disambiguation-review-close', refresh);
    window.addEventListener('desktop:calendar-workflow-changed', refresh);

    return () => {
      writer.event('documentLoaded').unsubscribe(onDocumentLoaded);
      writer.event('contentChanged').unsubscribe(onContentChanged);
      window.removeEventListener('desktop:auto-tagging-review-close', refresh);
      window.removeEventListener('desktop:disambiguation-review-close', refresh);
      window.removeEventListener('desktop:calendar-workflow-changed', refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
};
