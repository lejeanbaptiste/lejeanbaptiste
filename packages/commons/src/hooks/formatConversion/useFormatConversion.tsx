import { useActions } from '@src/overmind';
import {
  convertDocument as ServiceConvertDocument,
  listTransformations,
} from '@src/services/leafTe';
import type { Resource } from '@src/types';
import { renameFileAsCopy } from '@src/utilities';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { InterceptConvertDialog } from './components';
import { formatCheckers } from './utilities';

interface ConvertDocumentParams {
  fromType: string;
  prompt?: boolean;
  resource: Resource;
}

interface ConvertedDocument {
  content?: string;
  filename?: string;
  newFilename?: string;
  isConverted: boolean;
}

export const useFormatConversion = () => {
  const { notifyViaSnackbar, openDialog } = useActions().ui;
  const { t } = useTranslation('LWC');

  const checkDocumentFormat = async (content: string) => {
    let matchFormat: string | undefined = undefined;

    //Check if matches formats
    for (const [format, checkFunction] of formatCheckers) {
      const match = checkFunction(content);
      if (match) {
        matchFormat = format;
        break;
      }
    }

    if (!matchFormat) return;

    //Get conversion formats
    const conversionFormats = await listTransformations({ to: 'TEI' });
    if (!conversionFormats) return;

    //Check if format is suported
    const isConversionSupported = conversionFormats.includes(matchFormat);
    if (!isConversionSupported) return;

    return matchFormat;
  };

  const convertDocument = async ({
    fromType,
    resource,
    prompt = true,
  }: ConvertDocumentParams): Promise<ConvertedDocument | undefined> => {
    if (!resource.content) return;

    if (!prompt) {
      const convertedDocument = await convert({ fromType, resource });
      return convertedDocument;
    }

    let result: ConvertedDocument = { isConverted: false };

    return new Promise((resolve) => {
      openDialog({
        props: {
          icon: 'importExportRoundedIcon',
          preventEscape: true,
          title: t('LWC:importExport.convert document').toString(),
          Body: () => <InterceptConvertDialog format={fromType} />,
          actions: [
            { action: 'cancel', label: `${t('LWC:commons.cancel')}` },
            {
              action: 'noConvertOpen',
              label: `${t('LWC:importExport.try to open it without converting')}`,
            },
            {
              action: 'convertOpen',
              label: `${t('LWC:importExport.convert and open')}`,
              variant: 'outlined',
            },
          ],
          onBeforeClose: async (action) => {
            if (action !== 'convertOpen') return;

            const convertedDocument = await convert({ fromType, resource });
            if (!convertedDocument) return false;
            result = convertedDocument;
          },
          onClose: async (action) => {
            if (action === 'cancel') resolve(undefined);
            resolve(result);
          },
        },
      });
    });
  };

  const convert = async ({ fromType, resource: { content, filename } }: ConvertDocumentParams) => {
    if (!content) return;
    const conversion = await ServiceConvertDocument({ content, fromType, toType: 'TEI' });
    if (conversion instanceof Error) {
      notifyConvertError(conversion);
      return;
    }

    const newFilename = filename ? renameFileAsCopy(filename) : '';

    const convertedDocument: ConvertedDocument = {
      content: conversion,
      newFilename: newFilename,
      isConverted: true,
    };

    return convertedDocument;
  };

  const notifyConvertError = (error: Error) => {
    notifyViaSnackbar({
      message: `${t('LWC:commons.conversion failed')}: ${error.message}`,
      options: { variant: 'error' },
    });
  };

  return {
    checkDocumentFormat,
    convertDocument,
  };
};
