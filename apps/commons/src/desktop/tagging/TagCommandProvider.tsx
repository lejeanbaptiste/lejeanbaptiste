import { useEffect } from 'react';
import { isDesktop } from '@src/types/desktop';
import {
  registerDesktopTaggingBridge,
  unregisterDesktopTaggingBridge,
} from './desktopTaggingBridge';
import { TagCommandPopup } from './TagCommandPopup';
import { TagWalkToolbar } from './TagWalkToolbar';
import { useTagCommandController } from './useTagCommandController';

export const TagCommandProvider = () => {
  const controller = useTagCommandController();

  useEffect(() => {
    if (!isDesktop()) return;

    registerDesktopTaggingBridge({
      handleEditorKeyDown: controller.handleEditorKeyDown,
    });

    return () => unregisterDesktopTaggingBridge();
  }, [controller.handleEditorKeyDown]);

  return (
    <>
      <TagCommandPopup
        anchor={controller.anchor}
        filter={controller.filter}
        highlightedIndex={controller.highlightedIndex}
        matchCount={controller.matchCount}
        mode={controller.mode}
        onApplyPropagate={controller.onApplyPropagate}
        onApplySingle={controller.onApplySingle}
        onApplyTag={controller.onApplyTag}
        onEnterWalkMode={controller.onEnterWalkMode}
        onClose={controller.closePopup}
        onFilterChange={controller.setFilter}
        onHighlightChange={controller.setHighlightedIndex}
        onPopupKeyDown={controller.handlePopupKeyDown}
        open={controller.open}
        selectedText={controller.selectedText}
        suggestions={controller.suggestions}
      />
      {controller.walkMode ? (
        <TagWalkToolbar
          matchCount={controller.walkMode.matchCount}
          mode={controller.walkMode.mode}
          onApplyStep={controller.onApplyWalkStep}
          onExit={controller.exitWalkMode}
          onSkip={controller.onSkipWalkStep}
          searchText={controller.walkMode.search}
          tagName={controller.walkMode.tagName}
        />
      ) : null}
    </>
  );
};
