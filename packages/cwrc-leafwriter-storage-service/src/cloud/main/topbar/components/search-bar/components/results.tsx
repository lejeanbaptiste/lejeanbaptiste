import { Box, Button, Divider, ListSubheader, Stack } from '@mui/material';
import { useAppState } from '@src/overmind';
import type { Content, SearchResultsBlobs } from '@src/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from './item';

const LIST_SIZE = 5;

interface ResultsProps {
  list: Content[] | SearchResultsBlobs[];
  onPrimaryAction: (item: Content | SearchResultsBlobs) => void;
  onSecondaryAction: (item: Content | SearchResultsBlobs) => void;
  type: string;
}

export const Results = ({ list, onPrimaryAction, onSecondaryAction, type }: ResultsProps) => {
  const { owner, repository, name } = useAppState().cloud;
  const [limit, setLimit] = useState(LIST_SIZE);

  const { t } = useTranslation();

  const showMoreButton = LIST_SIZE < list.length;

  const headerLabel = (value: string) => {
    let label = value;
    if (value === 'blobs' && name === 'github') {
      label = t('SS.cloud.search.content_across_username', {
        username: owner?.name ?? owner?.username,
      });
    }
    if (value === 'blobs' && name === 'gitlab') {
      label = t('SS.cloud.search.content_on_repository', {
        repository: repository?.name,
      });
    }
    if (value === 'filename') {
      label = t('SS.cloud.search.files_on_repositoty', {
        repository: repository?.name,
      });
    }
    return label;
  };

  const handleShowMore = () => {
    setLimit(limit === LIST_SIZE ? list.length : LIST_SIZE);
  };

  return (
    <>
      {list.length > 0 && (
        <Box>
          <ListSubheader
            sx={[
              {
                py: 0.5,
                px: 3,
                pr: 1.5,
                lineHeight: 2,
                fontSize: '0.775rem',
                fontWeight: 700,
                backgroundColor: (theme) => theme.palette.background.paper,
              },
              (theme) =>
                theme.applyStyles('dark', {
                  backgroundColor: '#252525',
                }),
            ]}
          >
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center" pt={0.5}>
              {headerLabel(type)}
              {showMoreButton && (
                <Button
                  color="secondary"
                  data-testid="search-bar:show-more"
                  onClick={handleShowMore}
                  size="small"
                  sx={{ px: 1, borderRadius: 3, lineHeight: 1.75, fontSize: '0.7125rem' }}
                >
                  {limit === LIST_SIZE ? t('SS.commons.show_more') : t('SS.commons.show_less')}
                </Button>
              )}
            </Stack>
          </ListSubheader>
          {list.slice(0, limit).map((item, index) => (
            <Item
              key={index}
              item={item}
              onPrimaryAction={onPrimaryAction}
              onSecondaryAction={onSecondaryAction}
            />
          ))}
        </Box>
      )}
    </>
  );
};
