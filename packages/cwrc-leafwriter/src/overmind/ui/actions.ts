// import i18n from 'i18next';
import { getDefaultStore } from 'jotai';
import { nanoid } from 'nanoid';
import type { OptionsObject, VariantType } from 'notistack';
import { entityLookupDialogAtom } from '../../jotai/entity-lookup';
import { Context } from '../';
import { db } from '../../db';
import type { DialogBarProps, PopupProps } from '../../dialogs';
import {
  clearAutoTaggingBatch,
  stashAutoTaggingBatch,
} from '../../autoTagging/batchHolder';
import type { Suggestion } from '../../autoTagging/types';
import i18n, { Locales, localesSchema } from '../../i18n';
import type { ContextMenuState, NotificationProps, PaletteMode, PanelId, Side } from '../../types';
import type { EditorViewMode } from './state';
import { checkWellFormedness } from '../../utilities/checkWellFormedness';
import {
  getVisualCaretForSourceSync,
  mapVisualCaretToSourceOffset,
} from '../../utilities/sourceCursorSync';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onInitializeOvermind = ({ state, actions, effects }: Context, _overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    effects.editor.api.getFromLocalStorage<PaletteMode>('themeAppearance') ?? 'system';

  actions.ui.setThemeAppearance(prefPaletteMode);

  //LANGUAGE
  const prefLocale = effects.editor.api.getFromLocalStorage<string>('i18nextLng');
  if (prefLocale) {
    const supportedLocaled = localesSchema.safeParse(prefLocale).success
      ? (prefLocale as Locales)
      : 'en';

    state.ui.currentLocale = supportedLocaled;
    void i18n.changeLanguage(supportedLocaled);
  }

  const showRawXmlPanel = effects.editor.api.getFromLocalStorage<boolean>('showRawXmlPanel');
  state.editor.showRawXmlPanel = showRawXmlPanel === true;

  const showTagBubble = effects.editor.api.getFromLocalStorage<boolean>('showTagBubble');
  // Default true (only false if explicitly saved as false)
  state.editor.showTagBubble = showTagBubble !== false;
};

export const setThemeAppearance = ({ state, actions, effects }: Context, value: PaletteMode) => {
  state.ui.themeAppearance = value;

  const darkMode =
    value === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : value === 'light'
        ? false
        : true;

  actions.ui.setDarkMode(darkMode);

  effects.editor.api.saveToLocalStorage<PaletteMode>('themeAppearance', value);

  setTimeout(() => window.dispatchEvent(new Event('changeTheme')), 0);
};

export const listenChangeLanguage = async ({ state, effects }: Context) => {
  //* check language
  const prefLocale = effects.editor.api.getFromLocalStorage<string>('i18nextLng');
  if (prefLocale) {
    const supportedLocaled = localesSchema.safeParse(prefLocale).success
      ? (prefLocale as Locales)
      : 'en';

    state.ui.currentLocale = supportedLocaled;
    void i18n.changeLanguage(supportedLocaled);
  }
};

export const switchLocal = ({ state, effects }: Context, locale: Locales | (string & {})) => {
  const supportedLocaled = localesSchema.safeParse(locale).success ? (locale as Locales) : 'en';
  state.ui.currentLocale = supportedLocaled;
  effects.editor.api.saveToLocalStorage('i18nextLng', supportedLocaled);
  void i18n.changeLanguage(supportedLocaled);
};

export const listenChangeTheme = ({ state, actions, effects }: Context) => {
  const prefPaletteMode = effects.editor.api.getFromLocalStorage<PaletteMode>('themeAppearance');
  if (prefPaletteMode && prefPaletteMode !== state.ui.themeAppearance) {
    if (prefPaletteMode) actions.ui.setThemeAppearance(prefPaletteMode);
  }
};

export const setDarkMode = ({ state }: Context, value: boolean) => {
  state.ui.darkMode = value;
};

export const setFullscreen = ({ state }: Context, value: boolean) => {
  state.ui.fullscreen = value;
};

export const toggleFullscreen = ({ state }: Context) => {
  const isFullscreen = window.writer.layoutManager.toggleFullScreen();
  state.ui.fullscreen = isFullscreen;
};

export const closeContextMenu = ({ state }: Context) => {
  state.ui.contextMenu = { show: false };
};

export const showContextMenu = ({ state }: Context, value: Omit<ContextMenuState, 'show'>) => {
  state.ui.contextMenu = { ...value, show: true };
};

export const resetPreferences = ({ effects }: Context) => {
  effects.editor.api.removeFromLocalStorage('themeAppearance');
};

export const switchLocale = ({ state, effects }: Context, locale: string) => {
  const supportedLocale = localesSchema.safeParse(locale).success ? (locale as Locales) : 'en';
  state.ui.currentLocale = supportedLocale;
  effects.editor.api.saveToLocalStorage('i18nextLng', supportedLocale);
  void i18n.changeLanguage(supportedLocale);
  setTimeout(() => window.dispatchEvent(new Event('changeLanguage')), 0);
  return supportedLocale;
};

export const openDialog = ({ state }: Context, dialogBar: DialogBarProps) => {
  const dialogOpened = state.ui.dialogBar.some(({ props }) => props?.id === dialogBar.props?.id);
  if (dialogOpened) return;

  if (!dialogBar.props?.id) dialogBar.props = { ...dialogBar.props, id: nanoid() };
  if (!dialogBar.type) dialogBar.type = 'simple';
  state.ui.dialogBar = [...state.ui.dialogBar, dialogBar];
  return dialogBar.props.id;
};

export const editDialogPopupProps = ({ state }: Context, props: PopupProps) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialog) => {
      if (dialog.props?.id === props?.id) dialog.props = props;
      return dialog;
    }),
  ];
};

export const closeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.dismissed = true;
      return dialogBar;
    }),
  ];
};

export const closeForegroundPopup = ({ state, actions }: Context): boolean => {
  if (state.ui.contextMenu.show) {
    actions.ui.closeContextMenu();
    return true;
  }

  const entityLookup = getDefaultStore().get(entityLookupDialogAtom);
  if (entityLookup) {
    getDefaultStore().set(entityLookupDialogAtom, null);
    entityLookup.onClose?.();
    return true;
  }

  const openDialogs = state.ui.dialogBar.filter((dialog) => !dialog.dismissed && dialog.props?.id);
  if (openDialogs.length > 0) {
    const top = openDialogs[openDialogs.length - 1];
    actions.ui.closeDialog(top.props!.id!);
    top.props?.onClose?.('escapeKeyDown');
    return true;
  }

  const messageDialog = window.writer?.dialogManager?.getDialog('message') as
    | { openDialogs?: unknown[] }
    | undefined;
  if (messageDialog?.openDialogs?.length) {
    const $message = messageDialog.openDialogs[messageDialog.openDialogs.length - 1] as {
      dialog: (command: string) => void;
    };
    $message.dialog('close');
    return true;
  }

  return false;
};

export const removeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = state.ui.dialogBar.filter((dialogBar) => dialogBar.props?.id !== id);
};

export const setDialogDisplayId = (
  { state }: Context,
  { id, displayId }: { id: string; displayId: string },
) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.displayId = displayId;
      return dialogBar;
    }),
  ];
};

const SNACKBAR_AUTO_HIDE_MS: Partial<Record<VariantType, number>> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 8000,
  default: 5000,
};

const mergeSnackbarOptions = (options: OptionsObject = {}): OptionsObject => {
  const variant = (options.variant ?? 'default') as VariantType;
  const autoHideDuration =
    options.autoHideDuration ?? SNACKBAR_AUTO_HIDE_MS[variant] ?? SNACKBAR_AUTO_HIDE_MS.default;

  const merged: OptionsObject = {
    persist: false,
    autoHideDuration,
    ...options,
  };

  if (merged.persist) {
    delete merged.autoHideDuration;
  }

  return merged;
};

export const notifyViaSnackbar = ({ state }: Context, notification: NotificationProps | string) => {
  if (typeof notification === 'string') notification = { message: notification };

  let key = notification.options?.key;
  if (!key) key = new Date().getTime() + Math.random();

  state.ui.notifications = [
    ...state.ui.notifications,
    {
      ...notification,
      key,
      options: mergeSnackbarOptions(notification.options),
    },
  ];
};

export const closeNotificationSnackbar = ({ state }: Context, key?: string | number) => {
  const dismissAll = !key;
  state.ui.notifications = state.ui.notifications.map((notification) =>
    dismissAll || notification.key === key
      ? { ...notification, dismissed: true }
      : { ...notification },
  );
};

export const removeNotificationSnackbar = ({ state }: Context, key: string | number) => {
  state.ui.notifications = state.ui.notifications.filter(
    (notification) => notification.key !== key,
  );
};

export const shouldDisplayDialog = async (_context: Context, value: string) => {
  const dialogId = await db.doNotDisplayDialogs.get({ id: value });
  return !dialogId;
};

export const doNotDisplayDialog = async (_context: Context, value: string) => {
  await db.doNotDisplayDialogs.put({ id: value });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const resetDoNotDisplayDialogs = async (_context: Context) => {
  await db.doNotDisplayDialogs.clear();
};

export const updateReadonly = ({ state }: Context) => {
  const { isReadonly } = state.editor;

  window.writer.isReadOnly = isReadonly;
  window.writer.editor?.mode.set(isReadonly ? 'readonly' : 'design');
  window.writer.layoutManager.toggleReadonly(isReadonly);
  window.writer.entitiesList?.toggleReadonly(isReadonly);
  window.writer.layoutManager.resizeEditor();
};

export const allowTagDragAndDrop = ({ state }: Context, value: boolean) => {
  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    allowDragAndDrop: value,
  };
};

export const showTextNodes = ({ state, actions }: Context, value?: boolean) => {
  if (!value) value = !state.ui.markupPanel.showTextNodes;

  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    showTextNodes: value,
  };

  actions.ui.allowTagDragAndDrop(value);
};

export const changePanel = (
  { state }: Context,
  { side, panelId }: { side: Uncapitalize<Side>; panelId: PanelId },
) => {
  const sidePanel = state.ui.layout[side];
  if (!sidePanel) return;
  sidePanel.activePanel = panelId;
};

export const setEditorViewMode = ({ state }: Context, mode: EditorViewMode) => {
  if (state.ui.editorViewMode === mode) return;

  state.ui.editorViewMode = mode;
  window.writer?.layoutManager?.setEditorViewMode(mode);
  window.dispatchEvent(new CustomEvent('desktop:editor-view-mode-changed', { detail: { mode } }));
};

export const enterTranslationMode = (
  { state }: Context,
  payload: {
    lang: string;
    sourcePath: string;
    translationPath: string;
    alignmentUnit: 'div' | 'p';
    citationStyle?: string;
  },
) => {
  state.ui.translationMode = {
    active: true,
    lang: payload.lang,
    sourcePath: payload.sourcePath,
    translationPath: payload.translationPath,
    alignmentUnit: payload.alignmentUnit,
    citationStyle: payload.citationStyle ?? null,
    selectedUnitId: null,
  };
  window.dispatchEvent(
    new CustomEvent('desktop:translation-mode-changed', { detail: state.ui.translationMode }),
  );
};

export const exitTranslationMode = ({ state }: Context) => {
  if (!state.ui.translationMode.active) return;

  state.ui.translationMode = {
    active: false,
    lang: null,
    sourcePath: null,
    translationPath: null,
    alignmentUnit: null,
    citationStyle: null,
    selectedUnitId: null,
  };
  window.dispatchEvent(
    new CustomEvent('desktop:translation-mode-changed', { detail: state.ui.translationMode }),
  );
};

export const setSelectedTranslationUnit = ({ state }: Context, unitId: string | null) => {
  if (!state.ui.translationMode.active) return;
  state.ui.translationMode.selectedUnitId = unitId;
};

/**
 * Whether any docked review walk is active, right now, in this call. Carried
 * as CustomEvent detail on every open/close dispatch below so listeners
 * (e.g. the desktop shell's left/right panel suppression) can resync to the
 * authoritative truth on every event instead of incrementing/decrementing a
 * local counter that drifts if events ever fire out of the exact pairs it
 * expects (auto-tagging exiting into disambiguation, etc.).
 */
const dockedReviewActiveDetail = (state: Context['state']) => ({
  active: state.ui.autoTaggingReview.active || state.ui.disambiguationReview.active,
});

export const startAutoTaggingReview = (
  { state, actions }: Context,
  { suggestions, notice, aiValidation }: { suggestions: Suggestion[]; notice?: string; aiValidation?: boolean },
) => {
  if (state.ui.disambiguationReview.active) actions.ui.exitDisambiguationReview();
  stashAutoTaggingBatch(suggestions, notice);
  state.ui.autoTaggingReview.active = true;
  state.ui.autoTaggingReview.batchId += 1;
  state.ui.autoTaggingReview.aiValidation = aiValidation;
  window.dispatchEvent(
    new CustomEvent('desktop:auto-tagging-review-open', { detail: dockedReviewActiveDetail(state) }),
  );
};

export const exitAutoTaggingReview = ({ state }: Context) => {
  clearAutoTaggingBatch();
  state.ui.autoTaggingReview.active = false;
  window.dispatchEvent(
    new CustomEvent('desktop:auto-tagging-review-close', { detail: dockedReviewActiveDetail(state) }),
  );
};

export const startDisambiguationReview = (
  { state, actions }: Context,
  options?: { aiCuration?: boolean },
) => {
  if (state.ui.autoTaggingReview.active) actions.ui.exitAutoTaggingReview();
  state.ui.disambiguationReview.active = true;
  state.ui.disambiguationReview.aiCuration = options?.aiCuration ?? true;
  window.dispatchEvent(
    new CustomEvent('desktop:disambiguation-review-open', { detail: dockedReviewActiveDetail(state) }),
  );
};

export const exitDisambiguationReview = ({ state }: Context) => {
  state.ui.disambiguationReview.active = false;
  window.dispatchEvent(
    new CustomEvent('desktop:disambiguation-review-close', { detail: dockedReviewActiveDetail(state) }),
  );
};

/**
 * Close any open review walk without saving — opening the auto-tagging or
 * disambiguation launcher abandons the in-progress walk.
 */
export const dismissReviewPanes = ({ state, actions }: Context) => {
  if (state.ui.autoTaggingReview.active) actions.ui.exitAutoTaggingReview();
  if (state.ui.disambiguationReview.active) actions.ui.exitDisambiguationReview();
};

export const resetSourceEditor = ({ state }: Context) => {
  const wasSource = state.ui.editorViewMode === 'source';
  state.ui.editorViewMode = 'visual';
  state.ui.sourceOriginalContent = '';
  state.ui.sourceCurrentContent = '';
  state.ui.sourcePendingCursorOffset = null;
  window.writer?.layoutManager?.setEditorViewMode('visual');
  if (wasSource) {
    window.dispatchEvent(
      new CustomEvent('desktop:editor-view-mode-changed', { detail: { mode: 'visual' } }),
    );
  }
};

const resolveSourceEditorContent = async (state: Context['state']): Promise<string> => {
  const writer = window.writer;

  if (writer) {
    let fromEditor = '';
    try {
      fromEditor =
        (await writer.converter.getDocumentContent(false)) ||
        (await writer.converter.getDocumentContent(true)) ||
        (await writer.getContent()) ||
        '';
    } catch {
      // No convertible content (no root element) — fall through to state.document.xml.
    }

    if (fromEditor) {
      const mergeForValidation = window.__desktopMergeHeaderForValidation;
      if (typeof mergeForValidation === 'function') {
        return mergeForValidation(fromEditor);
      }
      return fromEditor;
    }
  }

  if (state.document.xml) {
    const mergeForValidation = window.__desktopMergeHeaderForValidation;
    if (typeof mergeForValidation === 'function') {
      return mergeForValidation(state.document.xml);
    }
    return state.document.xml;
  }

  return '';
};

/** Keep Monaco source buffer aligned with the active document (tab switch / project switch). */
export const syncSourceEditorFromDocument = async ({ state }: Context) => {
  const content = await resolveSourceEditorContent(state);
  if (!content) return;

  state.ui.sourceOriginalContent = content;
  state.ui.sourceCurrentContent = content;
};

export const setSourceCurrentContent = ({ state }: Context, content: string) => {
  state.ui.sourceCurrentContent = content;
  if (content !== state.ui.sourceOriginalContent) {
    state.editor.contentHasChanged = true;
  }
};

export const markSourceSaved = ({ state }: Context, content: string) => {
  state.ui.sourceOriginalContent = content;
};

export const clearSourcePendingCursorOffset = ({ state }: Context) => {
  state.ui.sourcePendingCursorOffset = null;
};

export const enterSourceMode = async ({ state, actions }: Context) => {
  const visualCaret = getVisualCaretForSourceSync();
  const content = await resolveSourceEditorContent(state);
  if (!content) return;

  state.ui.sourceOriginalContent = content;
  state.ui.sourceCurrentContent = content;
  state.ui.sourcePendingCursorOffset =
    visualCaret !== null ? mapVisualCaretToSourceOffset(content, visualCaret) : null;

  if (state.ui.editorViewMode !== 'source') {
    actions.ui.setEditorViewMode('source');
  }
};

type SourceModeValidity = { valid: true } | { valid: false; message: string };

/**
 * Checks the current source-mode buffer (well-formedness, then schema if one
 * is configured) and surfaces the same diagnostics used elsewhere: parse
 * errors/schema violations are published as `documentValidated` so the
 * Validation panel shows position + nature, exactly as it would for any
 * other validation trigger.
 */
const checkCurrentSourceValidity = async ({
  state,
  actions,
}: Context): Promise<SourceModeValidity> => {
  const content = state.ui.sourceCurrentContent;
  const wellFormed = checkWellFormedness(content);

  if (!wellFormed.valid) {
    const parseErrorCount = wellFormed.error.positions?.length ?? 1;
    await actions.validator.updateValidationError(parseErrorCount);
    window.writer
      ?.event('documentValidated')
      .publish(false, { valid: false, errors: [], parseError: wellFormed.error }, content);
    window.writer?.layoutManager?.showModule('validation');
    return { valid: false, message: wellFormed.error.message };
  }

  await actions.validator.validate();
  window.writer?.layoutManager?.showModule('validation');

  // Only treat schema violations as blocking when a schema is actually
  // loaded — `validate()` reports validationErrors=1 when no schema/worker
  // is available, which means "unverifiable", not "invalid".
  const schemaAvailable = state.validator.hasWorkerValidator && state.validator.hasSchema;
  if (schemaAvailable && state.validator.validationErrors > 0) {
    return {
      valid: false,
      message: i18n.t('LW.xml_document_schema_invalid', {
        count: state.validator.validationErrors,
      }),
    };
  }

  return { valid: true };
};

/**
 * Blocks leaving Source mode / saving while the buffer is invalid. Shows the
 * existing "invalid document" popup (position/nature detail lives in the
 * Validation panel it opens) and offers to revert to the content the buffer
 * had when Source mode was entered. A revert is not assumed to be safe — the
 * baseline itself is re-validated, and if it's still invalid the user gets a
 * follow-up notice and stays in Source mode to fix it (unless leave-anyway
 * is offered for exit-only flows).
 */
const resolveInvalidSourceMode = async (
  { state, actions }: Context,
  options?: { allowLeaveAnyway?: boolean },
): Promise<'valid' | 'reverted' | 'leaveAnyway' | 'blocked'> => {
  const allowLeaveAnyway = options?.allowLeaveAnyway === true;
  const validity = await checkCurrentSourceValidity({ state, actions } as Context);
  if (validity.valid) return 'valid';

  type DialogChoice = 'cancel' | 'discard' | 'leaveAnyway';
  const choice = await new Promise<DialogChoice>((resolve) => {
    actions.ui.openDialog({
      type: 'simple',
      props: {
        maxWidth: 'xs',
        severity: 'warning',
        title: i18n.t('LW.xml_document_invalid'),
        Body: () => validity.message,
        actions: [
          { action: 'cancel', label: i18n.t('LW.commons.cancel') },
          {
            action: 'discard',
            label: i18n.t('LW.commons.discard_changes'),
            variant: 'outlined',
          },
          ...(allowLeaveAnyway
            ? [
                {
                  action: 'leaveAnyway',
                  label: i18n.t('LW.commons.leave_source_anyway'),
                  variant: 'contained' as const,
                },
              ]
            : []),
        ],
        onClose: async (action) => {
          if (action === 'discard') resolve('discard');
          else if (action === 'leaveAnyway') resolve('leaveAnyway');
          else resolve('cancel');
        },
      },
    });
  });

  if (choice === 'cancel') return 'blocked';
  if (choice === 'leaveAnyway') return 'leaveAnyway';

  state.ui.sourceCurrentContent = state.ui.sourceOriginalContent;

  const revertedValidity = await checkCurrentSourceValidity({ state, actions } as Context);
  if (revertedValidity.valid) return 'reverted';

  if (allowLeaveAnyway) {
    const followUp = await new Promise<'ok' | 'leaveAnyway'>((resolve) => {
      actions.ui.openDialog({
        type: 'simple',
        props: {
          maxWidth: 'xs',
          severity: 'warning',
          title: i18n.t('LW.xml_document_invalid'),
          Body: () => i18n.t('LW.xml_document_still_invalid'),
          actions: [
            { action: 'ok', label: i18n.t('LW.commons.ok') },
            {
              action: 'leaveAnyway',
              label: i18n.t('LW.commons.leave_source_anyway'),
              variant: 'contained',
            },
          ],
          onClose: (action) => resolve(action === 'leaveAnyway' ? 'leaveAnyway' : 'ok'),
        },
      });
    });
    if (followUp === 'leaveAnyway') {
      // Keep the discarded baseline (still invalid) so the user can leave.
      return 'leaveAnyway';
    }
    return 'blocked';
  }

  await new Promise<void>((resolve) => {
    actions.ui.openDialog({
      type: 'simple',
      props: {
        maxWidth: 'xs',
        severity: 'warning',
        title: i18n.t('LW.xml_document_invalid'),
        Body: () => revertedValidity.message,
        actions: [{ action: 'ok', label: i18n.t('LW.commons.ok') }],
        onClose: () => resolve(),
      },
    });
  });

  return 'blocked';
};

export const exitSourceMode = async ({ state, actions }: Context): Promise<boolean> => {
  const result = await resolveInvalidSourceMode(
    { state, actions } as Context,
    { allowLeaveAnyway: true },
  );
  if (result === 'blocked') return false;

  const finalContent = state.ui.sourceCurrentContent;
  const leavingWithEdits = finalContent !== state.ui.sourceOriginalContent;

  // Persist the Source buffer into the tab/stored snapshot whenever we leave
  // with that buffer (valid edits or explicit leave-anyway). Skip when the
  // user discarded back to an unchanged entry baseline.
  if (result === 'valid' || result === 'leaveAnyway') {
    if (leavingWithEdits || result === 'leaveAnyway') {
      const filePath = state.document.url;
      if (filePath) {
        window.writer?.overmindActions?.project?.updateTabContent?.({
          filePath,
          content: finalContent,
        });
        if (leavingWithEdits) {
          window.writer?.overmindActions?.project?.markTabDirty?.(true);
        }
      }
      window.__desktopStoredDocumentXml = finalContent;
    }
  }

  // Source-mode save does not refresh the hidden WYSIWYG tree; reload so markup
  // panel and visual mode match the XML buffer (even when source text unchanged).
  actions.document.setIsReload(true);
  actions.document.loadDocumentXML(finalContent);
  actions.ui.setEditorViewMode('visual');
  return true;
};

/**
 * Guard used before any save-while-in-source-mode path. `proceed: false`
 * means the caller must abort the save — either the buffer is still invalid
 * and the user didn't discard, or it was reverted to its (valid) baseline
 * and there's nothing new to persist.
 *
 * Does not offer "leave anyway": saving invalid XML is never allowed here.
 */
export const guardSourceModeSave = async ({
  state,
  actions,
}: Context): Promise<{ proceed: boolean; content: string; reverted: boolean }> => {
  if (state.ui.editorViewMode !== 'source') {
    return { proceed: true, content: state.ui.sourceCurrentContent, reverted: false };
  }

  const result = await resolveInvalidSourceMode(
    { state, actions } as Context,
    { allowLeaveAnyway: false },
  );
  if (result === 'blocked' || result === 'leaveAnyway') {
    return { proceed: false, content: state.ui.sourceCurrentContent, reverted: false };
  }

  if (result === 'reverted') {
    // Nothing new to persist: the buffer is back to what it was when Source
    // mode was entered, and staying in source mode reflects that.
    actions.document.setIsReload(true);
    actions.document.loadDocumentXML(state.ui.sourceCurrentContent);
    return { proceed: false, content: state.ui.sourceCurrentContent, reverted: true };
  }

  return { proceed: true, content: state.ui.sourceCurrentContent, reverted: false };
};
