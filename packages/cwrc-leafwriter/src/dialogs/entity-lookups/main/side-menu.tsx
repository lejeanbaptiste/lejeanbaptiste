import { Box, Button, ButtonGroup, CircularProgress, Tooltip } from '@mui/material';
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
    <Box ref={refElemennt} minWidth={120} maxWidth={180} mt={2}>
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
                    results?.status === 'loading' ? (
                      <CircularProgress size={12} />
                    ) : results?.status === 'error' ? (
                      <CiWarning size={12} />
                    ) : null
                  }
                  size="small"
                  onClick={() => handleClick(id)}
                  sx={{ borderRadius: '4px !important', textTransform: 'initial' }}
                  variant="text"
                >
                  {name}
                  {results?.status === 'success' && (
                    <BadgeCount count={results.candidates.length} />
                  )}
                </Button>
              </span>
            </Tooltip>
          ))}
          <Button
            color={authorityInView.includes('other') ? 'primary' : 'inherit'}
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

const BadgeCount = ({ count }: { count?: number }) => (
  <Box
    sx={{
      position: 'relative',
      minWidth: 16,
      height: 18,
      pl: 0.5,
      px: 0.25,
      borderRadius: 0.5,
      lineHeight: '1.2rem',
      textAlign: 'right',
    }}
  >
    {count}
  </Box>
);
