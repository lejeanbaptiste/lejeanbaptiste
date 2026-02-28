import { Button, Container, Dialog, DialogContent, Grid, Link, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import { extractMarkdownHeadings, slugfy } from '@src/utilities';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';
import { Toc } from './toc';

const loadContent = async (currentLocale: string) => {
  const response = await fetch(`./content/privacy/${currentLocale}.md`);
  const text = await response.text();
  return text;
};

export const PrivacyDialog = ({ id = uuidv4() }: IDialog) => {
  const { currentLocale } = useAppState().ui;
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation();

  const [content, setContent] = useState('');

  useEffect(() => {
    loadContent(currentLocale).then((text) => setContent(text));
  }, []);

  const headings = extractMarkdownHeadings(content);

  return (
    <Dialog
      id={id}
      fullScreen
      onClose={() => closeDialog(id)}
      open={true}
      slotProps={{ paper: { elevation: 0, variant: 'outlined' } }}
    >
      <Button onClick={() => closeDialog(id)} variant="text">
        {t('LWC.commons.close')}
      </Button>
      <DialogContent sx={{ p: 0, scrollPaddingTop: 60 }}>
        <Container maxWidth="lg">
          <Grid container spacing={8}>
            <Grid size={8}>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <Typography
                      component="h1"
                      id={typeof children === 'string' ? slugfy(children) : ''}
                      mb={2}
                      variant="h5"
                      sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        minHeight: 24,
                        py: 2,
                        backgroundColor: 'background.default',
                      }}
                    >
                      {children}
                    </Typography>
                  ),
                  h2: ({ children }) => (
                    <Typography
                      component="h2"
                      id={typeof children === 'string' ? slugfy(children) : ''}
                      my={1.5}
                      variant="h6"
                    >
                      {children}
                    </Typography>
                  ),
                  h3: ({ children }) => (
                    <Typography
                      component="h3"
                      id={typeof children === 'string' ? slugfy(children) : ''}
                      my={1}
                      variant="subtitle1"
                      fontWeight={700}
                    >
                      {children}
                    </Typography>
                  ),
                  h4: ({ children }) => (
                    <Typography
                      component="h4"
                      id={typeof children === 'string' ? slugfy(children) : ''}
                      my={0.5}
                      variant="subtitle1"
                    >
                      {children}
                    </Typography>
                  ),
                  p: ({ children }) => (
                    <Typography color="text.secondary" fontSize="0.95rem" mb={1.5} variant="body1">
                      {children}
                    </Typography>
                  ),
                  li: ({ children }) => (
                    <Typography
                      component="li"
                      color="text.secondary"
                      fontSize="0.95rem"
                      mb={1.5}
                      variant="body1"
                    >
                      {children}
                    </Typography>
                  ),
                  a: ({ node, children }) => (
                    <Link rel="noopener noreferrer" target="_blank" {...node?.properties}>
                      {children}
                    </Link>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </Grid>
            <Grid size={4} pt={8}>
              {headings.length > 0 && <Toc headings={headings} />}
            </Grid>
          </Grid>
        </Container>
      </DialogContent>
    </Dialog>
  );
};
