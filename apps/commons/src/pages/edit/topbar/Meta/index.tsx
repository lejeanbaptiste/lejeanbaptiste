import { Stack, Typography, styled } from '@mui/material';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { leafwriterAtom } from '@src/jotai';
import { useAppState } from '@src/overmind';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { Cloud } from './Cloud';
import { FullPath } from './FullPath';

export const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 800,
    marginTop: `0px !important`,
    boxShadow: theme.palette.mode === 'dark' ? 'none' : `0 0 2px ${theme.palette.grey[300]}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
  },
}));

export const Meta = () => {
  const { resource } = useAppState().editor;

  const leafWriter = useAtomValue(leafwriterAtom);

  const fullPath = useMemo(() => {
    if (!resource) return '';
    if (!resource.filename) return '';

    const { filename, owner, path, repo } = resource;
    return `${owner}: ${repo}/${path && `${path}/`}${filename}`;
  }, [resource]);

  return (
    <>
      {resource && (
        <Stack direction="row" flex={1} flexShrink={1} justifyContent="center" minWidth={0}>
          <StyledTooltip
            enterDelay={1000}
            title={
              resource.provider && (
                <FullPath provider={resource.provider} url={resource.url}>
                  {fullPath}
                </FullPath>
              )
            }
          >
            <Typography
              component="h2"
              ml={1}
              sx={{
                cursor: 'default',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              variant="subtitle1"
            >
              {resource.filename ?? 'untitled.xml'}
            </Typography>
          </StyledTooltip>
          {leafWriter && resource.provider && <Cloud />}
        </Stack>
      )}
    </>
  );
};
