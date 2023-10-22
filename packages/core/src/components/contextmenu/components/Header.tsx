import { Box, Tooltip, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { tagFullNameAtom, tagNameAtom, xpathAtom } from '../store';

interface HeaderProps {
  nodeType?: 'tag' | 'text';
  count?: number;
}

export const Header = ({ count, nodeType }: HeaderProps) => {
  const { t } = useTranslation('leafwriter');

  const fullName = useAtomValue(tagFullNameAtom);
  const tagName = useAtomValue(tagNameAtom);
  const xpath = useAtomValue(xpathAtom);

  const TagName = () => (
    <Typography variant="caption">
      {`<${tagName}>`}
      {fullName && (
        <Typography component="span" sx={{ textTransform: 'capitalize' }} variant="caption">
          {` ${fullName}`}
        </Typography>
      )}
    </Typography>
  );

  const MultipleTags = () => (
    <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
      {t('multiple tags')} ({count})
    </Typography>
  );

  const TextNode = () => <Typography variant="caption">#textNode</Typography>;

  return (
    <Tooltip enterDelay={2500} placement="top" title={count && count > 1 ? undefined : xpath}>
      <Box
        display="flex"
        justifyContent="center"
        mt={-0.5}
        mb={0.5}
        sx={{ cursor: 'default', bgcolor: ({ palette }) => palette.action.selected }}
      >
        {count ? <MultipleTags /> : nodeType === 'text' ? <TextNode /> : <TagName />}
      </Box>
    </Tooltip>
  );
};
