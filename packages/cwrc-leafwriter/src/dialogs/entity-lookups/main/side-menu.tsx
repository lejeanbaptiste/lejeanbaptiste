import { Box, Button, ButtonGroup, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CiWarning } from 'react-icons/ci';
import type { Authority } from '../../../types';
import { authoritiesAtom } from '../store';

export const SideMenu = ({ authorityInView }: { authorityInView: string[] }) => {
  const { t } = useTranslation();

  const authorities = useAtomValue(authoritiesAtom);

  const refElemennt = useRef<HTMLDivElement>();

  const handleClick = (authorityId: Authority | (string & {})) => {
    refElemennt.current?.parentElement
      ?.querySelector?.(`#${authorityId}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box
      ref={refElemennt}
      display="flex"
      justifyContent="flex-end"
      minWidth={120}
      maxWidth={180}
      mr={1}
      mt={2}
    >
      {authorities.length > 0 && (
        <ButtonGroup
          aria-label="Side menu"
          orientation="vertical"
          size="small"
          sx={{ alignItems: 'flex-end', gap: 0.5 }}
        >
          {authorities.map(({ id, name, results }) => (
            <Tooltip
              id="error-message-tooltip"
              key={id}
              placement="left"
              title={results?.status === 'error' && results?.message ? results?.message : ''}
            >
              <span>
                <Button
                  aria-errormessage={'error-message-tooltip'}
                  aria-invalid={results?.status === 'error' ? 'true' : 'false'}
                  color={authorityInView.includes(id) ? 'primary' : 'inherit'}
                  disabled={results?.status === 'error' || results?.status === 'loading'}
                  endIcon={
                    <Badge
                      count={results?.status === 'success' ? results?.candidates.length : undefined}
                      status={results?.status}
                    />
                  }
                  size="small"
                  onClick={() => handleClick(id)}
                  sx={{ borderRadius: '4px !important', textTransform: 'initial' }}
                  variant="text"
                >
                  {name}
                </Button>
              </span>
            </Tooltip>
          ))}
          <Button
            color={authorityInView.includes('other') ? 'primary' : 'inherit'}
            endIcon={<Badge />}
            onClick={() => handleClick('other')}
            sx={{ borderRadius: 1, textTransform: 'capitalize' }}
            variant="text"
          >
            {t('LW.commons.other')}
          </Button>
        </ButtonGroup>
      )}
    </Box>
  );
};

const Badge = ({ count, status }: { count?: number; status?: 'success' | 'error' | 'loading' }) => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minWidth={20}
    borderRadius={1}
    sx={{
      backgroundColor:
        status === 'success' ? (theme) => theme.vars.palette.action.hover : 'inherit',
    }}
  >
    {status === 'loading' ? (
      <CircularProgress size={12} />
    ) : status === 'error' ? (
      <CiWarning size={12} />
    ) : status === 'success' ? (
      <Typography variant="caption">{count}</Typography>
    ) : null}
  </Box>
);
