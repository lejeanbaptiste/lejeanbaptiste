import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Alert, Link } from '@mui/material';
import { Trans } from 'react-i18next';

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
    <OpenInNewIcon sx={{ ml: 0.1, verticalAlign: 'middle', fontSize: 'inherit' }} />.
  </Alert>
);
