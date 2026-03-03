import { Button, Container, Dialog, DialogContent, Grid } from '@mui/material';
import { ContainerCompiledMdxContent } from '@src/components/mdx';
import { Toc } from '@src/components/toc';
import { useActions, useAppState } from '@src/overmind';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from '../type';
import { mdxComponents } from './mdx-components';

import * as ro from '@src/content/privacy/ro.mdx';
import * as en from '@src/content/privacy/en.mdx';
import * as es from '@src/content/privacy/es.mdx';
import * as fr from '@src/content/privacy/fr.mdx';
import * as pt from '@src/content/privacy/pt.mdx';

// Static mapping of content by locale
const privacyContentMap = {
  //@ts-ignore
  en: { content: en.default, tableOfContents: en.tableOfContents },
  //@ts-ignore
  es: { content: es.default, tableOfContents: es.tableOfContents },
  //@ts-ignore
  fr: { content: fr.default, tableOfContents: fr.tableOfContents },
  //@ts-ignore
  pt: { content: pt.default, tableOfContents: pt.tableOfContents },
  //@ts-ignore
  ro: { content: ro.default, tableOfContents: ro.tableOfContents },
};

export const PrivacyDialog = ({ id = uuidv4() }: IDialog) => {
  const { currentLocale } = useAppState().ui;
  const { closeDialog } = useActions().ui;
  const { t } = useTranslation();

  const privacyContent = privacyContentMap[currentLocale as keyof typeof privacyContentMap];

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
              <ContainerCompiledMdxContent
                content={privacyContent.content}
                mdxComponentOverride={mdxComponents}
              />
            </Grid>
            {privacyContent.tableOfContents && privacyContent.tableOfContents.length > 0 && (
              <Grid size={4} pt={8}>
                <Toc headings={privacyContent.tableOfContents} />
              </Grid>
            )}
          </Grid>
        </Container>
      </DialogContent>
    </Dialog>
  );
};
