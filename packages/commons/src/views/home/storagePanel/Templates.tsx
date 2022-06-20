import { Button, Divider, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities/icons';
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
      direction="row"
      spacing={3}
      alignItems="center"
      sx={{
        width: 600,
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
        orientation="vertical"
        sx={{ borderColor: '#999', boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)' }}
      />
      <Stack direction="row" justifyContent="center" spacing={3}>
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
                  color: palette.primary.main,
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
