import { Button, Container, Dialog, DialogContent, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ContainerCompiledMdxContent } from '../../components/mdx';
import { Toc } from '../../components/toc';
import { useAppState } from '../../overmind';
import { mdxComponents } from './mdx-components';

import * as en from '../../content/privacy/en.mdx';
import * as es from '../../content/privacy/es.mdx';
import * as fr from '../../content/privacy/fr.mdx';
import * as pt from '../../content/privacy/pt.mdx';
import * as ro from '../../content/privacy/ro.mdx';

interface PrivacyFrontmatter {
  lastUpdated?: string;
  [key: string]: any;
}

// Static mapping of content by locale
const privacyContentMap = {
  en: {
    content: en.default,
    tableOfContents: en.tableOfContents,
    frontMatter: en.frontmatter as PrivacyFrontmatter,
  },
  es: {
    content: es.default,
    tableOfContents: es.tableOfContents,
    frontMatter: es.frontmatter as PrivacyFrontmatter,
  },
  fr: {
    content: fr.default,
    tableOfContents: fr.tableOfContents,
    frontMatter: fr.frontmatter as PrivacyFrontmatter,
  },
  pt: {
    content: pt.default,
    tableOfContents: pt.tableOfContents,
    frontMatter: pt.frontmatter as PrivacyFrontmatter,
  },
  ro: {
    content: ro.default,
    tableOfContents: ro.tableOfContents,
    frontMatter: ro.frontmatter as PrivacyFrontmatter,
  },
};

interface PrivacyDialogProps {
  open: boolean;
  onClose?: () => void;
}

export const PrivacyDialog = ({ open, onClose }: PrivacyDialogProps) => {
  const { currentLocale } = useAppState().ui;
  const { t } = useTranslation();

  const privacyContent = privacyContentMap[currentLocale as keyof typeof privacyContentMap];

  return (
    <Dialog
      maxWidth="md"
      onClose={onClose}
      open={open}
      slotProps={{ paper: { elevation: 0, variant: 'outlined' } }}
    >
      <Button onClick={onClose} variant="text">
        {t('LW.commons.close')}
      </Button>
      <DialogContent sx={{ px: 0, pt: 0, pb: 2, scrollPaddingTop: 60 }}>
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
