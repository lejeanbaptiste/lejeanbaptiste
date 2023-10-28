import { FormControl, FormHelperText, Input, Stack } from '@mui/material';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';
import { isValidHttpURL } from '../utilities';

export const UrlPanel = () => {
  const { t } = useTranslation('LWStorageService');
  const { allowedFileTypes, resource } = useAppState().common;
  const { setResource } = useActions().common;

  const typeList = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });

  const [inputValue, setInputValue] = useState('');

  const helperText = useMemo(() => {
    const content =
      inputValue !== '' && !isValidHttpURL(inputValue)
        ? t('message.must be a valid https url')
        : allowedFileTypes &&
          t('message.must point to a file type', {
            filetypes: typeList.format(allowedFileTypes),
          });
    return content;
  }, [allowedFileTypes, inputValue]);

  useEffect(() => {
    if (resource?.url) setInputValue(resource.url);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const url = event.currentTarget.value;
    setInputValue(url);
    setResource({ url: isValidHttpURL(url) ? url : undefined });
  };

  return (
    <Stack width="100%" height="100%" alignItems="center" justifyContent="center">
      <Stack direction="row" gap={2} width="80%">
        <FormControl fullWidth>
          <Input
            name="document_url"
            onChange={handleInputChange}
            placeholder="https://"
            value={inputValue}
          />
          {helperText && (
            <FormHelperText error={inputValue !== '' && !isValidHttpURL(inputValue)}>
              {helperText}
            </FormHelperText>
          )}
        </FormControl>
      </Stack>
    </Stack>
  );
};
