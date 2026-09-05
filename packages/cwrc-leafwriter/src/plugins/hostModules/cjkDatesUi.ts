import { CalendarDialog } from '../../dialogs/calendar';
import { DateCuratorPanel } from '../../autoTagging/DateCuratorPanel';
import { DateTagReviewPanel } from '../../autoTagging/DateTagReviewPanel';
import { isDateCuratorBatch, isDateTagOnlyBatch } from '../../autoTagging/dateCurator';
import { isCjkDatesEnabled } from '../registry';
import { isCjkDatesPythonAvailable } from '../cjkDatesPython';
import type { PluginRegisterContext } from '../registerContext';

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

const calendarAvailable = (): boolean =>
  isDesktopApp() && isCjkDatesEnabled() && isCjkDatesPythonAvailable();

/** Registers calendar dialog, review panels, toolbar, and tool actions for cjk-dates. */
export function registerCjkDatesUi(context: PluginRegisterContext): void {
  context.log('registering East Asian dates UI');

  context.registerDialog('calendar', CalendarDialog);

  // Resolve pass: full curator (candidate pick + inline authority editor).
  context.registerReviewPanel(isDateCuratorBatch, DateCuratorPanel, {
    finishWhenIdle: (suggestions) => isDateCuratorBatch(suggestions),
  });
  // Tag pass: simpler accept/reject list (no resolve chrome).
  context.registerReviewPanel(isDateTagOnlyBatch, DateTagReviewPanel, {
    finishWhenIdle: true,
  });

  context.registerToolbarItem({
    id: 'calendar',
    icon: 'date',
    title: 'Calendar',
    tooltip: 'Tag and resolve East Asian dates (sanmiao)',
    group: 'ui',
    isAvailable: calendarAvailable,
    onClick: ({ openCalendar }) => openCalendar(),
  });

  context.registerToolAction('cjk-dates.open-curator', async ({ notify }) => {
    if (!isCjkDatesEnabled()) {
      notify('Enable the “East Asian dates” plugin in Tools → Plugins to use the date curator.');
      return;
    }
    if (!calendarAvailable()) {
      notify('Calendar tagging is available for Chinese, Japanese, and Korean documents.');
      return;
    }
    if (window.writer) {
      window.writer.overmindActions.ui.openDialog({ type: 'calendar' });
      return;
    }
    notify('Open a document before using the date curator.');
  });

  context.onEnable = () => {
    window.dispatchEvent(
      new CustomEvent('grognard:plugin-enabled', { detail: { id: context.pluginId } }),
    );
    window.dispatchEvent(new CustomEvent('desktop:calendar-workflow-changed'));
  };

  context.onDisable = () => {
    window.dispatchEvent(
      new CustomEvent('grognard:plugin-disabled', { detail: { id: context.pluginId } }),
    );
    window.dispatchEvent(new CustomEvent('desktop:calendar-workflow-changed'));
  };
}
