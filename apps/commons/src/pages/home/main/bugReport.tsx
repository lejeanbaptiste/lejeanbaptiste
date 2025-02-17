import { Button, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useActions } from '@src/overmind';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiCopyAlt } from 'react-icons/bi';
import { IoMdClose } from 'react-icons/io';
import { TbExternalLink } from 'react-icons/tb';

export const BugReport = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { mode, systemMode } = useColorScheme();

  const [open, setOpen] = useState(false);

  const backgroundColor = useMemo(() => {
    const isDarkMode = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
    return isDarkMode ? theme.vars.palette.grey[900] : theme.vars.palette.grey[50];
  }, [mode, systemMode]);

  return (
    <Stack
      position="relative"
      justifyContent="center"
      alignItems="center"
      gap={1}
      mb={1}
      p={1}
      overflow="hidden"
      sx={[
        {
          backgroundColor: theme.vars.palette.grey[50],
          borderStyle: 'solid',
          borderWidth: 1,
          borderColor: theme.vars.palette.grey[400],
        },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: theme.vars.palette.grey[900],
            borderColor: theme.vars.palette.grey[700],
          }),
      ]}
      component={motion.div}
      animate={{
        width: open ? 580 : 130,
        height: open ? 170 : 30,
        borderRadius: open ? 4 : 8,
      }}
      whileHover={
        open
          ? {
              backgroundColor: `rgba(${backgroundColor} / 0.3)`,
              borderColor:
                mode === 'dark' ? theme.vars.palette.grey[700] : theme.vars.palette.grey[400],
              cursor: 'default',
            }
          : {
              backgroundColor: `rgba(${backgroundColor} / 0.3)`,
              borderColor: theme.vars.palette.primary.main,
              cursor: 'pointer',
            }
      }
      onClick={() => !open && setOpen(true)}
    >
      <Typography
        sx={{ pointerEvents: 'none' }}
        textAlign="center"
        textTransform="capitalize"
        variant="subtitle2"
      >
        {`${t('LWC.home.bugReport.bugs')} / ${t('LWC.home.bugReport.requests')}`}
      </Typography>
      {open && (
        <>
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            sx={{ borderRadius: 1, position: 'absolute', top: 4, right: 4 }}
          >
            <IoMdClose fontSize="inherit" />
          </IconButton>
          <Stack justifyContent="center" alignItems="center" gap={2} mt={1}>
            <GitLabTIcket />
            <DisplayEmail />
          </Stack>
        </>
      )}
    </Stack>
  );
};

const GitLabTIcket = () => {
  const { t } = useTranslation();

  return (
    <Button
      endIcon={<TbExternalLink />}
      href="https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues/new"
      size="small"
      sx={{ borderRadius: 1, textTransform: 'none' }}
      target="_blank"
      variant="outlined"
    >
      {t('LWC.home.bugReport.Open a ticket on GitLab')}
    </Button>
  );
};

const DisplayEmail = () => {
  const { t } = useTranslation();
  const { notifyViaSnackbar } = useActions().ui;

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(
      'contact-project+calincs-cwrc-leaf-writer-leaf-writer-31283590-issue-@incoming.gitlab.com',
    );
    notifyViaSnackbar({ message: t('LWC.home.bugReport.email copied to clipboard') });
  };

  return (
    <Stack alignItems="center">
      <Typography variant="caption">{t('LWC.home.bugReport.or send by email to')}:</Typography>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        pl={1}
        pr={0.25}
        py={0.25}
        borderRadius={1}
        sx={(theme) => ({
          backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.12)`,
        })}
      >
        <Typography variant="caption">
          contact-project+calincs-cwrc-leaf-writer-leaf-writer-31283590-issue-@incoming.gitlab.com
        </Typography>
        <IconButton onClick={handleCopyToClipboard} size="small" sx={{ borderRadius: 1 }}>
          <BiCopyAlt fontSize="inherit" />
        </IconButton>
      </Stack>
    </Stack>
  );
};
