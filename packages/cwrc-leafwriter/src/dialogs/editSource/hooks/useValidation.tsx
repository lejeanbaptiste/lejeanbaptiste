import { useActions } from '../../../overmind';
import { checkWellFormedness, type XMLValidity } from '../../../utilities/checkWellFormedness';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentContentAtom, xmlValidityAtom } from '../store';

export type { XMLValidity };

export const useValidation = () => {
  const { openDialog } = useActions().ui;
  const { t } = useTranslation();
  const currentContent = useAtomValue(currentContentAtom);
  const setXmlValidity = useSetAtom(xmlValidityAtom);

  const checkValidity = () => {
    const validity = checkWellFormedness(currentContent);
    setXmlValidity(validity);
    return validity;
  };

  const handleValidationWarning = async (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      openDialog({
        type: 'simple',
        props: {
          maxWidth: 'xs',
          severity: 'warning',
          title: t('LW.xml_document_invalid'),
          Body: () => message,
          actions: [
            { action: 'cancel', label: t('LW.commons.cancel') },
            {
              action: 'discard',
              label: t('LW.commons.discard_changes'),
              variant: 'outlined',
            },
          ],
          onClose: async (action) => {
            if (action === 'discard') return resolve(true);
            return resolve(false);
          },
        },
      });
    });
  };

  // Shown after the user discards their edits: reverting is not assumed to be
  // safe, since the content the dialog opened with may itself have been
  // invalid. Only an "ok" is offered — there is nothing further to revert to.
  const notifyStillInvalid = async (message: string): Promise<void> => {
    return new Promise((resolve) => {
      openDialog({
        type: 'simple',
        props: {
          maxWidth: 'xs',
          severity: 'warning',
          title: t('LW.xml_document_invalid'),
          Body: () => message,
          actions: [{ action: 'ok', label: t('LW.commons.ok') }],
          onClose: () => resolve(),
        },
      });
    });
  };

  return {
    checkValidity,
    handleValidationWarning,
    notifyStillInvalid,
  };
};
