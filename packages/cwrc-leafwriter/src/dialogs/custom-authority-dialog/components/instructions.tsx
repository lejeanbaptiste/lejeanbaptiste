import { Alert, Link } from '@mui/material';
import { Trans } from 'react-i18next';
import { TbExternalLink } from 'react-icons/tb';

export const Instructions = () => (
  <Alert severity="info">
    <Trans i18nKey="LW.settings.authorities.messages.learn how to set up a custom TEI-based authority file with this guide">
      Learn how to set up a custom TEI-based authority file with{' '}
      <Link
        href="https://docs.google.com/document/d/e/2PACX-1vSzYc9WuNlmEorQpg7e5zO6YO5DHOS9L2ZXcDhZHLTtbOJQty1A-wKtvDCoLjUUyy6n871iXqem1WAP/pub"
        target="_blank"
      >
        this guide
      </Link>
    </Trans>
    <TbExternalLink style={{ marginLeft: '0.1rem', verticalAlign: 'middle' }} />.
  </Alert>
);
