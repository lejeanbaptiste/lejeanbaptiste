import { Button, Icon, Link, Stack, Typography } from '@mui/material';
import { TextEmphasis } from '@src/components';
import { getIcon } from '@src/icons';
import { Trans, useTranslation } from 'react-i18next';

type InterceptImportDialogProps = {
  format: string;
};

export const InterceptImportDialog = ({ format }: InterceptImportDialogProps) => {
  const { t } = useTranslation();
  return (
    <Stack alignItems="flex-start">
      <Typography paragraph lineHeight={1.75}>
        <Trans i18nKey="LWC.importExport.message.intercept_load_file_format" values={{ format }}>
          <Typography component="span">This looks like a </Typography>
          <TextEmphasis color="primary">{format}</TextEmphasis>
          <Typography component="span">document.</Typography>
        </Trans>{' '}
        <Typography component="span">
          {`${t(
            'LWC.importExport.message.LEAF-Writer needs to convert it to be able to use it',
          )} ${t('LWC.commons.what_would_you_like_to_do')}`}
        </Typography>
      </Typography>
      <Button
        component={Link}
        href="#"
        size="small"
        startIcon={<Icon component={getIcon('helpOutlineRoundedIcon')} fontSize="small" />}
        target="_blank"
        sx={{ textTransform: 'inherit' }}
      >
        {t('LWC.commons.learn_more')}
      </Button>
    </Stack>
  );
};
