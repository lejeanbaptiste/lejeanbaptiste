import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import OrcidIcon from '../icons/orcid';
import { Gitlab } from 'mdi-material-ui';

const icons: Map<string, any> = new Map();
icons.set('github', GitHubIcon);
icons.set('gitlab', Gitlab);
icons.set('orcid', OrcidIcon);
icons.set('fingerprint', FingerprintIcon);

export const getIcon = (name: string): any => {
  const icon = icons.get(name);
  if (!icon) return FingerprintIcon;
  return icon;
};
