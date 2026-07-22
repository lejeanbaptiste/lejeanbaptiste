import { useEffect } from 'react';
import { isDesktop } from '@src/types/desktop';
import { CorrectionPopup } from './CorrectionPopup';
import {
  registerDesktopCorrectionBridge,
  unregisterDesktopCorrectionBridge,
} from './desktopCorrectionBridge';
import { useCorrectionController } from './useCorrectionController';

export const CorrectionProvider = () => {
  const controller = useCorrectionController();

  useEffect(() => {
    if (!isDesktop()) return;

    registerDesktopCorrectionBridge({
      openCorrectionPopup: controller.openPopup,
    });

    return () => unregisterDesktopCorrectionBridge();
  }, [controller.openPopup]);

  return (
    <CorrectionPopup
      addAttrName={controller.addAttrName}
      anchor={controller.anchor}
      availableAttributes={controller.availableAttributes}
      cert={controller.cert}
      corrText={controller.corrText}
      errorMessage={controller.errorMessage}
      extraAttributes={controller.extraAttributes}
      mode={controller.mode}
      onAddAttribute={controller.onAddAttribute}
      onApply={controller.onApply}
      onClose={controller.closePopup}
      onExtraAttributeChange={controller.onExtraAttributeChange}
      onRemoveAttribute={controller.onRemoveAttribute}
      onRemoveMarkup={controller.onRemoveMarkup}
      onPopupKeyDown={controller.handlePopupKeyDown}
      open={controller.open}
      setAddAttrName={controller.setAddAttrName}
      setCert={controller.setCert}
      setCorrText={controller.setCorrText}
      sicText={controller.sicText}
      typeLabel={controller.typeLabel}
    />
  );
};
