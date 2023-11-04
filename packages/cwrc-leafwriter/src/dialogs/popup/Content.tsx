import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Icon, IconButton, Link, Stack, Typography } from '@mui/material';
import { getIcon } from '../../icons';
import { EntityType } from '../../types';

type Props = {
  content?: string;
  entityType?: EntityType;
  isLink?: boolean;
};

export const Content = ({ content = '', entityType, isLink = false }: Props) => {
  const handleCopyToClipboard = async () => {
    //@ts-ignore
    const permission = await navigator.permissions.query({ name: 'clipboard-write' });
    if (permission.state == 'granted' || permission.state == 'prompt') {
      await navigator.clipboard.writeText(content ?? '');
    }
  };

  return (
    <Stack direction="row" alignItems="center" px={1} py={0.5} gap={1}>
      {entityType && (
        <Icon component={getIcon(entityType)} sx={{ height: '.8rem', width: '0.8rem' }} />
      )}
      {isLink ? (
        <Link href={content} rel="noreferrer" target="_blank" variant="caption">
          {content}
        </Link>
      ) : (
        <Typography variant="caption">{content}</Typography>
      )}
      <IconButton onClick={handleCopyToClipboard} size="small">
        <ContentCopyIcon sx={{ height: '.8rem', width: '0.8rem' }} />
      </IconButton>
    </Stack>
  );
};
