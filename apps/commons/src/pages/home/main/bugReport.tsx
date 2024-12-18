import { Button, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { useActions } from '@src/overmind';
import chroma from 'chroma-js';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiCopyAlt } from 'react-icons/bi';
import { IoMdClose } from 'react-icons/io';
import { TbExternalLink } from 'react-icons/tb';

export const BugReport = () => {
  const { palette } = useTheme();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  const baseColor = palette.mode === 'dark' ? palette.grey[900] : palette.grey[50];
  const bgcolor = palette.mode === 'dark' ? chroma(baseColor).alpha(0.7).css() : palette.grey[50];
  const bgcolorHover = chroma(bgcolor).alpha(0.3).css();

  const baseBorderColor = palette.mode === 'dark' ? palette.grey[700] : palette.grey[400];

  return (
    <Stack
      position="relative"
      justifyContent="center"
      alignItems="center"
      gap={1}
      mb={1}
      p={1}
      bgcolor={bgcolor}
      borderColor={baseBorderColor}
      overflow="hidden"
      sx={{ borderStyle: 'solid', borderWidth: 1 }}
      component={motion.div}
      animate={{
        width: open ? 580 : 130,
        height: open ? 170 : 30,
        borderRadius: open ? 4 : 8,
      }}
      whileHover={{
        backgroundColor: open ? bgcolor : bgcolorHover,
        borderColor: open ? baseBorderColor : palette.primary.main,
        cursor: open ? 'default' : 'pointer',
      }}
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
  const { palette } = useTheme();
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
        bgcolor={chroma(palette.primary.main).alpha(0.1).css()}
        borderRadius={1}
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
