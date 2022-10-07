import { Button, Divider, Icon, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const MAX_TEMPLATES_SHOW = 4;

export const Templates: FC = () => {
  const navigate = useNavigate();
  const { templates } = useAppState().storage;

  const { loadTemplate, setResource } = useActions().storage;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('commons');
  const { breakpoints, palette } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const handleClick = async (title: string, url: string) => {
    const documentString = await loadTemplate(url);
    setResource({ content: documentString });
    navigate(`/edit?template=${title}`, { replace: true });
  };

  const handleOpenTemplates = () => {
    openDialog({ type: 'templates' });
  };

  return (
    <Stack
      direction={isMobile ? 'column' : 'row'}
      spacing={isMobile ? 1 : 3}
      alignItems="center"
      sx={{
        width: isMobile ? '90vw' : 700,
        py: 0.75,
        px: 2,
        backgroundColor: palette.mode === 'dark' ? palette.grey[900] : palette.grey[50],
        borderRadius: 3,
      }}
    >
      <Typography sx={{ fontWeight: 700, letterSpacing: '.15rem', textTransform: 'uppercase' }}>
        {t('templates')}
      </Typography>
      <Divider
        flexItem
        orientation={isMobile ? 'horizontal' : 'vertical'}
        sx={{
          alignSelf: isMobile ? 'center' : 'auto',
          width: isMobile ? 120 : 0,
          height: isMobile ? 0 : 20,
          borderColor: '#999',
          boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)',
        }}
      />
      <Stack
        direction={isMobile ? 'row' : 'row'}
        justifyContent="flex-start"
        spacing={3}
        overflow="auto"
        width="100%"
        pb={isMobile ? 1 : 0}
        px={isMobile ? 1 : 0}
      >
        {templates
          .filter((_t, index) => index < MAX_TEMPLATES_SHOW)
          .map(({ icon, title, url }) => {
            return (
              <Button
                key={url}
                onClick={() => handleClick(title, url)}
                size="small"
                startIcon={<Icon component={getIcon(icon ?? 'blankPage')} fontSize="inherit" />}
                sx={{
                  px: 1,
                  '&:hover': {
                    color: palette.primary.light,
                    backgroundColor: 'transparent',
                  },
                }}
              >
                {title}
              </Button>
            );
          })}
        {templates.length > MAX_TEMPLATES_SHOW && (
          <Button
            color="primary"
            onClick={handleOpenTemplates}
            size="small"
            sx={{
              color: 'inherit',
              px: 1,
              '&:hover': {
                color: palette.primary.light,
                backgroundColor: 'transparent',
              },
            }}
            variant="text"
          >
            {t('more')}
          </Button>
        )}
      </Stack>
    </Stack>
  );
};
