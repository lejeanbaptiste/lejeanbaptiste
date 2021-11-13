import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Gitlab } from 'mdi-material-ui';

const icons: Map<string, any> = new Map();
icons.set('github', GitHubIcon);
icons.set('gitlab', Gitlab);
icons.set('fingerprint', FingerprintIcon);
icons.set('cloud', CloudQueueIcon);
icons.set('computer', ComputerIcon);
icons.set('paste', ContentPasteIcon);

export const getIcon = (name: string): any => {
  const icon = icons.get(name);
  if (!icon) return FingerprintIcon;
  return icon;
};
