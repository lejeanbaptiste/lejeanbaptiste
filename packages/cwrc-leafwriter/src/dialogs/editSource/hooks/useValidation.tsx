import { useActions } from '@src/overmind';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentContentAtom, xmlValidityAtom } from '../store';

export type XMLValidity =
  | { valid: true }
  | {
      valid: false;
      error: {
        message: string;
        positions?: {
          line: number;
          col: number;
        }[];
      };
    };

export const useValidation = () => {
  const { openDialog } = useActions().ui;
  const { t } = useTranslation('leafwriter');
  const currentContent = useAtomValue(currentContentAtom);
  const setXmlValidity = useSetAtom(xmlValidityAtom);

  const checkValidity = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentContent, 'application/xml');
    const errorNode = doc.querySelector('parsererror');
    const errorString = errorNode?.querySelector('div')?.textContent;

    if (!errorString) {
      const validity: XMLValidity = { valid: true };
      setXmlValidity(validity);
      return validity;
    }

    const lines = [...errorString.matchAll(/line ([0-9]*)/g)];
    const column = [...errorString.matchAll(/column ([0-9]*)/g)];

    const positions = lines.map((line, index) => ({
      line: Number(line[1]),
      col: Number(column[index]?.[1]) ?? 0,
    }));

    const validity: XMLValidity = {
      valid: false,
      error: {
        message: errorString,
        positions: positions,
      },
    };

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
          title: t('leafwriter:xml_document_invalid'),
          Body: () => message,
          actions: [
            { action: 'cancel', label: t('leafwriter:commons.cancel') },
            {
              action: 'discard',
              label: t('leafwriter:commons.discard_changes'),
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

  return {
    checkValidity,
    handleValidationWarning,
  };
};
