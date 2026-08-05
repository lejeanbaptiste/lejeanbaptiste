import Box, { type BoxProps } from '@mui/material/Box';
import zoteroIcon from '../../icons/zotero.png';

/** Official Zotero app icon (see https://www.zotero.org/support/brand). */
export const ZoteroIcon = ({ sx, ...props }: BoxProps) => (
  <Box
    component="img"
    src={zoteroIcon}
    alt=""
    aria-hidden
    sx={{
      display: 'block',
      width: 20,
      height: 20,
      objectFit: 'contain',
      ...sx,
    }}
    {...props}
  />
);
