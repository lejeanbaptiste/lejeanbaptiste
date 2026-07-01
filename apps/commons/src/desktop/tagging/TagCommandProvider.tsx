import { useCallback, useEffect } from 'react';
import { isDesktop } from '@src/types/desktop';
import { useActions } from '@src/overmind';
import { AttributeCommandPopup } from './AttributeCommandPopup';
import {
  registerDesktopTaggingBridge,
  unregisterDesktopTaggingBridge,
} from './desktopTaggingBridge';
import { TagCommandPopup } from './TagCommandPopup';
import { TagWalkToolbar } from './TagWalkToolbar';
import { applyRenameTag } from './tagCommand';
import { useAttributeCommandController } from './useAttributeCommandController';
import { useTagCommandController } from './useTagCommandController';

export const TagCommandProvider = () => {
  const tagController = useTagCommandController();
  const attrController = useAttributeCommandController();
  const { notifyViaSnackbar } = useActions().ui;

  const changeTag = useCallback(
    (tagId: string, newTagName: string) => {
      const writer = window.writer;
      if (!writer?.tagger) return;

      const $tag = writer.tagger.getCurrentTag(tagId);
      const element = ($tag?.[0] as Element | undefined) ?? null;
      if (!element) {
        notifyViaSnackbar({ message: 'Tag not found.', options: { variant: 'warning' } });
        return;
      }

      void applyRenameTag(newTagName, element).then((result) => {
        if (result.applied) {
          writer.layoutManager?.showModule('attributes');
          return;
        }
        if (result.error && result.error !== 'Cancelled') {
          notifyViaSnackbar({ message: result.error, options: { variant: 'warning' } });
        }
      });
    },
    [notifyViaSnackbar],
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (attrController.open) return false;

      const tagHandled = tagController.handleEditorKeyDown(event);
      const attrHandled = tagHandled
        ? false
        : attrController.handleEditorKeyDown(event, {
            tagPopupOpen: tagController.open,
            walkMode: Boolean(tagController.walkMode),
          });
      const handled = tagHandled || attrHandled;

      return handled;
    },
    [
      attrController.handleEditorKeyDown,
      attrController.open,
      tagController.handleEditorKeyDown,
      tagController.open,
      tagController.walkMode,
    ],
  );

  useEffect(() => {
    if (!isDesktop()) return;

    registerDesktopTaggingBridge({
      changeTag,
      handleEditorKeyDown,
      openTagPopup: (mode, anchorOverride) => tagController.openPopup(mode, anchorOverride),
      openAttributePopup: (anchorOverride) => attrController.openPopup(anchorOverride),
    });

    return () => unregisterDesktopTaggingBridge();
  }, [changeTag, handleEditorKeyDown, tagController.openPopup, attrController.openPopup]);

  return (
    <>
      <TagCommandPopup
        anchor={tagController.anchor}
        filter={tagController.filter}
        highlightedIndex={tagController.highlightedIndex}
        matchCount={tagController.matchCount}
        mode={tagController.mode}
        onApplyPropagate={tagController.onApplyPropagate}
        onApplySingle={tagController.onApplySingle}
        onApplyTag={tagController.onApplyTag}
        onEnterWalkMode={tagController.onEnterWalkMode}
        onClose={tagController.closePopup}
        onFilterChange={tagController.setFilter}
        onHighlightChange={tagController.setHighlightedIndex}
        onPopupKeyDown={tagController.handlePopupKeyDown}
        open={tagController.open}
        selectedText={tagController.selectedText}
        suggestions={tagController.suggestions}
      />
      <AttributeCommandPopup
        anchor={attrController.anchor}
        focusedField={attrController.focusedField}
        highlightedIndex={attrController.highlightedIndex}
        nameFilter={attrController.nameFilter}
        onClose={attrController.closePopup}
        onFocusedFieldChange={attrController.setFocusedField}
        onHighlightChange={attrController.setHighlightedIndex}
        onNameFilterChange={attrController.setNameFilter}
        onPopupKeyDown={attrController.handlePopupKeyDown}
        onValueFilterChange={attrController.setValueFilter}
        open={attrController.open}
        schemaAttributes={attrController.schemaAttributes}
        tagName={attrController.tagName}
        valueFilter={attrController.valueFilter}
        valueSuggestions={attrController.valueSuggestions}
      />
      {tagController.walkMode ? (
        <TagWalkToolbar
          matchCount={tagController.walkMode.matchCount}
          mode={tagController.walkMode.mode}
          onApplyStep={tagController.onApplyWalkStep}
          onExit={tagController.exitWalkMode}
          onSkip={tagController.onSkipWalkStep}
          searchText={tagController.walkMode.search}
          tagName={tagController.walkMode.tagName}
        />
      ) : null}
    </>
  );
};
