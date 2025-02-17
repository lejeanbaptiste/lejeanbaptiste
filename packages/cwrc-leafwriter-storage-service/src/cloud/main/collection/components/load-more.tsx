import { CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

type Props = {
  isLoadingMore?: boolean;
  loadMore: () => Promise<void>;
  refTarget?: React.MutableRefObject<HTMLDivElement | null>;
};

export const LoadMore = ({ isLoadingMore, loadMore, refTarget }: Props) => {
  const { t } = useTranslation();

  return (
    <Stack ref={refTarget} alignItems="center">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        m={2}
        px={2}
        borderRadius={4}
        sx={[(theme) => ({ backgroundColor: `rgba(${theme.palette.text.secondary} / 0.05)` })]}
        onClick={loadMore}
      >
        <Typography variant="overline">{t('SS.cloud.loading_more')}</Typography>
        {isLoadingMore && <CircularProgress size={16} />}
      </Stack>
    </Stack>
  );
};
