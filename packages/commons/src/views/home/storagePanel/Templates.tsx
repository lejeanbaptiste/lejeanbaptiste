import { Button, Divider, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const Templates: FC = () => {
  const navigate = useNavigate();
  const { templates } = useAppState().storage;
  const { loadTemplate, setResource } = useActions().storage;
  const { t } = useTranslation();
  const { breakpoints, palette } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const handleClick = async (title: string, url: string) => {
    const documentString = await loadTemplate(url);
    setResource({ content: documentString });
    navigate(`/edit?template=${title}`, { replace: true });
  };

  return (
    <Stack
      direction={isMobile ? 'column' : 'row'}
      spacing={isMobile ? 1 : 3}
      alignItems="center"
      sx={{
        width: isMobile ? '90vw' : 600,
        py: 0.75,
        px: 2,
        backgroundColor: palette.mode === 'dark' ? palette.grey[900] : palette.grey[50],
        borderRadius: 3,
      }}
    >
      <Typography sx={{ fontWeight: 700, letterSpacing: '.15rem', textTransform: 'uppercase' }}>
        {t('home:templates')}
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
        justifyContent={isMobile ? 'flex-start' : 'center'}
        spacing={3}
        overflow="auto"
        width="100%"
        pb={isMobile ? 1 : 0}
        px={isMobile ? 1 : 0}
      >
        {templates.map(({ icon, title, url }) => {
          const Icon = getIcon(icon);
          return (
            <Button
              key={title}
              color="primary"
              onClick={() => handleClick(title, url)}
              size="small"
              startIcon={<Icon fontSize="inherit" />}
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
              {title}
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );
};

export default Templates;
