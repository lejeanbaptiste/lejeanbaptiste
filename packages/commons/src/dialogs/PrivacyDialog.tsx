import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography
} from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { useAppState } from '@src/overmind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { useActions } from '../overmind';
import type { IDialog } from './type';

export const PrivacyDialog = ({ id = uuidv4(), open = true }: IDialog) => {
  const { language } = useAppState().ui;
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation('LWC');
  const { showSettings } = useCookieConsent();

  const [content, setContent] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    const file = `privacy_${language.code}.md`;
    const response = await fetch(`./content/${file}`);
    const text = await response.text();
    setContent(text);
  };

  const handleClose = (_event: MouseEvent, reason?: string) => closeDialog(id);
  const handleCancel = () => closeDialog(id);

  const handleOpenSettings = async () => {
    closeDialog(id);
    showSettings();
  };

  return (
    <Dialog id={id} maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle>LEAF-Writer</DialogTitle>
      <DialogContent>
        <ReactMarkdown
          components={{
            h1: ({ ...props }) => <Typography component="h1" mb={3} variant="h4" {...props} />,
            h2: ({ ...props }) => <Typography component="h2" my={2} variant="h5" {...props} />,
            h3: ({ ...props }) => <Typography component="h3" my={1.5} variant="h6" {...props} />,
            h4: ({ ...props }) => (
              <Typography component="h4" my={1} variant="subtitle1" fontWeight={700} {...props} />
            ),
            p: ({ ...props }) => <Typography mb={1} {...props} />,
            a: ({ ...props }) => (
              <Link underline="hover" target="_blank" rel="noopener noreferrer" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleOpenSettings}>{t('LWC:cookie_consent.privacy_settings')}</Button>
        <Button onClick={handleCancel} variant="outlined">
          {t('LWC:commons.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
