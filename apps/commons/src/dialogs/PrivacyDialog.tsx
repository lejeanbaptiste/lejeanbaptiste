import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { useAppState } from '@src/overmind';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { useActions } from '../overmind';
import type { IDialog } from './type';

export const PrivacyDialog = ({ id = uuidv4(), open = true }: IDialog) => {
  const { currentLocale } = useAppState().ui;
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation();
  const { showSettings } = useCookieConsent();

  const [content, setContent] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    const response = await fetch(`./content/privacy/${currentLocale}.md`);
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
            h1: ({ node, children }) => (
              <Typography component="h1" mb={3} variant="h4" {...node?.properties}>
                {children}
              </Typography>
            ),
            h2: ({ node, children }) => (
              <Typography component="h2" my={2} variant="h5" {...node?.properties}>
                {children}
              </Typography>
            ),
            h3: ({ node, children }) => (
              <Typography component="h3" my={1.5} variant="h6" {...node?.properties}>
                {children}
              </Typography>
            ),
            h4: ({ node, children }) => (
              <Typography
                component="h4"
                fontWeight={700}
                my={1}
                variant="subtitle1"
                {...node?.properties}
              >
                {children}
              </Typography>
            ),
            p: ({ node, children }) => (
              <Typography mb={1} {...node?.properties}>
                {children}
              </Typography>
            ),
            a: ({ node, children }) => (
              <Link
                underline="hover"
                target="_blank"
                rel="noopener noreferrer"
                {...node?.properties}
              >
                {children}
              </Link>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onPointerDown={handleOpenSettings}>
          {t('LWC.cookie consent.privacy_settings')}
        </Button>
        <Button onPointerDown={handleCancel} variant="outlined">
          {t('LWC.commons.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
