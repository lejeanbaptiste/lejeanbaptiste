import { FormControl, FormHelperText, Input, Stack } from '@mui/material';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';
import { isValidHttpURL } from '../utilities';

// Module scope: a constant formatter with no component inputs. Rebuilding it per
// render made it unusable as a memo dependency.
const typeList = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });

export const UrlPanel = () => {
  const { t } = useTranslation();
  const { allowedFileTypes, resource } = useAppState().common;
  const { setResource } = useActions().common;

  const [inputValue, setInputValue] = useState('');

  const helperText = useMemo(() => {
    const content =
      inputValue !== '' && !isValidHttpURL(inputValue)
        ? t('SS.message.must be a valid https url')
        : allowedFileTypes &&
          t('SS.message.must point to a file type', {
            filetypes: typeList.format(allowedFileTypes),
          });
    return content;
  }, [allowedFileTypes, inputValue, t]);

  useEffect(() => {
    if (resource?.url) setInputValue(resource.url);
    // Seeds the field once from the incoming resource; later edits belong to the
    // user, so re-running on `resource.url` would overwrite what they typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
